package middleware

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// contextKey ist ein benutzerdefinierter Typ für Context-Keys
type contextKey string

const (
	// UserIDKey ist der Context-Key für die Benutzer-ID
	UserIDKey contextKey = "user_id"
	// UserRoleKey ist der Context-Key für die Benutzer-Rolle
	UserRoleKey contextKey = "user_role"
)

// JWTSecret wird beim Start aus der Konfiguration gesetzt
var JWTSecret []byte

// Claims definiert die JWT-Claims
type Claims struct {
	UserID int    `json:"user_id"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

// SetJWTSecret setzt das JWT-Secret (aufgerufen beim Server-Start)
func SetJWTSecret(secret string) {
	JWTSecret = []byte(secret)
}

// GenerateToken erstellt ein neues JWT-Token für einen Benutzer
func GenerateToken(userID int, role string, expiresInHours int) (string, error) {
	claims := Claims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(expiresInHours) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "fileflux",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(JWTSecret)
}

// Auth überprüft die JWT-Authentifizierung
func Auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Authorization-Header extrahieren
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Authorization header fehlt", http.StatusUnauthorized)
			return
		}

		// Bearer-Prefix entfernen
		if !strings.HasPrefix(authHeader, "Bearer ") {
			http.Error(w, "Ungültiges Token-Format", http.StatusUnauthorized)
			return
		}
		tokenString := strings.TrimPrefix(authHeader, "Bearer ")

		// Token parsen und validieren
		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			// Sicherstellen, dass die Signaturmethode korrekt ist
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return JWTSecret, nil
		})

		if err != nil || !token.Valid {
			http.Error(w, "Ungültiges oder abgelaufenes Token", http.StatusUnauthorized)
			return
		}

		// Benutzer-ID und Rolle im Context speichern
		ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
		ctx = context.WithValue(ctx, UserRoleKey, claims.Role)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
