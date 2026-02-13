// Package transfer implementiert den Transfer-Manager für den Agenten.
package transfer

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/stefanposs/file-flux/agent/internal/api"
	"github.com/stefanposs/file-flux/agent/internal/config"
	"github.com/stefanposs/file-flux/agent/internal/engine/chunker"
	"github.com/stefanposs/file-flux/agent/internal/engine/compress"
	"github.com/stefanposs/file-flux/agent/internal/engine/hasher"
	"github.com/stefanposs/file-flux/agent/internal/engine/protocol"
	"github.com/stefanposs/file-flux/agent/internal/transport"
)

// ProgressReporter sendet Fortschritts- und Fertigmeldungen an den Server.
type ProgressReporter interface {
	SendTransferProgress(transferID string, progress float64, currentBytes, totalBytes int64)
	SendTransferComplete(transferID string, duration time.Duration)
	SendTransferError(transferID string, errMsg string)
}

// BinarySender kann binäre WebSocket-Nachrichten senden und
// JSON-Nachrichten an den Server schicken.
type BinarySender interface {
	SendBinaryMessage(data []byte) error
	SendMessage(msg transport.Message)
}

// Manager verwaltet aktive Dateitransfers.
type Manager struct {
	logger       *log.Logger
	config       config.TransferConfig
	active       map[string]*activeTransfer
	activeMu     sync.Mutex
	apiClient    *api.Client
	reporter     ProgressReporter
	binarySender BinarySender

	// For binary downloads: incoming chunks keyed by transferID
	downloadChans   map[string]chan *protocol.BinaryFrame
	downloadChansMu sync.Mutex
}

type activeTransfer struct {
	id     string
	cancel chan struct{}
	done   chan struct{}
}

// NewManager erstellt einen neuen Transfer-Manager.
func NewManager(logger *log.Logger, cfg config.TransferConfig, apiClient *api.Client) *Manager {
	// Verzeichnisse sicherstellen
	os.MkdirAll(cfg.TempDir, 0o755)
	os.MkdirAll(cfg.BaseDir, 0o755)

	return &Manager{
		logger:        logger,
		config:        cfg,
		active:        make(map[string]*activeTransfer),
		apiClient:     apiClient,
		downloadChans: make(map[string]chan *protocol.BinaryFrame),
	}
}

// SetReporter setzt den ProgressReporter (WebSocket-Client).
func (m *Manager) SetReporter(r ProgressReporter) {
	m.reporter = r
}

// SetBinarySender setzt den BinarySender für WebSocket-Chunk-Transfers.
func (m *Manager) SetBinarySender(sender BinarySender) {
	m.binarySender = sender
}

// HandleBinaryMessage verarbeitet eingehende binäre WebSocket-Nachrichten (Download-Chunks).
func (m *Manager) HandleBinaryMessage(data []byte) {
	frame, err := protocol.DecodeFrame(data)
	if err != nil {
		m.logger.Printf("[Transfer] Fehler beim Dekodieren des binären Frames: %v", err)
		return
	}

	transferID := fmt.Sprintf("%d", frame.Header.TransferID)

	m.downloadChansMu.Lock()
	ch, ok := m.downloadChans[transferID]
	m.downloadChansMu.Unlock()

	if !ok {
		m.logger.Printf("[Transfer] Chunk empfangen für unbekannten Transfer %s (Index %d)", transferID, frame.Header.ChunkIndex)
		return
	}

	ch <- frame
}

// StartTransfer startet einen neuen Transfer gemäß der Server-Anfrage.
func (m *Manager) StartTransfer(request transport.TransferRequest) error {
	t := request.Transfer

	m.activeMu.Lock()
	if _, exists := m.active[t.ID]; exists {
		m.activeMu.Unlock()
		return fmt.Errorf("transfer %s läuft bereits", t.ID)
	}

	at := &activeTransfer{
		id:     t.ID,
		cancel: make(chan struct{}),
		done:   make(chan struct{}),
	}
	m.active[t.ID] = at
	m.activeMu.Unlock()

	go func() {
		defer func() {
			close(at.done)
			m.activeMu.Lock()
			delete(m.active, t.ID)
			m.activeMu.Unlock()
		}()

		start := time.Now()
		var err error

		// Route based on protocol: binary_ws (new chunked) or http (legacy)
		useBinary := t.Protocol == "binary_ws" && m.binarySender != nil

		switch t.TransferType {
		case "upload":
			if useBinary {
				err = m.executeBinaryUpload(at, t)
			} else {
				err = m.executeUpload(at, t.ID, t.SourcePath, t.DestinationPath)
			}
		case "download":
			if useBinary {
				err = m.executeBinaryDownload(at, t)
			} else {
				err = m.executeDownload(at, t.ID, t.SourcePath, t.DestinationPath)
			}
		default:
			err = fmt.Errorf("unbekannter Transfer-Typ: %s", t.TransferType)
		}

		if err != nil {
			m.logger.Printf("Transfer %s fehlgeschlagen: %v", t.ID, err)
			if m.reporter != nil {
				m.reporter.SendTransferError(t.ID, err.Error())
			}
		} else {
			m.logger.Printf("Transfer %s abgeschlossen", t.ID)
			if m.reporter != nil {
				m.reporter.SendTransferComplete(t.ID, time.Since(start))
			}
		}
	}()

	m.logger.Printf("Transfer %s gestartet (Typ: %s, Protokoll: %s, Quelle: %s, Ziel: %s)",
		t.ID, t.TransferType, t.Protocol, t.SourcePath, t.DestinationPath)
	return nil
}

