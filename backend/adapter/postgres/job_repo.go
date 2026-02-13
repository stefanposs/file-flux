package postgres

import (
	"context"
	"database/sql"

	"github.com/stefanposs/file-flux/backend/domain/common"
	"github.com/stefanposs/file-flux/backend/domain/job"
)

// JobRepo implementiert job.Repository mit PostgreSQL.
type JobRepo struct {
	db *sql.DB
}

// NewJobRepo erstellt ein neues JobRepo.
func NewJobRepo(pgdb *DB) *JobRepo {
	return &JobRepo{db: pgdb.Pool}
}

var _ job.Repository = (*JobRepo)(nil)

func (r *JobRepo) ListByUser(ctx context.Context, userID int) ([]job.Job, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, user_id, name, type, status, schedule, source_path, destination_path,
		       source_agent_id, destination_agent_id, last_run, next_run, description, created_at
		FROM jobs WHERE user_id = $1 ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var jobs []job.Job
	for rows.Next() {
		var j job.Job
		err := rows.Scan(
			&j.ID, &j.UserID, &j.Name, &j.Type, &j.Status, &j.Schedule,
			&j.SourcePath, &j.DestinationPath,
			&j.SourceAgentID, &j.DestinationAgentID,
			&j.LastRun, &j.NextRun, &j.Description, &j.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		jobs = append(jobs, j)
	}
	return jobs, rows.Err()
}

func (r *JobRepo) GetByID(ctx context.Context, id int) (*job.Job, error) {
	var j job.Job
	err := r.db.QueryRowContext(ctx, `
		SELECT id, user_id, name, type, status, schedule, source_path, destination_path,
		       source_agent_id, destination_agent_id, last_run, next_run, description, created_at
		FROM jobs WHERE id = $1
	`, id).Scan(
		&j.ID, &j.UserID, &j.Name, &j.Type, &j.Status, &j.Schedule,
		&j.SourcePath, &j.DestinationPath,
		&j.SourceAgentID, &j.DestinationAgentID,
		&j.LastRun, &j.NextRun, &j.Description, &j.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, common.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &j, nil
}

func (r *JobRepo) Create(ctx context.Context, j *job.Job) error {
	return r.db.QueryRowContext(ctx, `
		INSERT INTO jobs (user_id, name, type, status, schedule, source_path, destination_path,
		                  source_agent_id, destination_agent_id, description)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, created_at
	`, j.UserID, j.Name, j.Type, j.Status, j.Schedule,
		j.SourcePath, j.DestinationPath,
		j.SourceAgentID, j.DestinationAgentID, j.Description,
	).Scan(&j.ID, &j.CreatedAt)
}

func (r *JobRepo) Update(ctx context.Context, j *job.Job) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE jobs SET name = $1, type = $2, status = $3, schedule = $4,
		               source_path = $5, destination_path = $6,
		               source_agent_id = $7, destination_agent_id = $8, description = $9
		WHERE id = $10
	`, j.Name, j.Type, j.Status, j.Schedule,
		j.SourcePath, j.DestinationPath,
		j.SourceAgentID, j.DestinationAgentID, j.Description, j.ID,
	)
	return err
}

func (r *JobRepo) Delete(ctx context.Context, id int) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM jobs WHERE id = $1`, id)
	return err
}

func (r *JobRepo) CountByUser(ctx context.Context, userID int) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM jobs WHERE user_id = $1`, userID).Scan(&count)
	return count, err
}

func (r *JobRepo) ListActive(ctx context.Context) ([]job.Job, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, user_id, name, type, status, schedule, source_path, destination_path,
		       source_agent_id, destination_agent_id, last_run, next_run, description, created_at
		FROM jobs WHERE status = 'active' AND schedule IS NOT NULL
		ORDER BY created_at ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var jobs []job.Job
	for rows.Next() {
		var j job.Job
		err := rows.Scan(
			&j.ID, &j.UserID, &j.Name, &j.Type, &j.Status, &j.Schedule,
			&j.SourcePath, &j.DestinationPath,
			&j.SourceAgentID, &j.DestinationAgentID,
			&j.LastRun, &j.NextRun, &j.Description, &j.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		jobs = append(jobs, j)
	}
	return jobs, rows.Err()
}
