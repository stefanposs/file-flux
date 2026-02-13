// Package agent definiert die Agent-Domain-Entität und das Repository-Interface.
package agent

import (
	"context"
	"time"
)

// Agent ist die Domain-Entität für einen Agenten
type Agent struct {
	ID          int        `json:"id"`
	Name        string     `json:"name"`
	Type        string     `json:"type"`   // "server", "client"
	Status      string     `json:"status"` // "online", "offline", "error"
	IPAddress   *string    `json:"ip_address,omitempty"`
	System      *string    `json:"system,omitempty"`
	Version     *string    `json:"version,omitempty"`
	LastSeen    *time.Time `json:"last_seen,omitempty"`
	Description *string    `json:"description,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

// Repository definiert die Schnittstelle für Agent-Datenzugriff
type Repository interface {
	List(ctx context.Context) ([]Agent, error)
	GetByID(ctx context.Context, id int) (*Agent, error)
	Create(ctx context.Context, agent *Agent) error
	Update(ctx context.Context, agent *Agent) error
	UpdateInfo(ctx context.Context, id int, system, ipAddress, version string) error
	UpdateStatus(ctx context.Context, id int, status string) error
	Delete(ctx context.Context, id int) error
}
