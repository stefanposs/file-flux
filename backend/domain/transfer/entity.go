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
	ID                 int        `json:"id"`
	JobID              *int       `json:"job_id,omitempty"`
	Filename           string     `json:"filename"`
	Size               int64      `json:"size"`
	Status             Status     `json:"status"`
	Progress           float64    `json:"progress"`
	SourcePath         string     `json:"source_path"`
	DestinationPath    string     `json:"destination_path"`
	SourceAgentID      *int       `json:"source_agent_id,omitempty"`
	DestinationAgentID *int       `json:"destination_agent_id,omitempty"`
	StartTime          time.Time  `json:"start_time"`
	EndTime            *time.Time `json:"end_time,omitempty"`
	Error              *string    `json:"error,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
}

// Repository definiert die Schnittstelle für Transfer-Datenzugriff
type Repository interface {
	ListByUser(ctx context.Context, userID int) ([]Transfer, error)
	GetByID(ctx context.Context, id int) (*Transfer, error)
	Create(ctx context.Context, transfer *Transfer) error
	UpdateStatus(ctx context.Context, id int, status Status, errorMsg string) error
	UpdateProgress(ctx context.Context, id int, progress float64) error
}
