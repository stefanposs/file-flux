package models

import (
	"time"
)

// JobType definiert den Typ eines Jobs (Push/Pull)
type JobType string

const (
	JobTypePush JobType = "push" // Upload vom Quell-Agent zum Ziel
	JobTypePull JobType = "pull" // Download vom Quell-Agent zum Ziel
)

// JobStatus definiert den Status eines Jobs
type JobStatus string

const (
	JobStatusActive   JobStatus = "active"
	JobStatusInactive JobStatus = "inactive"
	JobStatusError    JobStatus = "error"
	JobStatusPaused   JobStatus = "paused"
)

// Job repräsentiert einen Datentransfer-Job
type Job struct {
	ID                 int        `json:"id" db:"id"`
	UserID             int        `json:"user_id" db:"user_id"`
	Name               string     `json:"name" db:"name"`
	Type               JobType    `json:"type" db:"type"`
	Status             JobStatus  `json:"status" db:"status"`
	Schedule           *string    `json:"schedule" db:"schedule"`
	SourcePath         string     `json:"source_path" db:"source_path"`
	DestinationPath    string     `json:"destination_path" db:"destination_path"`
	SourceAgentID      int        `json:"source_agent_id" db:"source_agent_id"`
	DestinationAgentID int        `json:"destination_agent_id" db:"destination_agent_id"`
	LastRun            *time.Time `json:"last_run" db:"last_run"`
	NextRun            *time.Time `json:"next_run" db:"next_run"`
	Description        *string    `json:"description" db:"description"`
	CreatedAt          time.Time  `json:"created_at" db:"created_at"`
}
