// Package state provides in-memory transfer state tracking.
package state

import (
	"fmt"
	"sync"
	"time"

	"github.com/stefanposs/file-flux/backend/internal/engine/compress"
)

// Phase represents the current phase of a transfer.
type Phase string

const (
	PhaseUpload   Phase = "upload"
	PhaseDownload Phase = "download"
)

// TransferOpts contains options set when starting tracking.
type TransferOpts struct {
	ChunkSize   int64
	Compression compress.Algorithm
	Phase       Phase
}

// TransferState tracks in-flight state for a single transfer.
type TransferState struct {
	TransferID      int
	TotalChunks     uint32
	CompletedChunks map[uint32]bool
	FileHash        [32]byte
	Phase           Phase
	ChunkSize       int64
	Compression     compress.Algorithm
	BytesReceived   int64
	StartedAt       time.Time
	LastActivity    time.Time
	mu              sync.Mutex
}

// Tracker manages in-flight transfer states.
type Tracker struct {
	states map[int]*TransferState
	mu     sync.RWMutex
}

// NewTracker creates a new Tracker.
func NewTracker() *Tracker {
	return &Tracker{
		states: make(map[int]*TransferState),
	}
}

// Start begins tracking a transfer.
func (t *Tracker) Start(transferID int, totalChunks uint32, fileHash [32]byte, opts TransferOpts) error {
	t.mu.Lock()
	defer t.mu.Unlock()

	if _, exists := t.states[transferID]; exists {
		return fmt.Errorf("transfer %d already tracked", transferID)
	}

	now := time.Now()
	t.states[transferID] = &TransferState{
		TransferID:      transferID,
		TotalChunks:     totalChunks,
		CompletedChunks: make(map[uint32]bool),
		FileHash:        fileHash,
		Phase:           opts.Phase,
		ChunkSize:       opts.ChunkSize,
		Compression:     opts.Compression,
		StartedAt:       now,
		LastActivity:    now,
	}
	return nil
}

// MarkChunkComplete marks a chunk as received.
func (t *Tracker) MarkChunkComplete(transferID int, chunkIndex uint32, size int64) error {
	t.mu.RLock()
	s, ok := t.states[transferID]
	t.mu.RUnlock()
	if !ok {
		return fmt.Errorf("transfer %d not tracked", transferID)
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.CompletedChunks[chunkIndex] = true
	s.BytesReceived += size
	s.LastActivity = time.Now()
	return nil
}

// IsComplete returns true if all chunks have been received.
func (t *Tracker) IsComplete(transferID int) bool {
	t.mu.RLock()
	s, ok := t.states[transferID]
	t.mu.RUnlock()
	if !ok {
		return false
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	return uint32(len(s.CompletedChunks)) >= s.TotalChunks
}

// GetProgress returns completed chunks, total chunks, and bytes received.
func (t *Tracker) GetProgress(transferID int) (completed uint32, total uint32, bytesReceived int64) {
	t.mu.RLock()
	s, ok := t.states[transferID]
	t.mu.RUnlock()
	if !ok {
		return 0, 0, 0
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	return uint32(len(s.CompletedChunks)), s.TotalChunks, s.BytesReceived
}

// GetMissingChunks returns indices of chunks not yet received.
func (t *Tracker) GetMissingChunks(transferID int) []uint32 {
	t.mu.RLock()
	s, ok := t.states[transferID]
	t.mu.RUnlock()
	if !ok {
		return nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	var missing []uint32
	for i := uint32(0); i < s.TotalChunks; i++ {
		if !s.CompletedChunks[i] {
			missing = append(missing, i)
		}
	}
	return missing
}

// GetState returns the state for a transfer (nil if not tracked).
func (t *Tracker) GetState(transferID int) (*TransferState, error) {
	t.mu.RLock()
	defer t.mu.RUnlock()
	s, ok := t.states[transferID]
	if !ok {
		return nil, fmt.Errorf("transfer %d not tracked", transferID)
	}
	return s, nil
}

// Remove stops tracking a transfer.
func (t *Tracker) Remove(transferID int) {
	t.mu.Lock()
	defer t.mu.Unlock()
	delete(t.states, transferID)
}

// StaleTransfers returns IDs of transfers with no activity since the given duration.
func (t *Tracker) StaleTransfers(maxAge time.Duration) []int {
	t.mu.RLock()
	defer t.mu.RUnlock()

	cutoff := time.Now().Add(-maxAge)
	var stale []int
	for id, s := range t.states {
		s.mu.Lock()
		if s.LastActivity.Before(cutoff) {
			stale = append(stale, id)
		}
		s.mu.Unlock()
	}
	return stale
}

// ActiveCount returns the number of currently tracked transfers.
func (t *Tracker) ActiveCount() int {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return len(t.states)
}
