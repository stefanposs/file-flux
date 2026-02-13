// Package job definiert die Job-Domain-Entität und das Repository-Interface.
package job

import (
	"context"
	"time"
)

// Type definiert den Typ eines Jobs
type Type string

const (
	TypePush Type = "push"
	TypePull Type = "pull"
)

// Status definiert den Status eines Jobs
type Status string

const (
	StatusActive   Status = "active"
	StatusInactive Status = "inactive"
	StatusError    Status = "error"
	StatusPaused   Status = "paused"
)

// Job ist die Domain-Entität für einen Datentransfer-Job
type Job struct {
	ID                 int        `json:"id"`
	UserID             int        `json:"user_id"`
	Name               string     `json:"name"`
	Type               Type       `json:"type"`
	Status             Status     `json:"status"`
	Schedule           *string    `json:"schedule,omitempty"`
	SourcePath         string     `json:"source_path"`
	DestinationPath    string     `json:"destination_path"`
	SourceAgentID      int        `json:"source_agent_id"`
	DestinationAgentID int        `json:"destination_agent_id"`
	LastRun            *time.Time `json:"last_run,omitempty"`
	NextRun            *time.Time `json:"next_run,omitempty"`
	Description        *string    `json:"description,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
}

// Repository definiert die Schnittstelle für Job-Datenzugriff
type Repository interface {
	ListByUser(ctx context.Context, userID int) ([]Job, error)
	GetByID(ctx context.Context, id int) (*Job, error)
	Create(ctx context.Context, job *Job) error
	Update(ctx context.Context, job *Job) error
	Delete(ctx context.Context, id int) error
	CountByUser(ctx context.Context, userID int) (int, error)
	ListActive(ctx context.Context) ([]Job, error)
}
