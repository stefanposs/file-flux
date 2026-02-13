// Package agent implementiert den Agent-Service der Application-Schicht.
package agent

import (
	"context"
	"errors"

	"github.com/stefanposs/file-flux/backend/domain/agent"
	"github.com/stefanposs/file-flux/backend/domain/common"
)

// ConnectionChecker prueft, ob ein Agent ueber WebSocket verbunden ist.
type ConnectionChecker interface {
	IsConnected(agentID int) bool
}

// Service implementiert die Agent-Geschaeftslogik.
type Service struct {
	agents    agent.Repository
	connCheck ConnectionChecker
}

// NewService erstellt einen neuen AgentService.
func NewService(agents agent.Repository, connCheck ConnectionChecker) *Service {
	return &Service{
		agents:    agents,
		connCheck: connCheck,
	}
}

// List gibt alle Agenten zurueck.
func (s *Service) List(ctx context.Context) ([]agent.Agent, error) {
	return s.agents.List(ctx)
}

// GetByID gibt einen einzelnen Agenten zurueck.
func (s *Service) GetByID(ctx context.Context, id int) (*agent.Agent, error) {
	a, err := s.agents.GetByID(ctx, id)
	if err != nil {
		return nil, common.ErrNotFound
	}
	return a, nil
}

// Create erstellt einen neuen Agenten.
func (s *Service) Create(ctx context.Context, a *agent.Agent) error {
	if a.Name == "" {
		return errors.Join(common.ErrValidation, errors.New("agent name is required"))
	}
	if a.Type == "" {
		a.Type = "server"
	}
	a.Status = "offline"
	return s.agents.Create(ctx, a)
}

// Update aktualisiert einen Agenten.
func (s *Service) Update(ctx context.Context, a *agent.Agent) error {
	if a.Name == "" {
		return errors.Join(common.ErrValidation, errors.New("agent name is required"))
	}
	return s.agents.Update(ctx, a)
}

// Delete loescht einen Agenten.
func (s *Service) Delete(ctx context.Context, id int) error {
	return s.agents.Delete(ctx, id)
}

// TestConnection prueft, ob ein Agent erreichbar ist.
func (s *Service) TestConnection(ctx context.Context, id int) (bool, error) {
	_, err := s.agents.GetByID(ctx, id)
	if err != nil {
		return false, common.ErrNotFound
	}
	return s.connCheck.IsConnected(id), nil
}

// UpdateStatus aktualisiert den Status eines Agenten.
func (s *Service) UpdateStatus(ctx context.Context, id int, status string) error {
	validStatuses := map[string]bool{"online": true, "offline": true, "error": true}
	if !validStatuses[status] {
		return errors.Join(common.ErrValidation, errors.New("invalid status: must be online, offline or error"))
	}
	return s.agents.UpdateStatus(ctx, id, status)
}
