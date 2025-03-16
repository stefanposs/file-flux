package jobs

import (
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Repository definiert die Datenzugriffsmethoden für Jobs
type Repository interface {
	Create(job *Job) error
	FindByID(id uuid.UUID) (*Job, error)
	FindByUserID(userID string) ([]*Job, error)
	Update(job *Job) error
	Delete(id uuid.UUID) error
	CreateEvent(event *JobEvent) error
	GetEvents(jobID uuid.UUID) ([]*JobEvent, error)
	UpdateStatistics(stats *JobStatistics) error
	GetStatistics(jobID uuid.UUID) (*JobStatistics, error)
}

// repository implementiert das Repository Interface
type repository struct {
	db *gorm.DB
}

// NewRepository erstellt ein neues Job-Repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db}
}

// Create erstellt einen neuen Job
func (r *repository) Create(job *Job) error {
	if job.ID == uuid.Nil {
		job.ID = uuid.New()
	}
	return r.db.Create(job).Error
}

// FindByID sucht einen Job anhand seiner ID
func (r *repository) FindByID(id uuid.UUID) (*Job, error) {
	var job Job
	err := r.db.First(&job, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("job nicht gefunden")
		}
		return nil, err
	}
	return &job, nil
}

// FindByUserID gibt alle Jobs eines Benutzers zurück
func (r *repository) FindByUserID(userID string) ([]*Job, error) {
	var jobs []*Job
	err := r.db.Where("user_id = ?", userID).Find(&jobs).Error
	return jobs, err
}

// Update aktualisiert einen Job
func (r *repository) Update(job *Job) error {
	return r.db.Save(job).Error
}

// Delete löscht einen Job
func (r *repository) Delete(id uuid.UUID) error {
	return r.db.Delete(&Job{}, "id = ?", id).Error
}

// CreateEvent erstellt ein JobEvent
func (r *repository) CreateEvent(event *JobEvent) error {
	if event.ID == uuid.Nil {
		event.ID = uuid.New()
	}
	return r.db.Create(event).Error
}

// GetEvents gibt alle Events für einen Job zurück
func (r *repository) GetEvents(jobID uuid.UUID) ([]*JobEvent, error) {
	var events []*JobEvent
	err := r.db.Where("job_id = ?", jobID).Order("created_at").Find(&events).Error
	return events, err
}

// UpdateStatistics aktualisiert oder erstellt JobStatistics
func (r *repository) UpdateStatistics(stats *JobStatistics) error {
	if stats.ID == uuid.Nil {
		stats.ID = uuid.New()
		return r.db.Create(stats).Error
	}
	return r.db.Save(stats).Error
}

// GetStatistics gibt die Statistiken für einen Job zurück
func (r *repository) GetStatistics(jobID uuid.UUID) (*JobStatistics, error) {
	var stats JobStatistics
	err := r.db.Where("job_id = ?", jobID).First(&stats).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("keine Statistiken gefunden")
		}
		return nil, err
	}
	return &stats, nil
}
