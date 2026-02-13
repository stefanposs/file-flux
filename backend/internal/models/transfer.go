package models

import (
	"time"
)

// TransferStatus definiert den Status eines Transfers
type TransferStatus string

const (
	TransferStatusPending   TransferStatus = "pending"
	TransferStatusRunning   TransferStatus = "running"
	TransferStatusCompleted TransferStatus = "completed"
	TransferStatusFailed    TransferStatus = "failed"
)

// Transfer repräsentiert eine einzelne Dateiübertragung
type Transfer struct {
	ID                 int            `json:"id" db:"id"`
	JobID              *int           `json:"job_id" db:"job_id"`
	Filename           string         `json:"filename" db:"filename"`
	Size               int64          `json:"size" db:"size"`
	Status             TransferStatus `json:"status" db:"status"`
	SourcePath         string         `json:"source_path" db:"source_path"`
	DestinationPath    string         `json:"destination_path" db:"destination_path"`
	SourceAgentID      *int           `json:"source_agent_id" db:"source_agent_id"`
	DestinationAgentID *int           `json:"destination_agent_id" db:"destination_agent_id"`
	StartTime          time.Time      `json:"start_time" db:"start_time"`
	EndTime            *time.Time     `json:"end_time" db:"end_time"`
	Error              *string        `json:"error" db:"error"`
	CreatedAt          time.Time      `json:"created_at" db:"created_at"`
}
