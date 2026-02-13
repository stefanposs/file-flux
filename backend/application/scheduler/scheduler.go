// Package scheduler implementiert den Cron-basierten Job-Scheduler.
package scheduler

import (
	"context"
	"log"

	"github.com/robfig/cron/v3"
)

// JobRunner definiert die Schnittstelle zum Ausfuehren eines Jobs.
type JobRunner interface {
	Run(ctx context.Context, id int) error
}

// JobLister listet aktive Jobs mit Schedule.
type JobLister interface {
	ListActive(ctx context.Context) ([]ActiveJob, error)
}

// ActiveJob enthaelt die fuer den Scheduler relevanten Felder.
type ActiveJob struct {
	ID       int
	Schedule string
}

// Scheduler fuehrt Jobs nach ihrem Cron-Schedule aus.
type Scheduler struct {
	cron   *cron.Cron
	runner JobRunner
	lister JobLister
	logger *log.Logger
}

// New erstellt einen neuen Scheduler.
func New(runner JobRunner, lister JobLister, logger *log.Logger) *Scheduler {
	return &Scheduler{
		cron:   cron.New(cron.WithSeconds()),
		runner: runner,
		lister: lister,
		logger: logger,
	}
}

// LoadJobs laedt alle aktiven Jobs und registriert Cron-Entries.
func (s *Scheduler) LoadJobs(jobs []ActiveJob) {
	for _, j := range jobs {
		job := j // Closure-Kopie
		_, err := s.cron.AddFunc(job.Schedule, func() {
			s.logger.Printf("Scheduler: Job %d wird ausgefuehrt (schedule: %s)", job.ID, job.Schedule)
			if err := s.runner.Run(context.Background(), job.ID); err != nil {
				s.logger.Printf("Scheduler: Job %d fehlgeschlagen: %v", job.ID, err)
			}
		})
		if err != nil {
			s.logger.Printf("Scheduler: Ungueltige Cron-Expression fuer Job %d (%s): %v", job.ID, job.Schedule, err)
			continue
		}
		s.logger.Printf("Scheduler: Job %d registriert (schedule: %s)", job.ID, job.Schedule)
	}
}

// Start startet den Scheduler.
func (s *Scheduler) Start() {
	s.cron.Start()
	s.logger.Printf("Scheduler gestartet mit %d Entries", len(s.cron.Entries()))
}

// Stop stoppt den Scheduler.
func (s *Scheduler) Stop() {
	ctx := s.cron.Stop()
	<-ctx.Done()
	s.logger.Println("Scheduler gestoppt")
}

// Reload stoppt den aktuellen Cron, laedt aktive Jobs neu und startet erneut.
func (s *Scheduler) Reload() {
	// Aktuellen Cron sauber stoppen
	ctx := s.cron.Stop()
	<-ctx.Done()

	// Neuen Cron erstellen
	s.cron = cron.New(cron.WithSeconds())

	// Aktive Jobs laden
	activeJobs, err := s.lister.ListActive(context.Background())
	if err != nil {
		s.logger.Printf("Scheduler Reload: Fehler beim Laden der Jobs: %v", err)
		s.cron.Start()
		return
	}

	// Jobs registrieren
	for _, aj := range activeJobs {
		job := aj
		_, err := s.cron.AddFunc(job.Schedule, func() {
			s.logger.Printf("Scheduler: Job %d wird ausgefuehrt (schedule: %s)", job.ID, job.Schedule)
			if err := s.runner.Run(context.Background(), job.ID); err != nil {
				s.logger.Printf("Scheduler: Job %d fehlgeschlagen: %v", job.ID, err)
			}
		})
		if err != nil {
			s.logger.Printf("Scheduler Reload: Ungueltige Cron-Expression fuer Job %d (%s): %v", job.ID, job.Schedule, err)
			continue
		}
	}

	s.cron.Start()
	s.logger.Printf("Scheduler Reload: %d Entries registriert", len(s.cron.Entries()))
}
