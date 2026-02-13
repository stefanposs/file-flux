// Package transfer implementiert den Transfer-Service der Application-Schicht.
package transfer

import (
	"context"
	"errors"
	"time"

	"github.com/stefanposs/file-flux/backend/domain/common"
	"github.com/stefanposs/file-flux/backend/domain/transfer"
)

// Service implementiert die Transfer-Geschaeftslogik.
type Service struct {
	transfers transfer.Repository
}

// NewService erstellt einen neuen TransferService.
func NewService(transfers transfer.Repository) *Service {
	return &Service{transfers: transfers}
}

// ListByUser gibt alle Transfers eines Benutzers zurueck.
func (s *Service) ListByUser(ctx context.Context, userID int) ([]transfer.Transfer, error) {
	return s.transfers.ListByUser(ctx, userID)
}

// GetByID gibt einen einzelnen Transfer zurueck.
func (s *Service) GetByID(ctx context.Context, id int) (*transfer.Transfer, error) {
	t, err := s.transfers.GetByID(ctx, id)
	if err != nil {
		return nil, common.ErrNotFound
	}
	return t, nil
}

// GetByIDForUser gibt einen Transfer zurueck, der dem Benutzer gehoert.
func (s *Service) GetByIDForUser(ctx context.Context, id int, userID int) (*transfer.Transfer, error) {
	t, err := s.transfers.GetByIDForUser(ctx, id, userID)
	if err != nil {
		return nil, common.ErrNotFound
	}
	return t, nil
}

// Create erstellt einen neuen Transfer.
func (s *Service) Create(ctx context.Context, t *transfer.Transfer) error {
	if t.Filename == "" {
		return errors.Join(common.ErrValidation, errors.New("filename is required"))
	}
	if t.SourcePath == "" || t.DestinationPath == "" {
		return errors.Join(common.ErrValidation, errors.New("source and destination paths are required"))
	}
	t.Status = transfer.StatusPending
	t.StartTime = time.Now()
	return s.transfers.Create(ctx, t)
}

// Cancel bricht einen laufenden oder ausstehenden Transfer ab.
func (s *Service) Cancel(ctx context.Context, id int) error {
	t, err := s.transfers.GetByID(ctx, id)
	if err != nil {
		return common.ErrNotFound
	}
	if t.Status == transfer.StatusCompleted || t.Status == transfer.StatusFailed {
		return errors.Join(common.ErrValidation, errors.New("cannot cancel a completed or failed transfer"))
	}
	return s.transfers.UpdateStatus(ctx, id, transfer.StatusFailed, "cancelled by user")
}

// UpdateStatus aktualisiert den Status eines Transfers.
func (s *Service) UpdateStatus(ctx context.Context, id int, status transfer.Status, errorMsg string) error {
	validStatuses := map[transfer.Status]bool{
		transfer.StatusPending:   true,
		transfer.StatusRunning:   true,
		transfer.StatusCompleted: true,
		transfer.StatusFailed:    true,
	}
	if !validStatuses[status] {
		return errors.Join(common.ErrValidation, errors.New("invalid transfer status"))
	}
	return s.transfers.UpdateStatus(ctx, id, status, errorMsg)
}
