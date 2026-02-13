// Package relay provides disk-based intermediate chunk storage during relay.
package relay

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

// Relay manages temporary chunk storage on disk.
type Relay struct {
	storageDir string
	mu         sync.Mutex
}

// New creates a Relay with the given storage directory.
func New(storageDir string) (*Relay, error) {
	if err := os.MkdirAll(storageDir, 0o755); err != nil {
		return nil, fmt.Errorf("creating relay storage dir: %w", err)
	}
	return &Relay{storageDir: storageDir}, nil
}

// transferDir returns the directory for a specific transfer.
func (r *Relay) transferDir(transferID int) string {
	return filepath.Join(r.storageDir, fmt.Sprintf("transfer-%d", transferID))
}

// chunkPath returns the file path for a chunk.
func (r *Relay) chunkPath(transferID int, chunkIndex uint32) string {
	return filepath.Join(r.transferDir(transferID), fmt.Sprintf("chunk-%06d.bin", chunkIndex))
}

// StoreChunk stores a chunk's (compressed) data on disk.
func (r *Relay) StoreChunk(transferID int, chunkIndex uint32, data []byte) (int64, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	dir := r.transferDir(transferID)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return 0, fmt.Errorf("creating transfer dir: %w", err)
	}

	path := r.chunkPath(transferID, chunkIndex)
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return 0, fmt.Errorf("writing chunk: %w", err)
	}
	return int64(len(data)), nil
}

// GetChunk reads a chunk from disk.
func (r *Relay) GetChunk(transferID int, chunkIndex uint32) ([]byte, error) {
	path := r.chunkPath(transferID, chunkIndex)
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("reading chunk: %w", err)
	}
	return data, nil
}

// GetAllChunks returns all chunk files for a transfer, sorted.
func (r *Relay) GetAllChunks(transferID int) ([]string, error) {
	dir := r.transferDir(transferID)
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("listing transfer dir: %w", err)
	}

	var paths []string
	for _, e := range entries {
		if !e.IsDir() && filepath.Ext(e.Name()) == ".bin" {
			paths = append(paths, filepath.Join(dir, e.Name()))
		}
	}
	return paths, nil
}

// CleanupTransfer removes all stored chunks for a transfer.
func (r *Relay) CleanupTransfer(transferID int) error {
	dir := r.transferDir(transferID)
	if err := os.RemoveAll(dir); err != nil {
		return fmt.Errorf("cleaning up transfer %d: %w", transferID, err)
	}
	return nil
}

// DiskUsage returns total bytes used by a transfer's chunks.
func (r *Relay) DiskUsage(transferID int) (int64, error) {
	dir := r.transferDir(transferID)
	var total int64
	err := filepath.Walk(dir, func(_ string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			total += info.Size()
		}
		return nil
	})
	if err != nil && !os.IsNotExist(err) {
		return 0, err
	}
	return total, nil
}
