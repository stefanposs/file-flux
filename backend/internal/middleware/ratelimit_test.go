package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestRateLimiter_AllowsUnderLimit(t *testing.T) {
	rl := &RateLimiter{
		visitors: make(map[string]*visitor),
		rate:     5,
		interval: time.Minute,
	}

	for i := 0; i < 5; i++ {
		if !rl.allow("1.2.3.4") {
			t.Fatalf("Request %d should be allowed (limit is 5)", i+1)
		}
	}
}

func TestRateLimiter_BlocksOverLimit(t *testing.T) {
	rl := &RateLimiter{
		visitors: make(map[string]*visitor),
		rate:     3,
		interval: time.Minute,
	}

	for i := 0; i < 3; i++ {
		rl.allow("1.2.3.4")
	}

	if rl.allow("1.2.3.4") {
		t.Fatal("4th request should be blocked (limit is 3)")
	}
}

func TestRateLimiter_SeparateIPs(t *testing.T) {
	rl := &RateLimiter{
		visitors: make(map[string]*visitor),
		rate:     2,
		interval: time.Minute,
	}

	// Exhaust IP 1
	rl.allow("1.1.1.1")
	rl.allow("1.1.1.1")

	// IP 2 should still work
	if !rl.allow("2.2.2.2") {
		t.Fatal("Different IP should not be rate-limited")
	}
}

func TestRateLimiter_ResetsAfterInterval(t *testing.T) {
	rl := &RateLimiter{
		visitors: make(map[string]*visitor),
		rate:     2,
		interval: 50 * time.Millisecond,
	}

	rl.allow("1.2.3.4")
	rl.allow("1.2.3.4")
	if rl.allow("1.2.3.4") {
		t.Fatal("3rd request should be blocked")
	}

	// Wait for interval to pass
	time.Sleep(60 * time.Millisecond)

	if !rl.allow("1.2.3.4") {
		t.Fatal("Request after interval reset should be allowed")
	}
}

func TestRateLimiter_Middleware_429(t *testing.T) {
	rl := &RateLimiter{
		visitors: make(map[string]*visitor),
		rate:     1,
		interval: time.Minute,
	}

	handler := rl.Limit(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// First request OK
	req1 := httptest.NewRequest("GET", "/test", nil)
	req1.RemoteAddr = "10.0.0.1:12345"
	rr1 := httptest.NewRecorder()
	handler.ServeHTTP(rr1, req1)

	if rr1.Code != http.StatusOK {
		t.Errorf("First request: expected 200, got %d", rr1.Code)
	}

	// Second request 429
	req2 := httptest.NewRequest("GET", "/test", nil)
	req2.RemoteAddr = "10.0.0.1:12346"
	rr2 := httptest.NewRecorder()
	handler.ServeHTTP(rr2, req2)

	if rr2.Code != http.StatusTooManyRequests {
		t.Errorf("Second request: expected 429, got %d", rr2.Code)
	}

	if rr2.Header().Get("Retry-After") == "" {
		t.Error("Expected Retry-After header on 429 response")
	}
}

func TestExtractIP_RemoteAddr(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	req.RemoteAddr = "192.168.1.1:54321"

	ip := extractIP(req)
	if ip != "192.168.1.1" {
		t.Errorf("Expected '192.168.1.1', got '%s'", ip)
	}
}

func TestExtractIP_XForwardedFor(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("X-Forwarded-For", "10.0.0.1, 172.16.0.1")
	req.RemoteAddr = "192.168.1.1:54321"

	ip := extractIP(req)
	if ip != "10.0.0.1" {
		t.Errorf("Expected '10.0.0.1', got '%s'", ip)
	}
}

func TestExtractIP_XRealIP(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("X-Real-IP", "10.0.0.5")
	req.RemoteAddr = "192.168.1.1:54321"

	ip := extractIP(req)
	if ip != "10.0.0.5" {
		t.Errorf("Expected '10.0.0.5', got '%s'", ip)
	}
}

func TestRateLimiter_Cleanup(t *testing.T) {
	rl := &RateLimiter{
		visitors: make(map[string]*visitor),
		rate:     5,
		interval: 10 * time.Millisecond,
	}

	rl.allow("old-ip")

	// Wait long enough for cleanup to consider it stale
	time.Sleep(30 * time.Millisecond)
	rl.cleanup()

	rl.mu.Lock()
	_, exists := rl.visitors["old-ip"]
	rl.mu.Unlock()

	if exists {
		t.Error("Expected old-ip to be cleaned up")
	}
}
