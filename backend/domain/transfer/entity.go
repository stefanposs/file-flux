// Package transfer definiert die Transfer-Domain-Entität und das Repository-Interface.
package transfer

import (
	"context"
	"time"
)

// Status definiert den Status eines Transfers
type Status string

const (
	StatusPending   Status = "pending"
	StatusRunning   Status = "running"
	StatusCompleted Status = "completed"
	StatusFailed    Status = "failed"
	StatusCancelled Status = "cancelled"
	StatusSuspended Status = "suspended"
)

// Transfer ist die Domain-Entität für eine einzelne Dateiübertragung
type Transfer struct {
	ID                 int        `json:"id"`
	JobID              *int       `json:"job_id,omitempty"`
	Filename           string     `json:"filename"`
	Size               int64      `json:"size"`
	Status             Status     `json:"status"`
	Progress           float64    `json:"progress"`
	SourcePath         string     `json:"source_path"`
	DestinationPath    string     `json:"destination_path"`
	SourceAgentID      *int       `json:"source_agent_id,omitempty"`
	DestinationAgentID *int       `json:"destination_agent_id,omitempty"`
	StartTime          time.Time  `json:"start_time"`
	EndTime            *time.Time `json:"end_time,omitempty"`
	Error              *string    `json:"error,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`

	// Phase 2: Chunked transfer fields
	FileHash         string `json:"file_hash,omitempty"`
	Compression      string `json:"compression,omitempty"`
	ChunkSize        int    `json:"chunk_size,omitempty"`
	TotalChunks      int    `json:"total_chunks"`
	CompletedChunks  int    `json:"completed_chunks"`
	BytesTransferred int64  `json:"bytes_transferred"`
	RetryCount       int    `json:"retry_count"`
	MaxRetries       int    `json:"max_retries"`
}

// ChunkStatus represents the status of a single chunk within a transfer.
type ChunkStatus struct {
	ChunkIndex     int    `json:"chunk_index"`
	ChunkHash      string `json:"chunk_hash"`
	SizeCompressed int    `json:"size_compressed"`
	SizeOriginal   int    `json:"size_original"`
	Status         string `json:"status"` // pending, received, verified, failed
}

// Repository definiert die Schnittstelle für Transfer-Datenzugriff
type Repository interface {
	ListByUser(ctx context.Context, userID int) ([]Transfer, error)
	GetByID(ctx context.Context, id int) (*Transfer, error)
	GetByIDForUser(ctx context.Context, id int, userID int) (*Transfer, error)
	Create(ctx context.Context, transfer *Transfer) error
	UpdateStatus(ctx context.Context, id int, status Status, errorMsg string) error
	UpdateProgress(ctx context.Context, id int, progress float64) error

	// Phase 2: Chunk-aware update methods
	UpdateChunkProgress(ctx context.Context, id int, completedChunks int, bytesTransferred int64) error
	UpdateFileHash(ctx context.Context, id int, hash string) error
}

// ChunkRepository defines the interface for chunk-level data access.
type ChunkRepository interface {
	CreateChunks(ctx context.Context, transferID int, totalChunks int) error
	MarkChunkReceived(ctx context.Context, transferID int, chunkIndex int, hash string, compressedSize, originalSize int) error
	GetChunkStatus(ctx context.Context, transferID int) ([]ChunkStatus, error)
	GetPendingChunks(ctx context.Context, transferID int) ([]int, error)
	GetCompletedCount(ctx context.Context, transferID int) (int, error)
}
