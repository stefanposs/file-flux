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
	ID                 int
	UserID             int
	Name               string
	Type               Type
	Status             Status
	Schedule           *string
	SourcePath         string
	DestinationPath    string
	SourceAgentID      int
	DestinationAgentID int
	LastRun            *time.Time
	NextRun            *time.Time
	Description        *string
	CreatedAt          time.Time
}

// Repository definiert die Schnittstelle für Job-Datenzugriff
type Repository interface {
	ListByUser(ctx context.Context, userID int) ([]Job, error)
	GetByID(ctx context.Context, id int) (*Job, error)
	Create(ctx context.Context, job *Job) error
	Update(ctx context.Context, job *Job) error
	Delete(ctx context.Context, id int) error
	CountByUser(ctx context.Context, userID int) (int, error)
}
