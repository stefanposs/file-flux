// Package token definiert die Token-Domain-Entität und das Repository-Interface.
package token

import (
	"context"
	"time"
)

// Token ist die Domain-Entität für ein Agent-Authentifizierungstoken
type Token struct {
	ID          int        `json:"id"`
	AgentID     int        `json:"agent_id"`
	Name        string     `json:"name"`
	Value       string     `json:"value"`
	CreatedAt   time.Time  `json:"created_at"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	LastUsed    *time.Time `json:"last_used,omitempty"`
	Description *string    `json:"description,omitempty"`
}

// Repository definiert die Schnittstelle für Token-Datenzugriff
type Repository interface {
	List(ctx context.Context) ([]Token, error)
	Create(ctx context.Context, token *Token) error
	Delete(ctx context.Context, id int) error
	Validate(ctx context.Context, tokenValue string) (agentID int, err error)
}