// CancelTransfer bricht einen laufenden Transfer ab.
func (m *Manager) CancelTransfer(transferID string) error {
	m.activeMu.Lock()
	at, ok := m.active[transferID]
	m.activeMu.Unlock()

	if !ok {
		return fmt.Errorf("transfer %s nicht gefunden", transferID)
	}

	close(at.cancel)
	<-at.done
	m.logger.Printf("Transfer %s abgebrochen", transferID)
	return nil
}

// StopAll stoppt alle laufenden Transfers.
func (m *Manager) StopAll() {
	m.activeMu.Lock()
	transfers := make([]*activeTransfer, 0, len(m.active))
	for _, at := range m.active {
		transfers = append(transfers, at)
	}
	m.activeMu.Unlock()

	for _, at := range transfers {
		select {
		case <-at.cancel:
		default:
			close(at.cancel)
		}
		<-at.done
	}
	m.logger.Println("Alle Transfers gestoppt")
}

// --- Legacy HTTP transfer methods (unchanged) ---

// executeUpload liest eine lokale Datei und sendet sie per HTTP an den Server.
func (m *Manager) executeUpload(at *activeTransfer, transferID, srcPath, dstPath string) error {
	fullPath := srcPath
	if !filepath.IsAbs(srcPath) {
		fullPath = filepath.Join(m.config.BaseDir, srcPath)
	}
	src, err := os.Open(fullPath)
	if err != nil {
		return fmt.Errorf("quell-Datei öffnen: %w", err)
	}
	defer src.Close()

	stat, err := src.Stat()
	if err != nil {
		return fmt.Errorf("datei-Info lesen: %w", err)
	}

	totalBytes := stat.Size()
	filename := filepath.Base(srcPath)

	// Progress-Wrapper um den Reader
	pr := &progressReader{
		reader:     src,
		total:      totalBytes,
		transferID: transferID,
		reporter:   m.reporter,
		cancel:     at.cancel,
	}

	// Datei per HTTP an den Server senden
	if m.apiClient != nil {
		_, err = m.apiClient.UploadFile(transferID, filename, pr)
	} else {
		// Fallback: lokale Kopie (fuer Tests ohne Server)
		err = m.localCopy(at, fullPath, filepath.Join(m.config.TempDir, dstPath))
	}

	return err
}

// executeDownload laedt eine Datei vom Server und speichert sie lokal.
func (m *Manager) executeDownload(at *activeTransfer, transferID, srcPath, dstPath string) error {
	fullPath := dstPath
	if !filepath.IsAbs(dstPath) {
		fullPath = filepath.Join(m.config.BaseDir, dstPath)
	}
	os.MkdirAll(filepath.Dir(fullPath), 0o755)

	dst, err := os.Create(fullPath)
	if err != nil {
		return fmt.Errorf("ziel-Datei erstellen: %w", err)
	}
	defer dst.Close()

	if m.apiClient != nil {
		_, err = m.apiClient.DownloadFile(transferID, dst)
	} else {
		// Fallback: lokale Kopie
		err = m.localCopy(at, filepath.Join(m.config.BaseDir, srcPath), fullPath)
	}

	return err
}

// --- Binary WebSocket chunked transfer methods ---

