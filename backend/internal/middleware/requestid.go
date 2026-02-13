package middleware

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"
)

// RequestIDKey ist der Context-Key fuer die Request-ID.
const RequestIDKey contextKey = "request_id"

// RequestID generiert eine eindeutige ID pro Request und setzt sie
// als Header und im Context. Ermoeglicht Request-Tracing.
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Bestehende ID vom Proxy uebernehmen oder neue generieren
		id := r.Header.Get("X-Request-ID")
		if id == "" {
			id = generateRequestID()
		}

		// Im Response-Header setzen fuer Client-Tracing
		w.Header().Set("X-Request-ID", id)

		// Im Context speichern fuer Logging
		ctx := context.WithValue(r.Context(), RequestIDKey, id)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func generateRequestID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}
