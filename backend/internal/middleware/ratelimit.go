package middleware

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// RateLimiter implementiert einen Token-Bucket Rate Limiter pro IP.
type RateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*visitor
	rate     int           // Anfragen pro Intervall
	interval time.Duration // Zeitfenster
}

type visitor struct {
	tokens    int
	lastReset time.Time
}

// NewRateLimiter erstellt einen neuen Rate Limiter.
// rate: max Anfragen pro interval-Zeitfenster.
func NewRateLimiter(rate int, interval time.Duration) *RateLimiter {
	rl := &RateLimiter{
		visitors: make(map[string]*visitor),
		rate:     rate,
		interval: interval,
	}

	// Cleanup alte Einträge alle 5 Minuten
	go func() {
		for {
			time.Sleep(5 * time.Minute)
			rl.cleanup()
		}
	}()

	return rl
}

func (rl *RateLimiter) cleanup() {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	cutoff := time.Now().Add(-2 * rl.interval)
	for ip, v := range rl.visitors {
		if v.lastReset.Before(cutoff) {
			delete(rl.visitors, ip)
		}
	}
}

func (rl *RateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	v, exists := rl.visitors[ip]
	if !exists {
		rl.visitors[ip] = &visitor{tokens: rl.rate - 1, lastReset: time.Now()}
		return true
	}

	// Token-Bucket auffrischen wenn Intervall vergangen
	if time.Since(v.lastReset) >= rl.interval {
		v.tokens = rl.rate - 1
		v.lastReset = time.Now()
		return true
	}

	if v.tokens <= 0 {
		return false
	}

	v.tokens--
	return true
}

// Limit gibt eine Middleware zurueck, die Anfragen pro IP limitiert.
func (rl *RateLimiter) Limit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := extractIP(r)
		if !rl.allow(ip) {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Retry-After", "60")
			w.WriteHeader(http.StatusTooManyRequests)
			w.Write([]byte(`{"error":"too many requests","code":"RATE_LIMITED"}`))
			return
		}
		next.ServeHTTP(w, r)
	})
}

func extractIP(r *http.Request) string {
	// Proxy-Header prüfen (nur vertrauenswürdig hinter eigenem Reverse-Proxy)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// Kann kommasepariert sein — nur erste IP nehmen
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}
	// Port entfernen (RemoteAddr ist "ip:port")
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
