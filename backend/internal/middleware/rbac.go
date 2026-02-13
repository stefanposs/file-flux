package middleware

import (
	"net/http"
)

// RequireRole gibt eine Middleware zurueck, die prüft ob der Benutzer
// eine der angegebenen Rollen hat. Muss NACH Auth() verwendet werden.
func RequireRole(roles ...string) func(http.Handler) http.Handler {
	roleSet := make(map[string]bool, len(roles))
	for _, r := range roles {
		roleSet[r] = true
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role, ok := r.Context().Value(UserRoleKey).(string)
			if !ok || !roleSet[role] {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusForbidden)
				w.Write([]byte(`{"error":"insufficient permissions","code":"FORBIDDEN"}`))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// AdminOnly ist ein Shortcut fuer RequireRole("admin").
func AdminOnly(next http.Handler) http.Handler {
	return RequireRole("admin")(next)
}