// executeBinaryUpload splits a file into chunks, compresses, hashes, encodes
// as binary frames, and sends over WebSocket with retry logic.
func (m *Manager) executeBinaryUpload(at *activeTransfer, t struct {
	ID               string `json:"id"`
	JobID            string `json:"job_id"`
	SourcePath       string `json:"source_path"`
	DestinationPath  string `json:"destination_path"`
	Compressed       bool   `json:"compressed"`
	ChunkSize        int    `json:"chunk_size"`
	TransferType     string `json:"transfer_type"`
	DestinationAgent string `json:"destination_agent,omitempty"`
	Protocol         string `json:"protocol,omitempty"`
	Compression      string `json:"compression,omitempty"`
},
) error {
	fullPath := t.SourcePath
	if !filepath.IsAbs(t.SourcePath) {
		fullPath = filepath.Join(m.config.BaseDir, t.SourcePath)
	}

	src, err := os.Open(fullPath)
	if err != nil {
		return fmt.Errorf("quell-Datei öffnen: %w", err)
	}
	defer src.Close()

	stat, err := src.Stat()
	if err != nil {
		return fmt.Errorf("datei-Info lesen: %w", err)
	}
	totalBytes := stat.Size()

	// Compute whole-file hash
	fileHash, err := hasher.HashReader(src)
	if err != nil {
		return fmt.Errorf("datei-Hash berechnen: %w", err)
	}
	// Reset file for reading chunks
	if _, err := src.Seek(0, 0); err != nil {
		return fmt.Errorf("datei zurücksetzen: %w", err)
	}

	// Determine chunk size
	chunkSize := t.ChunkSize
	if chunkSize <= 0 {
		chunkSize = m.config.ChunkSize
	}
	if chunkSize <= 0 {
		chunkSize = chunker.DefaultChunkSize
	}

	// Setup chunker and compressor
	c, err := chunker.New(int64(chunkSize))
	if err != nil {
		return fmt.Errorf("chunker erstellen: %w", err)
	}
	algo := parseCompression(t.Compression)
	comp, err := compress.New(algo)
	if err != nil {
		return fmt.Errorf("kompressor erstellen: %w", err)
	}

	totalChunks := c.TotalChunks(totalBytes)

	m.logger.Printf("[Transfer] Binary-Upload %s: %d Bytes, %d Chunks (à %d), Kompression: %s",
		t.ID, totalBytes, totalChunks, chunkSize, t.Compression)

	// Parse transfer ID to uint32
	transferIDNum := parseTransferID(t.ID)

	// Split the file and send chunks
	chunkCh, errCh := c.Split(src)
	var sentBytes int64
	const maxRetries = 3
	const baseRetryDelay = time.Second

	for chunk := range chunkCh {
		select {
		case <-at.cancel:
			return fmt.Errorf("transfer abgebrochen")
		default:
		}

		// Compress the chunk
		compressed, err := comp.Compress(chunk.Data)
		if err != nil {
			return fmt.Errorf("chunk %d komprimieren: %w", chunk.Index, err)
		}

		// Build binary frame
		header := protocol.BinaryHeader{
			TransferID:       transferIDNum,
			ChunkIndex:       uint32(chunk.Index),
			TotalChunks:      uint32(totalChunks),
			SHA256:           chunk.SHA256,
			UncompressedSize: uint32(chunk.Size),
			CompressedSize:   uint32(len(compressed)),
			CompressionType:  uint8(algo),
		}

		frame, err := protocol.EncodeFrame(header, compressed)
		if err != nil {
			return fmt.Errorf("frame %d kodieren: %w", chunk.Index, err)
		}

		// Send with retry
		if err := m.sendWithRetry(at, frame, int(chunk.Index), maxRetries, baseRetryDelay); err != nil {
			return fmt.Errorf("chunk %d senden: %w", chunk.Index, err)
		}

		sentBytes += int64(chunk.Size)

		// Report progress
		if m.reporter != nil {
			progress := float64(sentBytes) / float64(totalBytes)
			m.reporter.SendTransferProgress(t.ID, progress, sentBytes, totalBytes)
		}
	}

	// Check for chunker errors
	if err := <-errCh; err != nil {
		return fmt.Errorf("chunking fehlgeschlagen: %w", err)
	}

	// Send transfer_complete message with file hash
	m.sendTransferCompleteMsg(t.ID, hasher.HexString(fileHash), int(totalChunks))

	return nil
}

