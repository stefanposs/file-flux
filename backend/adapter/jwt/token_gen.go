// Package jwtadapter implementiert den TokenGenerator fuer die Auth-Application-Schicht.
package jwtadapter

import (
	authsvc "github.com/stefanposs/file-flux/backend/application/auth"
	"github.com/stefanposs/file-flux/backend/internal/middleware"
)

// TokenGen implementiert authsvc.TokenGenerator mittels des JWT-Middleware-Pakets.
type TokenGen struct{}

// New erstellt einen neuen TokenGen.
func New() *TokenGen {
	return &TokenGen{}
}

var _ authsvc.TokenGenerator = (*TokenGen)(nil)

// Generate erstellt ein JWT-Token.
func (t *TokenGen) Generate(userID int, role string, expiresInHours int) (string, error) {
	return middleware.GenerateToken(userID, role, expiresInHours)
}
