package postgres

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/stefanposs/file-flux/backend/domain/transfer"
)

// TransferChunkRepo implements transfer.ChunkRepository using PostgreSQL.
type TransferChunkRepo struct {
	db *sql.DB
}

// NewTransferChunkRepo creates a new TransferChunkRepo.
func NewTransferChunkRepo(db *sql.DB) *TransferChunkRepo {
	return &TransferChunkRepo{db: db}
}

// CreateChunks inserts initial chunk records for a transfer.
func (r *TransferChunkRepo) CreateChunks(ctx context.Context, transferID int, totalChunks int) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx,
		`INSERT INTO transfer_chunks (transfer_id, chunk_index, status)
		 VALUES ($1, $2, 'pending')
		 ON CONFLICT (transfer_id, chunk_index) DO NOTHING`)
	if err != nil {
		return fmt.Errorf("prepare: %w", err)
	}
	defer stmt.Close()

	for i := 0; i < totalChunks; i++ {
		if _, err := stmt.ExecContext(ctx, transferID, i); err != nil {
			return fmt.Errorf("inserting chunk %d: %w", i, err)
		}
	}

	return tx.Commit()
}

// MarkChunkReceived updates a chunk's status to 'received' with hash and size info.
func (r *TransferChunkRepo) MarkChunkReceived(ctx context.Context, transferID int, chunkIndex int, hash string, compressedSize, originalSize int) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE transfer_chunks
		 SET status = 'received', chunk_hash = $3, size_compressed = $4, size_original = $5, received_at = NOW()
		 WHERE transfer_id = $1 AND chunk_index = $2`,
		transferID, chunkIndex, hash, compressedSize, originalSize)
	if err != nil {
		return fmt.Errorf("marking chunk received: %w", err)
	}
	return nil
}

// GetChunkStatus returns the status of all chunks for a transfer.
func (r *TransferChunkRepo) GetChunkStatus(ctx context.Context, transferID int) ([]transfer.ChunkStatus, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT chunk_index, COALESCE(chunk_hash, ''), COALESCE(size_compressed, 0), COALESCE(size_original, 0), status
		 FROM transfer_chunks
		 WHERE transfer_id = $1
		 ORDER BY chunk_index`, transferID)
	if err != nil {
		return nil, fmt.Errorf("querying chunks: %w", err)
	}
	defer rows.Close()

	var chunks []transfer.ChunkStatus
	for rows.Next() {
		var cs transfer.ChunkStatus
		if err := rows.Scan(&cs.ChunkIndex, &cs.ChunkHash, &cs.SizeCompressed, &cs.SizeOriginal, &cs.Status); err != nil {
			return nil, fmt.Errorf("scanning chunk: %w", err)
		}
		chunks = append(chunks, cs)
	}
	return chunks, rows.Err()
}

// GetPendingChunks returns indices of chunks still in 'pending' status.
func (r *TransferChunkRepo) GetPendingChunks(ctx context.Context, transferID int) ([]int, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT chunk_index FROM transfer_chunks
		 WHERE transfer_id = $1 AND status = 'pending'
		 ORDER BY chunk_index`, transferID)
	if err != nil {
		return nil, fmt.Errorf("querying pending chunks: %w", err)
	}
	defer rows.Close()

	var indices []int
	for rows.Next() {
		var idx int
		if err := rows.Scan(&idx); err != nil {
			return nil, fmt.Errorf("scanning index: %w", err)
		}
		indices = append(indices, idx)
	}
	return indices, rows.Err()
}

// GetCompletedCount returns the number of completed (received) chunks.
func (r *TransferChunkRepo) GetCompletedCount(ctx context.Context, transferID int) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM transfer_chunks
		 WHERE transfer_id = $1 AND status = 'received'`, transferID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("counting completed chunks: %w", err)
	}
	return count, nil
}