// executeBinaryDownload receives chunks from server via binary WebSocket,
// verifies, decompresses, and reassembles the file.
func (m *Manager) executeBinaryDownload(at *activeTransfer, t struct {
	ID               string `json:"id"`
	JobID            string `json:"job_id"`
	SourcePath       string `json:"source_path"`
	DestinationPath  string `json:"destination_path"`
	Compressed       bool   `json:"compressed"`
	ChunkSize        int    `json:"chunk_size"`
	TransferType     string `json:"transfer_type"`
	DestinationAgent string `json:"destination_agent,omitempty"`
	Protocol         string `json:"protocol,omitempty"`
	Compression      string `json:"compression,omitempty"`
},
) error {
	fullPath := t.DestinationPath
	if !filepath.IsAbs(t.DestinationPath) {
		fullPath = filepath.Join(m.config.BaseDir, t.DestinationPath)
	}
	os.MkdirAll(filepath.Dir(fullPath), 0o755)

	// Create temp directory for chunks
	tempDir := filepath.Join(m.config.TempDir, fmt.Sprintf("download-%s", t.ID))
	os.MkdirAll(tempDir, 0o755)
	defer os.RemoveAll(tempDir)

	// Register download channel for receiving chunks
	chunkCh := make(chan *protocol.BinaryFrame, 64)
	m.downloadChansMu.Lock()
	m.downloadChans[t.ID] = chunkCh
	m.downloadChansMu.Unlock()
	defer func() {
		m.downloadChansMu.Lock()
		delete(m.downloadChans, t.ID)
		m.downloadChansMu.Unlock()
		close(chunkCh)
	}()

	// Send chunk_request to start receiving
	m.sendChunkRequest(t.ID, 0, -1) // Request all chunks

	receivedChunks := make(map[uint32]bool)
	var totalChunks uint32
	var receivedBytes int64

	timeout := time.NewTimer(5 * time.Minute)
	defer timeout.Stop()

	for {
		select {
		case <-at.cancel:
			return fmt.Errorf("transfer abgebrochen")

		case <-timeout.C:
			return fmt.Errorf("download-Timeout: %d/%d Chunks empfangen", len(receivedChunks), totalChunks)

		case frame := <-chunkCh:
			if frame == nil {
				continue
			}

			totalChunks = frame.Header.TotalChunks

			// Verify chunk hash
			chunkHash := hasher.Hash(frame.Payload)
			if !hasher.Verify(frame.Payload, frame.Header.SHA256) {
				m.logger.Printf("[Transfer] Chunk %d Hash-Fehler, überspringe", frame.Header.ChunkIndex)
				continue
			}
			_ = chunkHash

			// Decompress
			algo := compress.Algorithm(frame.Header.CompressionType)
			comp, err := compress.New(algo)
			if err != nil {
				return fmt.Errorf("dekompressor erstellen: %w", err)
			}
			decompressed, err := comp.Decompress(frame.Payload, int(frame.Header.UncompressedSize))
			if err != nil {
				return fmt.Errorf("chunk %d dekomprimieren: %w", frame.Header.ChunkIndex, err)
			}

			// Write chunk to temp file
			chunkPath := filepath.Join(tempDir, fmt.Sprintf("chunk-%06d.bin", frame.Header.ChunkIndex))
			if err := os.WriteFile(chunkPath, decompressed, 0o644); err != nil {
				return fmt.Errorf("chunk %d schreiben: %w", frame.Header.ChunkIndex, err)
			}

			receivedChunks[frame.Header.ChunkIndex] = true
			receivedBytes += int64(frame.Header.UncompressedSize)

			// Report progress
			if m.reporter != nil && totalChunks > 0 {
				progress := float64(len(receivedChunks)) / float64(totalChunks)
				m.reporter.SendTransferProgress(t.ID, progress, receivedBytes, 0)
			}

			// Reset timeout on each received chunk
			timeout.Reset(5 * time.Minute)

			// Check if all chunks received
			if uint32(len(receivedChunks)) >= totalChunks {
				goto reassemble
			}
		}
	}

reassemble:
	// Reassemble chunks into final file
	chunkSize := chunker.DefaultChunkSize
	if t.ChunkSize > 0 {
		chunkSize = t.ChunkSize
	}
	c, err := chunker.New(int64(chunkSize))
	if err != nil {
		return fmt.Errorf("chunker erstellen: %w", err)
	}

	if err := c.ReassembleFromDir(tempDir, fullPath, int(totalChunks)); err != nil {
		return fmt.Errorf("datei zusammensetzen: %w", err)
	}

	m.logger.Printf("[Transfer] Download %s abgeschlossen: %d Chunks, %d Bytes", t.ID, totalChunks, receivedBytes)
	return nil
}

