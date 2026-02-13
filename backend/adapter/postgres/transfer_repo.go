package postgres

import (
	"context"
	"database/sql"

	"github.com/stefanposs/file-flux/backend/domain/common"
	"github.com/stefanposs/file-flux/backend/domain/transfer"
)

// TransferRepo implementiert transfer.Repository mit PostgreSQL.
type TransferRepo struct {
	db *sql.DB
}

// NewTransferRepo erstellt ein neues TransferRepo.
func NewTransferRepo(pgdb *DB) *TransferRepo {
	return &TransferRepo{db: pgdb.Pool}
}

var _ transfer.Repository = (*TransferRepo)(nil)

func (r *TransferRepo) ListByUser(ctx context.Context, userID int) ([]transfer.Transfer, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT t.id, t.job_id, t.filename, t.size, t.status, t.progress,
		       t.source_path, t.destination_path,
		       t.source_agent_id, t.destination_agent_id,
		       t.start_time, t.end_time, t.error, t.created_at
		FROM transfers t
		LEFT JOIN jobs j ON t.job_id = j.id
		WHERE j.user_id = $1
		ORDER BY t.created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var transfers []transfer.Transfer
	for rows.Next() {
		var t transfer.Transfer
		err := rows.Scan(
			&t.ID, &t.JobID, &t.Filename, &t.Size, &t.Status, &t.Progress,
			&t.SourcePath, &t.DestinationPath,
			&t.SourceAgentID, &t.DestinationAgentID,
			&t.StartTime, &t.EndTime, &t.Error, &t.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		transfers = append(transfers, t)
	}
	return transfers, rows.Err()
}

func (r *TransferRepo) GetByID(ctx context.Context, id int) (*transfer.Transfer, error) {
	var t transfer.Transfer
	err := r.db.QueryRowContext(ctx, `
		SELECT id, job_id, filename, size, status, progress, source_path, destination_path,
		       source_agent_id, destination_agent_id, start_time, end_time, error, created_at
		FROM transfers WHERE id = $1
	`, id).Scan(
		&t.ID, &t.JobID, &t.Filename, &t.Size, &t.Status, &t.Progress,
		&t.SourcePath, &t.DestinationPath,
		&t.SourceAgentID, &t.DestinationAgentID,
		&t.StartTime, &t.EndTime, &t.Error, &t.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, common.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *TransferRepo) GetByIDForUser(ctx context.Context, id int, userID int) (*transfer.Transfer, error) {
	var t transfer.Transfer
	err := r.db.QueryRowContext(ctx, `
		SELECT t.id, t.job_id, t.filename, t.size, t.status, t.progress,
		       t.source_path, t.destination_path,
		       t.source_agent_id, t.destination_agent_id,
		       t.start_time, t.end_time, t.error, t.created_at
		FROM transfers t
		LEFT JOIN jobs j ON t.job_id = j.id
		WHERE t.id = $1 AND j.user_id = $2
	`, id, userID).Scan(
		&t.ID, &t.JobID, &t.Filename, &t.Size, &t.Status, &t.Progress,
		&t.SourcePath, &t.DestinationPath,
		&t.SourceAgentID, &t.DestinationAgentID,
		&t.StartTime, &t.EndTime, &t.Error, &t.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, common.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *TransferRepo) Create(ctx context.Context, t *transfer.Transfer) error {
	return r.db.QueryRowContext(ctx, `
		INSERT INTO transfers (job_id, filename, size, status, source_path, destination_path,
		                       source_agent_id, destination_agent_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, start_time, created_at
	`, t.JobID, t.Filename, t.Size, t.Status,
		t.SourcePath, t.DestinationPath,
		t.SourceAgentID, t.DestinationAgentID,
	).Scan(&t.ID, &t.StartTime, &t.CreatedAt)
}

func (r *TransferRepo) UpdateStatus(ctx context.Context, id int, status transfer.Status, errorMsg string) error {
	if errorMsg != "" {
		_, err := r.db.ExecContext(ctx, `
			UPDATE transfers SET status = $1, error = $2, end_time = NOW() WHERE id = $3
		`, status, errorMsg, id)
		return err
	}
	if status == transfer.StatusCompleted {
		_, err := r.db.ExecContext(ctx, `
			UPDATE transfers SET status = $1, progress = 1.0, end_time = NOW() WHERE id = $2
		`, status, id)
		return err
	}
	_, err := r.db.ExecContext(ctx, `
		UPDATE transfers SET status = $1 WHERE id = $2
	`, status, id)
	return err
}

func (r *TransferRepo) UpdateProgress(ctx context.Context, id int, progress float64) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE transfers SET progress = $1, status = 'running' WHERE id = $2
	`, progress, id)
	return err
}

func (r *TransferRepo) UpdateChunkProgress(ctx context.Context, id int, completedChunks int, bytesTransferred int64) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE transfers SET completed_chunks = $1, bytes_transferred = $2,
		       progress = CASE WHEN total_chunks > 0 THEN $1::float / total_chunks ELSE 0 END
		WHERE id = $3
	`, completedChunks, bytesTransferred, id)
	return err
}

func (r *TransferRepo) UpdateFileHash(ctx context.Context, id int, hash string) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE transfers SET file_hash = $1 WHERE id = $2
	`, hash, id)
	return err
}
