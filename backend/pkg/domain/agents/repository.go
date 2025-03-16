package agents

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Repository definiert die Datenzugriffsmethoden für Agents
type Repository interface {
	Create(agent *Agent) error
	FindByID(id uuid.UUID) (*Agent, error)
	FindByUserID(userID string) ([]*Agent, error)
	Update(agent *Agent) error
	Delete(id uuid.UUID) error
	UpdateLastSeen(id uuid.UUID, status string) error

	// Befehle
	CreateCommand(command *AgentCommand) error
	GetPendingCommands(agentID uuid.UUID) ([]*AgentCommand, error)
	UpdateCommandStatus(id uuid.UUID, status string, executedAt *time.Time) error
}

// repository implementiert das Repository Interface
type repository struct {
	db *gorm.DB
}

// NewRepository erstellt ein neues Agent-Repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db}
}

// Create erstellt einen neuen Agenten
func (r *repository) Create(agent *Agent) error {
	if agent.ID == uuid.Nil {
		agent.ID = uuid.New()
	}
	return r.db.Create(agent).Error
}

// FindByID sucht einen Agenten anhand seiner ID
func (r *repository) FindByID(id uuid.UUID) (*Agent, error) {
	var agent Agent
	err := r.db.First(&agent, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("agent nicht gefunden")
		}
		return nil, err
	}
	return &agent, nil
}

// FindByUserID gibt alle Agenten eines Benutzers zurück
func (r *repository) FindByUserID(userID string) ([]*Agent, error) {
	var agents []*Agent
	err := r.db.Where("user_id = ?", userID).Find(&agents).Error
	return agents, err
}

// Update aktualisiert einen Agenten
func (r *repository) Update(agent *Agent) error {
	return r.db.Save(agent).Error
}

// Delete löscht einen Agenten
func (r *repository) Delete(id uuid.UUID) error {
	return r.db.Delete(&Agent{}, "id = ?", id).Error
}

// UpdateLastSeen aktualisiert den LastSeen-Zeitstempel und Status eines Agenten
func (r *repository) UpdateLastSeen(id uuid.UUID, status string) error {
	now := time.Now()
	return r.db.Model(&Agent{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"last_seen":  now,
			"status":     status,
			"updated_at": now,
		}).Error
}

// CreateCommand erstellt einen neuen Agenten-Befehl
func (r *repository) CreateCommand(command *AgentCommand) error {
	if command.ID == uuid.Nil {
		command.ID = uuid.New()
	}
	command.CreatedAt = time.Now()
	command.UpdatedAt = time.Now()
	command.Status = "pending"

	return r.db.Create(command).Error
}

// GetPendingCommands gibt alle ausstehenden Befehle für einen Agenten zurück
func (r *repository) GetPendingCommands(agentID uuid.UUID) ([]*AgentCommand, error) {
	var commands []*AgentCommand
	err := r.db.Where("agent_id = ? AND status = 'pending'", agentID).
		Order("created_at").
		Find(&commands).Error
	return commands, err
}

// UpdateCommandStatus aktualisiert den Status eines Befehls
func (r *repository) UpdateCommandStatus(id uuid.UUID, status string, executedAt *time.Time) error {
	updates := map[string]interface{}{
		"status":     status,
		"updated_at": time.Now(),
	}

	if executedAt != nil {
		updates["executed_at"] = executedAt
	}

	return r.db.Model(&AgentCommand{}).
		Where("id = ?", id).
		Updates(updates).Error
}
