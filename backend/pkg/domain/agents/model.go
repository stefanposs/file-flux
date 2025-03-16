package agents

import (
	"time"

	"github.com/google/uuid"
)

// Agent repräsentiert einen Dateiübertragungs-Agenten
type Agent struct {
	ID           uuid.UUID `gorm:"type:uuid;primary_key;"`
	UserID       string    `gorm:"not null;"`
	Name         string    `gorm:"not null;"`
	Description  string    `gorm:""`
	Token        string    `gorm:"not null;"`
	Status       string    `gorm:"not null;default:'offline';"`
	Type         string    `gorm:"not null;"` // source, target
	LastSeen     *time.Time
	Version      string     `gorm:""`
	OS           string     `gorm:""`
	Architecture string     `gorm:""`
	CreatedAt    time.Time  `gorm:"not null;"`
	UpdatedAt    time.Time  `gorm:"not null;"`
	DeletedAt    *time.Time `gorm:"index;"`
}

// AgentHeartbeat repräsentiert die Daten eines Heartbeat-Signals vom Agenten
type AgentHeartbeat struct {
	AgentID  uuid.UUID `json:"agentId" binding:"required"`
	Status   string    `json:"status" binding:"required"`
	Hostname string    `json:"hostname"`
	Version  string    `json:"version"`
}

// AgentCommand repräsentiert einen Befehl, der an einen Agenten gesendet wird
type AgentCommand struct {
	ID         uuid.UUID `gorm:"type:uuid;primary_key;"`
	AgentID    uuid.UUID `gorm:"type:uuid;not null;index;"`
	Type       string    `gorm:"not null;"` // start_job, stop_job, update_config, etc.
	Payload    string    `gorm:"type:jsonb;"`
	Status     string    `gorm:"not null;default:'pending';"`
	CreatedAt  time.Time `gorm:"not null;"`
	UpdatedAt  time.Time `gorm:"not null;"`
	ExecutedAt *time.Time
}

// AgentRegistrationDTO enthält die Daten zur Registrierung eines Agenten
type AgentRegistrationDTO struct {
	Name         string `json:"name" binding:"required"`
	Description  string `json:"description"`
	Type         string `json:"type" binding:"required"`
	OS           string `json:"os"`
	Architecture string `json:"architecture"`
	Version      string `json:"version"`
}

// AgentUpdateDTO enthält die Daten zur Aktualisierung eines Agenten
type AgentUpdateDTO struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Status      string `json:"status"`
}

// AgentCommandDTO repräsentiert die Daten zum Erstellen eines Befehls
type AgentCommandDTO struct {
	Type    string `json:"type" binding:"required"`
	Payload string `json:"payload" binding:"required"`
}
