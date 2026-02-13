// Package job implementiert den Job-Service der Application-Schicht.
package job

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"strconv"
	"time"

	"github.com/stefanposs/file-flux/backend/domain/common"
	"github.com/stefanposs/file-flux/backend/domain/job"
	"github.com/stefanposs/file-flux/backend/domain/transfer"
)

// TransferDispatcher sendet Nachrichten an verbundene Agenten.
type TransferDispatcher interface {
	SendToAgent(agentID int, message interface{}) error
}

// TransferCreator erstellt Transfer-Datensaetze.
type TransferCreator interface {
	Create(ctx context.Context, t *transfer.Transfer) error
}

// SchedulerReloader erlaubt dem Service, den Scheduler bei Job-Aenderungen neu zu laden.
type SchedulerReloader interface {
	Reload()
}

// Service implementiert die Job-Geschaeftslogik.
type Service struct {
	jobs       job.Repository
	dispatcher TransferDispatcher
	transfers  TransferCreator
	scheduler  SchedulerReloader
}

// NewService erstellt einen neuen JobService.
func NewService(jobs job.Repository, dispatcher TransferDispatcher, transfers TransferCreator) *Service {
	return &Service{jobs: jobs, dispatcher: dispatcher, transfers: transfers}
}

// SetScheduler setzt den Scheduler (wird nach Initialisierung aufgerufen, um Zirkelabhaengigkeit zu vermeiden).
func (s *Service) SetScheduler(scheduler SchedulerReloader) {
	s.scheduler = scheduler
}

// reloadScheduler laedt den Scheduler neu, falls vorhanden.
func (s *Service) reloadScheduler() {
	if s.scheduler != nil {
		s.scheduler.Reload()
	}
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
	if err := s.jobs.Create(ctx, j); err != nil {
		return err
	}
	s.reloadScheduler()
	return nil
}

// Update aktualisiert einen Job.
func (s *Service) Update(ctx context.Context, j *job.Job) error {
	if j.Name == "" {
		return errors.Join(common.ErrValidation, errors.New("job name is required"))
	}
	if err := s.jobs.Update(ctx, j); err != nil {
		return err
	}
	s.reloadScheduler()
	return nil
}

// Delete loescht einen Job.
func (s *Service) Delete(ctx context.Context, id int) error {
	if err := s.jobs.Delete(ctx, id); err != nil {
		return err
	}
	s.reloadScheduler()
	return nil
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

// Run fuehrt einen Job aus: erstellt einen Transfer und dispatcht ihn an den Quell-Agenten.
func (s *Service) Run(ctx context.Context, id int) error {
	j, err := s.jobs.GetByID(ctx, id)
	if err != nil {
		return common.ErrNotFound
	}

	// Transfer-Datensatz erstellen
	t := &transfer.Transfer{
		JobID:              &j.ID,
		Filename:           filepath.Base(j.SourcePath),
		Status:             transfer.StatusPending,
		SourcePath:         j.SourcePath,
		DestinationPath:    j.DestinationPath,
		SourceAgentID:      &j.SourceAgentID,
		DestinationAgentID: &j.DestinationAgentID,
	}
	if err := s.transfers.Create(ctx, t); err != nil {
		return fmt.Errorf("transfer erstellen: %w", err)
	}

	// TransferRequest-Nachricht an den Quell-Agenten senden
	msg := struct {
		Type string      `json:"type"`
		Data interface{} `json:"data"`
	}{
		Type: "transfer_request",
		Data: struct {
			Transfer struct {
				ID               string `json:"id"`
				JobID            string `json:"job_id"`
				SourcePath       string `json:"source_path"`
				DestinationPath  string `json:"destination_path"`
				Compressed       bool   `json:"compressed"`
				ChunkSize        int    `json:"chunk_size"`
				TransferType     string `json:"transfer_type"`
				DestinationAgent string `json:"destination_agent,omitempty"`
			} `json:"transfer"`
		}{
			Transfer: struct {
				ID               string `json:"id"`
				JobID            string `json:"job_id"`
				SourcePath       string `json:"source_path"`
				DestinationPath  string `json:"destination_path"`
				Compressed       bool   `json:"compressed"`
				ChunkSize        int    `json:"chunk_size"`
				TransferType     string `json:"transfer_type"`
				DestinationAgent string `json:"destination_agent,omitempty"`
			}{
				ID:               strconv.Itoa(t.ID),
				JobID:            strconv.Itoa(j.ID),
				SourcePath:       j.SourcePath,
				DestinationPath:  j.DestinationPath,
				Compressed:       false,
				ChunkSize:        8,
				TransferType:     "upload",
				DestinationAgent: strconv.Itoa(j.DestinationAgentID),
			},
		},
	}

	if err := s.dispatcher.SendToAgent(j.SourceAgentID, msg); err != nil {
		return fmt.Errorf("dispatch an agent %d: %w", j.SourceAgentID, err)
	}

	// Job-Status aktualisieren
	j.Status = job.StatusActive
	now := time.Now()
	j.LastRun = &now
	return s.jobs.Update(ctx, j)
}

// ListActive gibt alle aktiven Jobs mit Schedule zurueck (fuer den Scheduler).
func (s *Service) ListActive(ctx context.Context) ([]job.Job, error) {
	return s.jobs.ListActive(ctx)
}
