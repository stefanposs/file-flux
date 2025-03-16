package jobs

import (
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// Service definiert die Business-Logik für Jobs
type Service interface {
	CreateJob(userID string, dto JobCreateDTO) (*Job, error)
	GetJob(id uuid.UUID) (*Job, error)
	GetUserJobs(userID string) ([]*Job, error)
	UpdateJob(id uuid.UUID, dto JobUpdateDTO) (*Job, error)
	DeleteJob(id uuid.UUID) error
	LogEvent(jobID uuid.UUID, eventType string, message string, metadata string) error
	GetJobEvents(jobID uuid.UUID) ([]*JobEvent, error)
	UpdateJobStatistics(jobID uuid.UUID, bytesTransferred int64, isComplete bool, hasError bool) error
	GetJobStatistics(jobID uuid.UUID) (*JobStatistics, error)
}

// service implementiert das Service Interface
type service struct {
	repo   Repository
	logger *zap.Logger
}

// NewService erstellt einen neuen Job-Service
func NewService(repo Repository, logger *zap.Logger) Service {
	return &service{
		repo:   repo,
		logger: logger,
	}
}

// CreateJob erstellt einen neuen Job
func (s *service) CreateJob(userID string, dto JobCreateDTO) (*Job, error) {
	job := &Job{
		ID:             uuid.New(),
		UserID:         userID,
		Name:           dto.Name,
		Description:    dto.Description,
		SourceAgentID:  dto.SourceAgentID,
		TargetAgentID:  dto.TargetAgentID,
		SourcePath:     dto.SourcePath,
		TargetPath:     dto.TargetPath,
		Status:         "pending",
		UseCompression: dto.UseCompression,
		ChunkSize:      dto.ChunkSize,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	// Standard-Chunk-Größe setzen, falls nicht angegeben
	if job.ChunkSize <= 0 {
		job.ChunkSize = 1048576 // 1MB Standard
	}

	if err := s.repo.Create(job); err != nil {
		s.logger.Error("Fehler beim Erstellen eines Jobs",
			zap.Error(err),
			zap.String("userID", userID),
			zap.String("jobName", dto.Name))
		return nil, err
	}

	s.logger.Info("Job erstellt",
		zap.String("jobID", job.ID.String()),
		zap.String("userID", userID))

	// Initialen Status als Event loggen
	_ = s.LogEvent(job.ID, "created", "Job erstellt", "{}")

	return job, nil
}

// GetJob gibt einen Job anhand der ID zurück
func (s *service) GetJob(id uuid.UUID) (*Job, error) {
	job, err := s.repo.FindByID(id)
	if err != nil {
		s.logger.Error("Fehler beim Abrufen eines Jobs", zap.Error(err), zap.String("jobID", id.String()))
		return nil, err
	}
	return job, nil
}

// GetUserJobs gibt alle Jobs eines Benutzers zurück
func (s *service) GetUserJobs(userID string) ([]*Job, error) {
	jobs, err := s.repo.FindByUserID(userID)
	if err != nil {
		s.logger.Error("Fehler beim Abrufen von Benutzer-Jobs", zap.Error(err), zap.String("userID", userID))
		return nil, err
	}
	return jobs, nil
}

// UpdateJob aktualisiert einen Job
func (s *service) UpdateJob(id uuid.UUID, dto JobUpdateDTO) (*Job, error) {
	job, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}

	// Nur definierte Felder aktualisieren
	if dto.Name != "" {
		job.Name = dto.Name
	}
	if dto.Description != "" {
		job.Description = dto.Description
	}
	if dto.SourcePath != "" {
		job.SourcePath = dto.SourcePath
	}
	if dto.TargetPath != "" {
		job.TargetPath = dto.TargetPath
	}
	if dto.Status != "" {
		oldStatus := job.Status
		job.Status = dto.Status

		// Status-Änderung als Event loggen
		_ = s.LogEvent(job.ID, "status_changed",
			"Status geändert von "+oldStatus+" zu "+dto.Status, "{}")
	}
	if dto.SourceAgentID != uuid.Nil {
		job.SourceAgentID = dto.SourceAgentID
	}
	if dto.TargetAgentID != uuid.Nil {
		job.TargetAgentID = dto.TargetAgentID
	}

	job.UseCompression = dto.UseCompression

	if dto.ChunkSize > 0 {
		job.ChunkSize = dto.ChunkSize
	}

	job.UpdatedAt = time.Now()

	if err := s.repo.Update(job); err != nil {
		s.logger.Error("Fehler beim Aktualisieren eines Jobs",
			zap.Error(err),
			zap.String("jobID", id.String()))
		return nil, err
	}

	s.logger.Info("Job aktualisiert", zap.String("jobID", id.String()))
	return job, nil
}

// DeleteJob löscht einen Job
func (s *service) DeleteJob(id uuid.UUID) error {
	if err := s.repo.Delete(id); err != nil {
		s.logger.Error("Fehler beim Löschen eines Jobs",
			zap.Error(err),
			zap.String("jobID", id.String()))
		return err
	}

	s.logger.Info("Job gelöscht", zap.String("jobID", id.String()))
	return nil
}

// LogEvent erstellt ein Event für einen Job
func (s *service) LogEvent(jobID uuid.UUID, eventType string, message string, metadata string) error {
	event := &JobEvent{
		ID:        uuid.New(),
		JobID:     jobID,
		Type:      eventType,
		Message:   message,
		Metadata:  metadata,
		CreatedAt: time.Now(),
	}

	if err := s.repo.CreateEvent(event); err != nil {
		s.logger.Error("Fehler beim Erstellen eines Job-Events",
			zap.Error(err),
			zap.String("jobID", jobID.String()),
			zap.String("eventType", eventType))
		return err
	}

	return nil
}

// GetJobEvents gibt Events für einen Job zurück
func (s *service) GetJobEvents(jobID uuid.UUID) ([]*JobEvent, error) {
	events, err := s.repo.GetEvents(jobID)
	if err != nil {
		s.logger.Error("Fehler beim Abrufen von Job-Events",
			zap.Error(err),
			zap.String("jobID", jobID.String()))
		return nil, err
	}
	return events, nil
}

// UpdateJobStatistics aktualisiert die Statistiken für einen Job
func (s *service) UpdateJobStatistics(jobID uuid.UUID, bytesTransferred int64, isComplete bool, hasError bool) error {
	stats, err := s.repo.GetStatistics(jobID)
	if err != nil {
		// Wenn keine Statistiken gefunden werden, neue erstellen
		now := time.Now()
		stats = &JobStatistics{
			JobID:            jobID,
			TransferredBytes: bytesTransferred,
			StartTime:        now,
			UpdatedAt:        now,
		}
	} else {
		// Vorhandene Statistiken aktualisieren
		stats.TransferredBytes += bytesTransferred
		stats.UpdatedAt = time.Now()

		// Bei Fehlern Fehlerzähler erhöhen
		if hasError {
			stats.ErrorCount++
		}

		// Bei Abschluss die Endzeit setzen
		if isComplete {
			endTime := time.Now()
			stats.EndTime = &endTime

			// Durchschnittliche Geschwindigkeit berechnen, wenn genügend Zeit vergangen ist
			durationSeconds := endTime.Sub(stats.StartTime).Seconds()
			if durationSeconds > 0 {
				stats.AverageSpeed = int64(float64(stats.TransferredBytes) / durationSeconds)
			}
		}
	}

	if err := s.repo.UpdateStatistics(stats); err != nil {
		s.logger.Error("Fehler beim Aktualisieren der Job-Statistiken",
			zap.Error(err),
			zap.String("jobID", jobID.String()))
		return err
	}

	return nil
}

// GetJobStatistics gibt die Statistiken für einen Job zurück
func (s *service) GetJobStatistics(jobID uuid.UUID) (*JobStatistics, error) {
	stats, err := s.repo.GetStatistics(jobID)
	if err != nil {
		s.logger.Error("Fehler beim Abrufen der Job-Statistiken",
			zap.Error(err),
			zap.String("jobID", jobID.String()))
		return nil, err
	}
	return stats, nil
}
