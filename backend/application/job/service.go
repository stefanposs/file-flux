// Package job implementiert den Job-Service der Application-Schicht.
package job

import (
	"context"
	"errors"

	"github.com/stefanposs/file-flux/backend/domain/common"
	"github.com/stefanposs/file-flux/backend/domain/job"
)

// Service implementiert die Job-Geschaeftslogik.
type Service struct {
	jobs job.Repository
}

// NewService erstellt einen neuen JobService.
func NewService(jobs job.Repository) *Service {
	return &Service{jobs: jobs}
}

// ListByUser gibt alle Jobs eines Benutzers zurueck.
func (s *Service) ListByUser(ctx context.Context, userID int) ([]job.Job, error) {
	return s.jobs.ListByUser(ctx, userID)
}

// GetByID gibt einen einzelnen Job zurueck.
func (s *Service) GetByID(ctx context.Context, id int) (*job.Job, error) {
	j, err := s.jobs.GetByID(ctx, id)
	if err != nil {
		return nil, common.ErrNotFound
	}
	return j, nil
}

// Create erstellt einen neuen Job.
func (s *Service) Create(ctx context.Context, j *job.Job) error {
	if j.Name == "" {
		return errors.Join(common.ErrValidation, errors.New("job name is required"))
	}
	if j.SourcePath == "" || j.DestinationPath == "" {
		return errors.Join(common.ErrValidation, errors.New("source and destination paths are required"))
	}
	if j.SourceAgentID == 0 || j.DestinationAgentID == 0 {
		return errors.Join(common.ErrValidation, errors.New("source and destination agent IDs are required"))
	}
	if j.Type == "" {
		j.Type = job.TypePush
	}
	j.Status = job.StatusInactive
	return s.jobs.Create(ctx, j)
}

// Update aktualisiert einen Job.
func (s *Service) Update(ctx context.Context, j *job.Job) error {
	if j.Name == "" {
		return errors.Join(common.ErrValidation, errors.New("job name is required"))
	}
	return s.jobs.Update(ctx, j)
}

// Delete loescht einen Job.
func (s *Service) Delete(ctx context.Context, id int) error {
	return s.jobs.Delete(ctx, id)
}

// Activate aktiviert einen Job.
func (s *Service) Activate(ctx context.Context, id int) error {
	j, err := s.jobs.GetByID(ctx, id)
	if err != nil {
		return common.ErrNotFound
	}
	j.Status = job.StatusActive
	return s.jobs.Update(ctx, j)
}

// Pause pausiert einen Job.
func (s *Service) Pause(ctx context.Context, id int) error {
	j, err := s.jobs.GetByID(ctx, id)
	if err != nil {
		return common.ErrNotFound
	}
	j.Status = job.StatusPaused
	return s.jobs.Update(ctx, j)
}

// CountByUser gibt die Anzahl der Jobs eines Benutzers zurueck.
func (s *Service) CountByUser(ctx context.Context, userID int) (int, error) {
	return s.jobs.CountByUser(ctx, userID)
}
