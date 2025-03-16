package jobs

import (
	"time"

	"github.com/google/uuid"
)

// Job repräsentiert einen Datenübertragungsjob
type Job struct {
	ID             uuid.UUID  `gorm:"type:uuid;primary_key;"`
	UserID         string     `gorm:"not null;"`
	Name           string     `gorm:"not null;"`
	Description    string     `gorm:""`
	SourceAgentID  uuid.UUID  `gorm:"type:uuid;"`
	TargetAgentID  uuid.UUID  `gorm:"type:uuid;"`
	SourcePath     string     `gorm:"not null;"`
	TargetPath     string     `gorm:"not null;"`
	Status         string     `gorm:"not null;default:'pending';"`
	UseCompression bool       `gorm:"default:false;"`
	ChunkSize      int        `gorm:"default:1048576;"` // 1MB Standard
	CreatedAt      time.Time  `gorm:"not null;"`
	UpdatedAt      time.Time  `gorm:"not null;"`
	DeletedAt      *time.Time `gorm:"index;"`
}

// JobEvent speichert Events für einen Job
type JobEvent struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key;"`
	JobID     uuid.UUID `gorm:"type:uuid;not null;index;"`
	Type      string    `gorm:"not null;"` // start, progress, complete, error
	Message   string    `gorm:"not null;"`
	Metadata  string    `gorm:"type:jsonb;"`
	CreatedAt time.Time `gorm:"not null;"`
}

// JobStatistics speichert statistische Daten zu Jobs
type JobStatistics struct {
	ID               uuid.UUID `gorm:"type:uuid;primary_key;"`
	JobID            uuid.UUID `gorm:"type:uuid;not null;index;"`
	TotalBytes       int64     `gorm:"default:0;"`
	TransferredBytes int64     `gorm:"default:0;"`
	StartTime        time.Time
	EndTime          *time.Time
	AverageSpeed     int64 `gorm:"default:0;"` // Bytes pro Sekunde
	ErrorCount       int   `gorm:"default:0;"`
	UpdatedAt        time.Time
}

// JobCreateDTO repräsentiert die Daten zum Erstellen eines Jobs
type JobCreateDTO struct {
	Name           string    `json:"name" binding:"required"`
	Description    string    `json:"description"`
	SourceAgentID  uuid.UUID `json:"sourceAgentId" binding:"required"`
	TargetAgentID  uuid.UUID `json:"targetAgentId" binding:"required"`
	SourcePath     string    `json:"sourcePath" binding:"required"`
	TargetPath     string    `json:"targetPath" binding:"required"`
	UseCompression bool      `json:"useCompression"`
	ChunkSize      int       `json:"chunkSize"`
}

// JobUpdateDTO repräsentiert die Daten zum Aktualisieren eines Jobs
type JobUpdateDTO struct {
	Name           string    `json:"name"`
	Description    string    `json:"description"`
	SourceAgentID  uuid.UUID `json:"sourceAgentId"`
	TargetAgentID  uuid.UUID `json:"targetAgentId"`
	SourcePath     string    `json:"sourcePath"`
	TargetPath     string    `json:"targetPath"`
	Status         string    `json:"status"`
	UseCompression bool      `json:"useCompression"`
	ChunkSize      int       `json:"chunkSize"`
}
