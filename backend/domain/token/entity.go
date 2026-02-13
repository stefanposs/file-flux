// Package token definiert die Token-Domain-Entität und das Repository-Interface.
package token

import (
	"context"
	"time"
)

// Token ist die Domain-Entität für ein Agent-Authentifizierungstoken
type Token struct {
	ID          int
	AgentID     int
	Name        string
	Value       string
	CreatedAt   time.Time
	ExpiresAt   *time.Time
	LastUsed    *time.Time
	Description *string
}

// Repository definiert die Schnittstelle für Token-Datenzugriff
type Repository interface {
	List(ctx context.Context) ([]Token, error)
	Create(ctx context.Context, token *Token) error
	Delete(ctx context.Context, id int) error
	Validate(ctx context.Context, tokenValue string) (agentID int, err error)
}