// sendWithRetry sends a binary frame with exponential backoff retry.
func (m *Manager) sendWithRetry(at *activeTransfer, frame []byte, chunkIndex int, maxRetries int, baseDelay time.Duration) error {
	var lastErr error
	for attempt := 0; attempt <= maxRetries; attempt++ {
		select {
		case <-at.cancel:
			return fmt.Errorf("transfer abgebrochen")
		default:
		}

		if err := m.binarySender.SendBinaryMessage(frame); err != nil {
			lastErr = err
			delay := time.Duration(math.Pow(2, float64(attempt))) * baseDelay
			if delay > 30*time.Second {
				delay = 30 * time.Second
			}
			m.logger.Printf("[Transfer] Chunk %d senden fehlgeschlagen (Versuch %d/%d): %v, retry in %v",
				chunkIndex, attempt+1, maxRetries+1, err, delay)
			time.Sleep(delay)
			continue
		}
		return nil
	}
	return fmt.Errorf("nach %d Versuchen fehlgeschlagen: %w", maxRetries+1, lastErr)
}

// sendTransferCompleteMsg sends a transfer_complete JSON message after all chunks are sent.
func (m *Manager) sendTransferCompleteMsg(transferID string, fileHash string, totalChunks int) {
	if m.binarySender == nil {
		return
	}
	data, _ := json.Marshal(struct {
		TransferID  string `json:"transfer_id"`
		FileHash    string `json:"file_hash"`
		TotalChunks int    `json:"total_chunks"`
	}{
		TransferID:  transferID,
		FileHash:    fileHash,
		TotalChunks: totalChunks,
	})
	m.binarySender.SendMessage(transport.Message{
		Type: transport.MessageTypeTransferComplete,
		Data: data,
	})
}

// sendChunkRequest sends a chunk_request JSON message to the server.
func (m *Manager) sendChunkRequest(transferID string, fromIndex, toIndex int) {
	if m.binarySender == nil {
		return
	}
	data, _ := json.Marshal(struct {
		TransferID string `json:"transfer_id"`
		FromIndex  int    `json:"from_index"`
		ToIndex    int    `json:"to_index"`
	}{
		TransferID: transferID,
		FromIndex:  fromIndex,
		ToIndex:    toIndex,
	})
	m.binarySender.SendMessage(transport.Message{
		Type: transport.MessageTypeChunkRequest,
		Data: data,
	})
}

// parseCompression converts a compression string to the Algorithm type.
func parseCompression(s string) compress.Algorithm {
	switch s {
	case "zstd":
		return compress.Zstd
	case "lz4":
		return compress.LZ4
	default:
		return compress.None
	}
}

// parseTransferID attempts to parse a transfer ID string to uint32.
// Falls back to a hash-based approach for UUID-style IDs.
func parseTransferID(id string) uint32 {
	var result uint32
	for _, c := range id {
		result = result*31 + uint32(c)
	}
	return result
}

// --- Utility methods ---

// localCopy fuehrt eine lokale Dateikopie aus (Fallback).
func (m *Manager) localCopy(at *activeTransfer, srcPath, dstPath string) error {
	src, err := os.Open(srcPath)
	if err != nil {
		return fmt.Errorf("quell-Datei öffnen: %w", err)
	}
	defer src.Close()

	os.MkdirAll(filepath.Dir(dstPath), 0o755)
	dst, err := os.Create(dstPath)
	if err != nil {
		return fmt.Errorf("ziel-Datei erstellen: %w", err)
	}
	defer dst.Close()

	buf := make([]byte, 8*1024*1024)
	for {
		select {
		case <-at.cancel:
			os.Remove(dstPath)
			return fmt.Errorf("transfer abgebrochen")
		default:
		}

		n, err := src.Read(buf)
		if n > 0 {
			if _, wErr := dst.Write(buf[:n]); wErr != nil {
				return fmt.Errorf("schreiben fehlgeschlagen: %w", wErr)
			}
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("lesen fehlgeschlagen: %w", err)
		}
	}
	return nil
}

// progressReader wraps an io.Reader and reports progress.
type progressReader struct {
	reader     io.Reader
	total      int64
	read       int64
	transferID string
	reporter   ProgressReporter
	cancel     chan struct{}
	lastReport time.Time
}

func (pr *progressReader) Read(p []byte) (int, error) {
	select {
	case <-pr.cancel:
		return 0, fmt.Errorf("transfer abgebrochen")
	default:
	}

	n, err := pr.reader.Read(p)
	pr.read += int64(n)

	// Fortschritt alle 500ms melden
	if pr.reporter != nil && time.Since(pr.lastReport) > 500*time.Millisecond && pr.total > 0 {
		progress := float64(pr.read) / float64(pr.total)
		pr.reporter.SendTransferProgress(pr.transferID, progress, pr.read, pr.total)
		pr.lastReport = time.Now()
	}

	return n, err
}
