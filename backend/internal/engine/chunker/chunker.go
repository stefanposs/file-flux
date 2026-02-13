// Package chunker splits files into fixed-size chunks and reassembles them.
package chunker

import (
	"crypto/sha256"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
)

// Chunk size constants.
const (
	DefaultChunkSize = 8 * 1024 * 1024  // 8 MB
	MinChunkSize     = 256 * 1024       // 256 KB
	MaxChunkSize     = 64 * 1024 * 1024 // 64 MB
)

// Chunk represents a single chunk of a file.
type Chunk struct {
	Index  uint32
	Data   []byte
	Size   int64    // uncompressed size
	SHA256 [32]byte // hash of uncompressed data
	IsLast bool
}

// Chunker splits files into chunks and reassembles them.
type Chunker struct {
	chunkSize int64
}

// New creates a new Chunker with the given chunk size.
// If chunkSize is 0, DefaultChunkSize is used.
// Returns an error if chunkSize is outside [MinChunkSize, MaxChunkSize].
func New(chunkSize int64) (*Chunker, error) {
	if chunkSize == 0 {
		chunkSize = DefaultChunkSize
	}
	if chunkSize < MinChunkSize || chunkSize > MaxChunkSize {
		return nil, fmt.Errorf("chunk size %d out of range [%d, %d]", chunkSize, MinChunkSize, MaxChunkSize)
	}
	return &Chunker{chunkSize: chunkSize}, nil
}

// ChunkSize returns the configured chunk size.
func (c *Chunker) ChunkSize() int64 {
	return c.chunkSize
}

// TotalChunks calculates the total number of chunks for a file of the given size.
func (c *Chunker) TotalChunks(fileSize int64) uint32 {
	if fileSize <= 0 {
		return 1 // empty file still produces one (empty) chunk
	}
	n := fileSize / c.chunkSize
	if fileSize%c.chunkSize != 0 {
		n++
	}
	return uint32(n)
}

// Split reads from reader and sends chunks on the returned channel.
// The error channel will receive at most one error.
// Both channels are closed when splitting is complete or an error occurs.
func (c *Chunker) Split(reader io.Reader) (<-chan Chunk, <-chan error) {
	chunks := make(chan Chunk, 4) // buffer a few chunks ahead
	errc := make(chan error, 1)

	go func() {
		defer close(chunks)
		defer close(errc)

		buf := make([]byte, c.chunkSize)
		var index uint32

		for {
			n, err := io.ReadFull(reader, buf)
			if n > 0 {
				data := make([]byte, n)
				copy(data, buf[:n])
				hash := sha256.Sum256(data)
				isLast := err == io.EOF || err == io.ErrUnexpectedEOF

				chunks <- Chunk{
					Index:  index,
					Data:   data,
					Size:   int64(n),
					SHA256: hash,
					IsLast: isLast,
				}
				index++

				if isLast {
					return
				}
			}
			if err == io.EOF && n == 0 {
				// File size was exact multiple of chunk size; previous chunk was the last.
				return
			}
			if err != nil && err != io.EOF && err != io.ErrUnexpectedEOF {
				errc <- fmt.Errorf("reading chunk %d: %w", index, err)
				return
			}
		}
	}()

	return chunks, errc
}

// Reassemble writes chunks from the channel to writer in order.
// Chunks must arrive in order (Index 0, 1, 2, ...).
func (c *Chunker) Reassemble(writer io.Writer, chunks <-chan Chunk) error {
	var expected uint32
	for chunk := range chunks {
		if chunk.Index != expected {
			return fmt.Errorf("chunk out of order: expected %d, got %d", expected, chunk.Index)
		}
		// Verify hash
		hash := sha256.Sum256(chunk.Data)
		if hash != chunk.SHA256 {
			return fmt.Errorf("chunk %d hash mismatch", chunk.Index)
		}
		if _, err := writer.Write(chunk.Data); err != nil {
			return fmt.Errorf("writing chunk %d: %w", chunk.Index, err)
		}
		expected++
	}
	return nil
}

// ReassembleFromDir reads chunk files from a directory and writes them to writer.
// Chunk files are named chunk-NNNNNN.bin.
func (c *Chunker) ReassembleFromDir(chunkDir string, destPath string, totalChunks int) error {
	dst, err := os.Create(destPath)
	if err != nil {
		return fmt.Errorf("creating destination file: %w", err)
	}
	defer dst.Close()

	for i := 0; i < totalChunks; i++ {
		chunkPath := filepath.Join(chunkDir, fmt.Sprintf("chunk-%06d.bin", i))
		data, err := os.ReadFile(chunkPath)
		if err != nil {
			return fmt.Errorf("reading chunk %d from %s: %w", i, chunkPath, err)
		}
		if _, err := dst.Write(data); err != nil {
			return fmt.Errorf("writing chunk %d: %w", i, err)
		}
	}
	return nil
}

// ListChunkFiles returns sorted chunk file paths in a directory.
func ListChunkFiles(dir string) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("listing chunk directory: %w", err)
	}

	var files []string
	for _, e := range entries {
		if !e.IsDir() && filepath.Ext(e.Name()) == ".bin" {
			files = append(files, filepath.Join(dir, e.Name()))
		}
	}
	sort.Strings(files)
	return files, nil
}
