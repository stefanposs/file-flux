package middleware

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

// Logger gibt eine Middleware zurück, die eingehende Anfragen strukturiert loggt
func Logger(logger *log.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			// Wrapped ResponseWriter um Status-Code zu erfassen
			wrapped := &statusResponseWriter{ResponseWriter: w, statusCode: http.StatusOK}
			next.ServeHTTP(wrapped, r)

			duration := time.Since(start)
			requestID, _ := r.Context().Value(RequestIDKey).(string)
			userID, _ := r.Context().Value(UserIDKey).(int)

			logger.Printf(
				"method=%s path=%s status=%d duration=%s ip=%s request_id=%s user_id=%d",
				r.Method,
				r.URL.Path,
				wrapped.statusCode,
				duration,
				extractIP(r),
				requestID,
				userID,
			)
		})
	}
}

// Recover gibt eine Middleware zurück, die Panics abfängt
func Recover(logger *log.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if err := recover(); err != nil {
					requestID, _ := r.Context().Value(RequestIDKey).(string)
					logger.Printf("PANIC recovered: %v request_id=%s path=%s", err, requestID, r.URL.Path)
					http.Error(w, `{"error":"internal server error","code":"INTERNAL_ERROR"}`, http.StatusInternalServerError)
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

// CORSConfig stores CORS configuration
type CORSConfig struct {
	AllowedOrigins []string
}

// NewCORSConfig creates CORS config from environment.
// CORS_ORIGINS env var: comma-separated list of allowed origins.
// Defaults to * in development, restricted in production.
func NewCORSConfig() CORSConfig {
	origins := os.Getenv("CORS_ORIGINS")
	if origins == "" {
		env := os.Getenv("ENV")
		if env == "production" {
			origins = "https://app.fileflux.de"
		} else {
			origins = "*"
		}
	}
	return CORSConfig{
		AllowedOrigins: strings.Split(origins, ","),
	}
}

// CORS erstellt eine konfigurierbare CORS-Middleware mit Security-Headern.
func CORSWithConfig(cfg CORSConfig) func(http.Handler) http.Handler {
	allowAll := len(cfg.AllowedOrigins) == 1 && cfg.AllowedOrigins[0] == "*"

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")

			// CORS Origin
			if allowAll {
				w.Header().Set("Access-Control-Allow-Origin", "*")
			} else if origin != "" {
				for _, allowed := range cfg.AllowedOrigins {
					if strings.TrimSpace(allowed) == origin {
						w.Header().Set("Access-Control-Allow-Origin", origin)
						w.Header().Set("Vary", "Origin")
						break
					}
				}
			}

			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-ID")
			w.Header().Set("Access-Control-Expose-Headers", "X-Request-ID")
			w.Header().Set("Access-Control-Max-Age", "86400")

			// Security Headers (enterprise-grade)
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("X-XSS-Protection", "1; mode=block")
			w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
			w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// CORS ist die Default-CORS-Middleware (Abwaertskompatibel).
func CORS(next http.Handler) http.Handler {
	return CORSWithConfig(NewCORSConfig())(next)
}

// SecureHeaders setzt allgemeine HTTP-Security-Header.
func SecureHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		next.ServeHTTP(w, r)
	})
}

// statusResponseWriter wraps http.ResponseWriter to capture the status code
type statusResponseWriter struct {
	http.ResponseWriter
	statusCode  int
	wroteHeader bool
}

func (w *statusResponseWriter) WriteHeader(code int) {
	if w.wroteHeader {
		return
	}
	w.wroteHeader = true
	w.statusCode = code
	w.ResponseWriter.WriteHeader(code)
}

// ValidateConfig prüft die Konfiguration und gibt Warnungen fuer unsichere Defaults aus.
func ValidateConfig(logger *log.Logger, jwtSecret, dbPassword, env string) {
	if env == "production" {
		if jwtSecret == "fileflux-secret-key" || jwtSecret == "dev-secret-change-in-production" {
			logger.Println("WARNUNG: JWT_SECRET ist ein unsicherer Default-Wert! Bitte aendern fuer Produktion.")
		}
		if len(jwtSecret) < 32 {
			logger.Println("WARNUNG: JWT_SECRET sollte mindestens 32 Zeichen lang sein.")
		}
		if dbPassword == "fileflux" {
			logger.Println("WARNUNG: DB_PASSWORD ist der Default-Wert! Bitte aendern fuer Produktion.")
		}
	}

	// Sicherheitsinfo immer ausgeben
	logger.Printf("config: env=%s cors_origins=%s jwt_secret_len=%d",
		env,
		fmt.Sprintf("%v", NewCORSConfig().AllowedOrigins),
		len(jwtSecret),
	)
}
