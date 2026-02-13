package middleware

import (
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

func TestSecureHeaders(t *testing.T) {
	handler := SecureHeaders(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Header().Get("Strict-Transport-Security") == "" {
		t.Error("Expected Strict-Transport-Security header")
	}
}

func TestCORSWithConfig_AllowAll(t *testing.T) {
	cfg := CORSConfig{AllowedOrigins: []string{"*"}}
	handler := CORSWithConfig(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Origin", "https://example.com")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Errorf("Expected CORS origin '*', got '%s'", rr.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestCORSWithConfig_SpecificOrigin(t *testing.T) {
	cfg := CORSConfig{AllowedOrigins: []string{"https://app.fileflux.de"}}
	handler := CORSWithConfig(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// Allowed origin
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Origin", "https://app.fileflux.de")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Header().Get("Access-Control-Allow-Origin") != "https://app.fileflux.de" {
		t.Errorf("Expected allowed origin, got '%s'", rr.Header().Get("Access-Control-Allow-Origin"))
	}

	// Disallowed origin
	req2 := httptest.NewRequest("GET", "/test", nil)
	req2.Header.Set("Origin", "https://evil.com")
	rr2 := httptest.NewRecorder()
	handler.ServeHTTP(rr2, req2)

	if rr2.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Errorf("Expected no CORS origin for evil.com, got '%s'", rr2.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestCORSWithConfig_Preflight(t *testing.T) {
	cfg := CORSConfig{AllowedOrigins: []string{"*"}}
	handler := CORSWithConfig(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("Handler should not be called for OPTIONS")
	}))

	req := httptest.NewRequest("OPTIONS", "/test", nil)
	req.Header.Set("Origin", "https://app.fileflux.de")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Errorf("Expected 204 for preflight, got %d", rr.Code)
	}
}

func TestCORSWithConfig_SecurityHeaders(t *testing.T) {
	cfg := CORSConfig{AllowedOrigins: []string{"*"}}
	handler := CORSWithConfig(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	expectedHeaders := map[string]string{
		"X-Content-Type-Options": "nosniff",
		"X-Frame-Options":        "DENY",
		"X-XSS-Protection":       "1; mode=block",
		"Referrer-Policy":        "strict-origin-when-cross-origin",
	}

	for key, expected := range expectedHeaders {
		got := rr.Header().Get(key)
		if got != expected {
			t.Errorf("Header %s: expected '%s', got '%s'", key, expected, got)
		}
	}
}

func TestRequestID_AddedToResponse(t *testing.T) {
	handler := RequestID(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reqID, _ := r.Context().Value(RequestIDKey).(string)
		if reqID == "" {
			t.Error("Expected request ID in context")
		}
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Header().Get("X-Request-ID") == "" {
		t.Error("Expected X-Request-ID response header")
	}
}

func TestRequestID_UseExisting(t *testing.T) {
	handler := RequestID(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reqID, _ := r.Context().Value(RequestIDKey).(string)
		if reqID != "custom-id-123" {
			t.Errorf("Expected custom request ID, got '%s'", reqID)
		}
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("X-Request-ID", "custom-id-123")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Header().Get("X-Request-ID") != "custom-id-123" {
		t.Errorf("Expected forwarded request ID, got '%s'", rr.Header().Get("X-Request-ID"))
	}
}

func TestStatusResponseWriter_CapturesCode(t *testing.T) {
	w := httptest.NewRecorder()
	sw := &statusResponseWriter{ResponseWriter: w, statusCode: http.StatusOK}

	sw.WriteHeader(http.StatusNotFound)
	if sw.statusCode != http.StatusNotFound {
		t.Errorf("Expected statusCode 404, got %d", sw.statusCode)
	}

	// Second WriteHeader should be ignored
	sw.WriteHeader(http.StatusInternalServerError)
	if sw.statusCode != http.StatusNotFound {
		t.Errorf("Double WriteHeader should be ignored, got %d", sw.statusCode)
	}
}

func TestRecoverMiddleware_CatchesPanic(t *testing.T) {
	logger := log.New(os.Stderr, "", 0)
	handler := Recover(logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("test panic!")
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	rr := httptest.NewRecorder()

	// Should not panic
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusInternalServerError {
		t.Errorf("Expected 500 after panic, got %d", rr.Code)
	}

	if !strings.Contains(rr.Body.String(), "internal server error") {
		t.Error("Expected error message in response body")
	}
}
