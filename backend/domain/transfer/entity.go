// Package transfer definiert die Transfer-Domain-Entität und das Repository-Interface.
package transfer

import (
	"context"
	"time"
)

// Status definiert den Status eines Transfers
type Status string

const (
	StatusPending   Status = "pending"
	StatusRunning   Status = "running"
	StatusCompleted Status = "completed"
	StatusFailed    Status = "failed"
)

// Transfer ist die Domain-Entität für eine einzelne Dateiübertragung
type Transfer struct {
	ID                 int
	JobID              *int
	Filename           string
	Size               int64
	Status             Status
	SourcePath         string
	DestinationPath    string
	SourceAgentID      *int
	DestinationAgentID *int
	StartTime          time.Time
	EndTime            *time.Time
	Error              *string
	CreatedAt          time.Time
}

// Repository definiert die Schnittstelle für Transfer-Datenzugriff
type Repository interface {
	ListByUser(ctx context.Context, userID int) ([]Transfer, error)
	GetByID(ctx context.Context, id int) (*Transfer, error)
	Create(ctx context.Context, transfer *Transfer) error
	UpdateStatus(ctx context.Context, id int, status Status, errorMsg string) error
}
