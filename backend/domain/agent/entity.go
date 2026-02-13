// Package agent definiert die Agent-Domain-Entität und das Repository-Interface.
package agent

import (
	"context"
	"time"
)

// Agent ist die Domain-Entität für einen Agenten
type Agent struct {
	ID          int
	Name        string
	Type        string // "server", "client"
	Status      string // "online", "offline", "error"
	IPAddress   *string
	System      *string
	Version     *string
	LastSeen    *time.Time
	Description *string
	CreatedAt   time.Time
}

// Repository definiert die Schnittstelle für Agent-Datenzugriff
type Repository interface {
	List(ctx context.Context) ([]Agent, error)
	GetByID(ctx context.Context, id int) (*Agent, error)
	Create(ctx context.Context, agent *Agent) error
	Update(ctx context.Context, agent *Agent) error
	UpdateStatus(ctx context.Context, id int, status string) error
	Delete(ctx context.Context, id int) error
}
