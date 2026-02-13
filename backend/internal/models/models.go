package models

import (
	"errors"
	"time"
)

// Fehlerdefinitionen
var (
	ErrAgentNotConnected = errors.New("agent not connected")
	ErrAgentChannelFull  = errors.New("agent channel full")
	ErrNotFound          = errors.New("not found")
	ErrUnauthorized      = errors.New("unauthorized")
)

// Agent repräsentiert einen Agenten im System
type Agent struct {
	ID          int        `json:"id"`
	Name        string     `json:"name"`
	Type        string     `json:"type"`
	Status      string     `json:"status"`
	IPAddress   *string    `json:"ip_address"`
	System      *string    `json:"system"`
	Version     *string    `json:"version"`
	LastSeen    *time.Time `json:"last_seen"`
	Description *string    `json:"description"`
	CreatedAt   time.Time  `json:"created_at"`
}

// Token repräsentiert ein Agent-Authentifizierungstoken
type Token struct {
	ID          int        `json:"id"`
	AgentID     int        `json:"agent_id"`
	Name        string     `json:"name"`
	TokenValue  string     `json:"token_value,omitempty"` // Nur beim Erstellen ausgeben
	CreatedAt   time.Time  `json:"created_at"`
	ExpiresAt   *time.Time `json:"expires_at"`
	LastUsed    *time.Time `json:"last_used"`
	Description *string    `json:"description"`
}
