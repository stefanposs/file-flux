// Package engine orchestrates the chunked binary transfer lifecycle.
package engine

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/stefanposs/file-flux/backend/domain/transfer"
	"github.com/stefanposs/file-flux/backend/internal/engine/compress"
	"github.com/stefanposs/file-flux/backend/internal/engine/hasher"
	"github.com/stefanposs/file-flux/backend/internal/engine/protocol"
	"github.com/stefanposs/file-flux/backend/internal/engine/relay"
	"github.com/stefanposs/file-flux/backend/internal/engine/state"
)

// AgentDispatcher sends messages (JSON and binary) to connected agents.
type AgentDispatcher interface {
	SendToAgent(agentID int, message interface{}) error
	SendBinaryToAgent(agentID int, data []byte) error
	IsConnected(agentID int) bool
}

// EngineOpts configures the TransferEngine.
type EngineOpts struct {
	DefaultChunkSize int64
	Compression      string // "zstd", "lz4", "none"
	MaxRetries       int
	StaleTimeout     time.Duration
}

// TransferEngine orchestrates the entire chunked transfer lifecycle.
type TransferEngine struct {
	relay      *relay.Relay
	tracker    *state.Tracker
	dispatcher AgentDispatcher
	transfers  transfer.Repository
	chunks     transfer.ChunkRepository
	logger     *log.Logger
	opts       EngineOpts
}

// New creates a new TransferEngine.
func New(
	r *relay.Relay,
	tracker *state.Tracker,
	dispatcher AgentDispatcher,
	transfers transfer.Repository,
	chunks transfer.ChunkRepository,
	logger *log.Logger,
	opts EngineOpts,
) *TransferEngine {
	if opts.DefaultChunkSize == 0 {
		opts.DefaultChunkSize = 8 * 1024 * 1024
	}
	if opts.Compression == "" {
		opts.Compression = "zstd"
	}
	if opts.MaxRetries == 0 {
		opts.MaxRetries = 3
	}
	if opts.StaleTimeout == 0 {
		opts.StaleTimeout = 1 * time.Hour
	}

	return &TransferEngine{
		relay:      r,
		tracker:    tracker,
		dispatcher: dispatcher,
		transfers:  transfers,
		chunks:     chunks,
		logger:     logger,
		opts:       opts,
	}
}

// StartTransferRequest contains the parameters to start a chunked transfer.
type StartTransferRequest struct {
	TransferID      int
	SourceAgentID   int
	DestAgentID     *int
	SourcePath      string
	DestinationPath string
	Filename        string
	FileSize        int64
	ChunkSize       int64
	Compression     string
}

// StartTransfer initiates a new chunked transfer.
// It creates chunk records, sets up state tracking, and sends the transfer request
// to the source agent.
func (e *TransferEngine) StartTransfer(ctx context.Context, req StartTransferRequest) error {
	chunkSize := req.ChunkSize
	if chunkSize == 0 {
		chunkSize = e.opts.DefaultChunkSize
	}

	compression := req.Compression
	if compression == "" {
		compression = e.opts.Compression
	}

	// Calculate total chunks
	totalChunks := int(req.FileSize / chunkSize)
	if req.FileSize%chunkSize != 0 || req.FileSize == 0 {
		totalChunks++
	}

	// Create chunk records in DB
	if err := e.chunks.CreateChunks(ctx, req.TransferID, totalChunks); err != nil {
		return fmt.Errorf("creating chunk records: %w", err)
	}

	// Parse compression algorithm
	algo, err := compress.ParseAlgorithm(compression)
	if err != nil {
		algo = compress.Zstd
	}

	// Start in-flight tracking
	if err := e.tracker.Start(req.TransferID, uint32(totalChunks), [32]byte{}, state.TransferOpts{
		ChunkSize:   chunkSize,
		Compression: algo,
		Phase:       state.PhaseUpload,
	}); err != nil {
		return fmt.Errorf("starting tracker: %w", err)
	}

	// Send transfer request to source agent
	transferMsg := struct {
		Type string      `json:"type"`
		Data interface{} `json:"data"`
	}{
		Type: "transfer_request",
		Data: struct {
			Transfer struct {
				ID              string `json:"id"`
				SourcePath      string `json:"source_path"`
				DestinationPath string `json:"destination_path"`
				Compressed      bool   `json:"compressed"`
				ChunkSize       int    `json:"chunk_size"`
				TransferType    string `json:"transfer_type"`
				Protocol        string `json:"protocol"`
				TotalChunks     int    `json:"total_chunks"`
				Compression     string `json:"compression"`
			} `json:"transfer"`
		}{
			Transfer: struct {
				ID              string `json:"id"`
				SourcePath      string `json:"source_path"`
				DestinationPath string `json:"destination_path"`
				Compressed      bool   `json:"compressed"`
				ChunkSize       int    `json:"chunk_size"`
				TransferType    string `json:"transfer_type"`
				Protocol        string `json:"protocol"`
				TotalChunks     int    `json:"total_chunks"`
				Compression     string `json:"compression"`
			}{
				ID:              strconv.Itoa(req.TransferID),
				SourcePath:      req.SourcePath,
				DestinationPath: req.DestinationPath,
				Compressed:      algo != compress.None,
				ChunkSize:       int(chunkSize),
				TransferType:    "upload",
				Protocol:        "binary_ws",
				TotalChunks:     totalChunks,
				Compression:     compression,
			},
		},
	}

	if err := e.dispatcher.SendToAgent(req.SourceAgentID, transferMsg); err != nil {
		e.tracker.Remove(req.TransferID)
		return fmt.Errorf("dispatching to source agent %d: %w", req.SourceAgentID, err)
	}

	// Update transfer status to running
	e.transfers.UpdateStatus(ctx, req.TransferID, transfer.StatusRunning, "")

	e.logger.Printf("[ENGINE] Transfer %d started: %d chunks, compression=%s, source_agent=%d",
		req.TransferID, totalChunks, compression, req.SourceAgentID)

	return nil
}

// HandleChunkReceived processes an incoming binary chunk frame from a source agent.
func (e *TransferEngine) HandleChunkReceived(ctx context.Context, agentID int, header protocol.BinaryHeader, data []byte) error {
	transferID := int(header.TransferID)

	// Verify chunk hash
	chunkHash := hasher.Hash(data)
	if chunkHash != header.SHA256 {
		e.logger.Printf("[ENGINE] Transfer %d chunk %d hash mismatch from agent %d", transferID, header.ChunkIndex, agentID)
		e.sendChunkNack(agentID, transferID, header.ChunkIndex, "hash mismatch")
		return fmt.Errorf("chunk %d hash mismatch", header.ChunkIndex)
	}

	// Store chunk via relay
	if _, err := e.relay.StoreChunk(transferID, header.ChunkIndex, data); err != nil {
		return fmt.Errorf("storing chunk %d: %w", header.ChunkIndex, err)
	}

	// Update chunk status in DB
	hashHex := hasher.HexString(chunkHash)
	if err := e.chunks.MarkChunkReceived(ctx, transferID, int(header.ChunkIndex), hashHex, int(header.CompressedSize), int(header.UncompressedSize)); err != nil {
		e.logger.Printf("[ENGINE] Error updating chunk %d status: %v", header.ChunkIndex, err)
	}

	// Update in-flight state
	if err := e.tracker.MarkChunkComplete(transferID, header.ChunkIndex, int64(len(data))); err != nil {
		e.logger.Printf("[ENGINE] Error marking chunk complete in tracker: %v", err)
	}

	// Send ACK to agent
	e.sendChunkAck(agentID, transferID, header.ChunkIndex)

	// Update transfer progress
	completed, total, _ := e.tracker.GetProgress(transferID)
	e.transfers.UpdateChunkProgress(ctx, transferID, int(completed), int64(completed)*int64(header.UncompressedSize))

	e.logger.Printf("[ENGINE] Transfer %d chunk %d/%d received from agent %d",
		transferID, header.ChunkIndex+1, header.TotalChunks, agentID)

	// Check if all chunks received → trigger download phase
	if e.tracker.IsComplete(transferID) {
		e.logger.Printf("[ENGINE] Transfer %d all %d chunks received, checking for destination agent", transferID, total)
		return e.handleUploadComplete(ctx, transferID)
	}

	return nil
}

// handleUploadComplete is called when all chunks from the source agent are received.
func (e *TransferEngine) handleUploadComplete(ctx context.Context, transferID int) error {
	t, err := e.transfers.GetByID(ctx, transferID)
	if err != nil {
		return fmt.Errorf("getting transfer %d: %w", transferID, err)
	}

	// If there is a destination agent, dispatch download
	if t.DestinationAgentID != nil {
		return e.dispatchDownload(ctx, t)
	}

	// No destination agent — transfer is complete (backend-only storage)
	e.transfers.UpdateStatus(ctx, transferID, transfer.StatusCompleted, "")
	e.tracker.Remove(transferID)
	e.logger.Printf("[ENGINE] Transfer %d completed (no destination agent)", transferID)
	return nil
}

// dispatchDownload sends the download request to the destination agent.
func (e *TransferEngine) dispatchDownload(ctx context.Context, t *transfer.Transfer) error {
	destAgentID := *t.DestinationAgentID

	// Update tracker phase
	e.tracker.Remove(t.ID)

	totalChunks := t.TotalChunks
	if totalChunks == 0 {
		totalChunks = 1
	}

	// Start new tracker for download phase
	algo, _ := compress.ParseAlgorithm(t.Compression)
	e.tracker.Start(t.ID, uint32(totalChunks), [32]byte{}, state.TransferOpts{
		ChunkSize:   int64(t.ChunkSize),
		Compression: algo,
		Phase:       state.PhaseDownload,
	})

	downloadMsg := struct {
		Type string      `json:"type"`
		Data interface{} `json:"data"`
	}{
		Type: "transfer_request",
		Data: struct {
			Transfer struct {
				ID              string `json:"id"`
				SourcePath      string `json:"source_path"`
				DestinationPath string `json:"destination_path"`
				Compressed      bool   `json:"compressed"`
				ChunkSize       int    `json:"chunk_size"`
				TransferType    string `json:"transfer_type"`
				Protocol        string `json:"protocol"`
				TotalChunks     int    `json:"total_chunks"`
				Compression     string `json:"compression"`
			} `json:"transfer"`
		}{
			Transfer: struct {
				ID              string `json:"id"`
				SourcePath      string `json:"source_path"`
				DestinationPath string `json:"destination_path"`
				Compressed      bool   `json:"compressed"`
				ChunkSize       int    `json:"chunk_size"`
				TransferType    string `json:"transfer_type"`
				Protocol        string `json:"protocol"`
				TotalChunks     int    `json:"total_chunks"`
				Compression     string `json:"compression"`
			}{
				ID:              strconv.Itoa(t.ID),
				SourcePath:      t.SourcePath,
				DestinationPath: t.DestinationPath,
				Compressed:      algo != compress.None,
				ChunkSize:       t.ChunkSize,
				TransferType:    "download",
				Protocol:        "binary_ws",
				TotalChunks:     totalChunks,
				Compression:     t.Compression,
			},
		},
	}

	if err := e.dispatcher.SendToAgent(destAgentID, downloadMsg); err != nil {
		e.tracker.Remove(t.ID)
		e.transfers.UpdateStatus(ctx, t.ID, transfer.StatusFailed, "destination agent not connected")
		return fmt.Errorf("dispatching download to agent %d: %w", destAgentID, err)
	}

	e.logger.Printf("[ENGINE] Transfer %d download dispatched to agent %d", t.ID, destAgentID)
	return nil
}

// HandleChunkRequest serves a stored chunk to the destination agent as a binary frame.
func (e *TransferEngine) HandleChunkRequest(ctx context.Context, agentID int, transferID int, chunkIndex uint32) error {
	// Get the stored chunk
	data, err := e.relay.GetChunk(transferID, chunkIndex)
	if err != nil {
		return fmt.Errorf("getting chunk %d for transfer %d: %w", chunkIndex, transferID, err)
	}

	// Get chunk hash
	chunkHash := hasher.Hash(data)

	// Get transfer info for total chunks
	t, err := e.transfers.GetByID(ctx, transferID)
	if err != nil {
		return fmt.Errorf("getting transfer %d: %w", transferID, err)
	}

	// Build binary frame
	algo, _ := compress.ParseAlgorithm(t.Compression)
	header := protocol.BinaryHeader{
		TransferID:       uint32(transferID),
		ChunkIndex:       chunkIndex,
		TotalChunks:      uint32(t.TotalChunks),
		SHA256:           chunkHash,
		UncompressedSize: uint32(len(data)),
		CompressionType:  uint8(algo),
	}

	frame, err := protocol.EncodeFrame(header, data)
	if err != nil {
		return fmt.Errorf("encoding frame: %w", err)
	}

	if err := e.dispatcher.SendBinaryToAgent(agentID, frame); err != nil {
		return fmt.Errorf("sending binary frame to agent %d: %w", agentID, err)
	}

	e.logger.Printf("[ENGINE] Transfer %d chunk %d sent to agent %d", transferID, chunkIndex, agentID)
	return nil
}

// HandleTransferComplete processes transfer completion from the destination agent.
func (e *TransferEngine) HandleTransferComplete(ctx context.Context, agentID int, transferID int, fileHash string) error {
	// Update transfer status
	if fileHash != "" {
		e.transfers.UpdateFileHash(ctx, transferID, fileHash)
	}
	e.transfers.UpdateStatus(ctx, transferID, transfer.StatusCompleted, "")

	// Cleanup
	e.tracker.Remove(transferID)
	if err := e.relay.CleanupTransfer(transferID); err != nil {
		e.logger.Printf("[ENGINE] Error cleaning up transfer %d relay: %v", transferID, err)
	}

	e.logger.Printf("[ENGINE] Transfer %d completed", transferID)
	return nil
}

// ResumeTransfer resumes a failed/interrupted transfer.
func (e *TransferEngine) ResumeTransfer(ctx context.Context, transferID int) error {
	t, err := e.transfers.GetByID(ctx, transferID)
	if err != nil {
		return fmt.Errorf("getting transfer: %w", err)
	}
	if t.Status != transfer.StatusFailed && t.Status != transfer.StatusSuspended {
		return fmt.Errorf("transfer %d cannot be resumed (status: %s)", transferID, t.Status)
	}

	pendingChunks, err := e.chunks.GetPendingChunks(ctx, transferID)
	if err != nil {
		return fmt.Errorf("getting pending chunks: %w", err)
	}

	// All chunks received, try to complete
	if len(pendingChunks) == 0 {
		return e.handleUploadComplete(ctx, transferID)
	}

	// Update retry count
	t.RetryCount++
	if t.RetryCount > t.MaxRetries {
		e.transfers.UpdateStatus(ctx, transferID, transfer.StatusFailed, "max retries exceeded")
		return fmt.Errorf("transfer %d max retries exceeded", transferID)
	}

	// Determine which agent to send to
	agentID := 0
	if t.SourceAgentID != nil {
		agentID = *t.SourceAgentID
	}
	if agentID == 0 {
		return fmt.Errorf("no source agent for transfer %d", transferID)
	}

	// Restart tracking
	algo, _ := compress.ParseAlgorithm(t.Compression)
	e.tracker.Start(transferID, uint32(t.TotalChunks), [32]byte{}, state.TransferOpts{
		ChunkSize:   int64(t.ChunkSize),
		Compression: algo,
		Phase:       state.PhaseUpload,
	})

	// Mark already-received chunks in tracker
	completedCount, _ := e.chunks.GetCompletedCount(ctx, transferID)
	_ = completedCount

	resumeFrom := 0
	if len(pendingChunks) > 0 {
		resumeFrom = pendingChunks[0]
	}

	// Send resume request
	resumeMsg := struct {
		Type string      `json:"type"`
		Data interface{} `json:"data"`
	}{
		Type: "transfer_request",
		Data: struct {
			Transfer struct {
				ID              string `json:"id"`
				SourcePath      string `json:"source_path"`
				DestinationPath string `json:"destination_path"`
				ChunkSize       int    `json:"chunk_size"`
				TransferType    string `json:"transfer_type"`
				Protocol        string `json:"protocol"`
				TotalChunks     int    `json:"total_chunks"`
				Compression     string `json:"compression"`
				ResumeFromChunk int    `json:"resume_from_chunk"`
			} `json:"transfer"`
		}{
			Transfer: struct {
				ID              string `json:"id"`
				SourcePath      string `json:"source_path"`
				DestinationPath string `json:"destination_path"`
				ChunkSize       int    `json:"chunk_size"`
				TransferType    string `json:"transfer_type"`
				Protocol        string `json:"protocol"`
				TotalChunks     int    `json:"total_chunks"`
				Compression     string `json:"compression"`
				ResumeFromChunk int    `json:"resume_from_chunk"`
			}{
				ID:              strconv.Itoa(transferID),
				SourcePath:      t.SourcePath,
				DestinationPath: t.DestinationPath,
				ChunkSize:       t.ChunkSize,
				TransferType:    "upload",
				Protocol:        "binary_ws",
				TotalChunks:     t.TotalChunks,
				Compression:     t.Compression,
				ResumeFromChunk: resumeFrom,
			},
		},
	}

	if err := e.dispatcher.SendToAgent(agentID, resumeMsg); err != nil {
		e.tracker.Remove(transferID)
		return fmt.Errorf("resuming transfer %d: %w", transferID, err)
	}

	e.transfers.UpdateStatus(ctx, transferID, transfer.StatusRunning, "")
	e.logger.Printf("[ENGINE] Transfer %d resumed from chunk %d", transferID, resumeFrom)
	return nil
}

// CancelTransfer cancels an in-flight transfer.
func (e *TransferEngine) CancelTransfer(ctx context.Context, transferID int) error {
	t, err := e.transfers.GetByID(ctx, transferID)
	if err != nil {
		return fmt.Errorf("getting transfer: %w", err)
	}

	// Send cancel to both agents
	cancelMsg := struct {
		Type string      `json:"type"`
		Data interface{} `json:"data"`
	}{
		Type: "cancel_transfer",
		Data: struct {
			TransferID string `json:"transfer_id"`
		}{
			TransferID: strconv.Itoa(transferID),
		},
	}

	if t.SourceAgentID != nil {
		e.dispatcher.SendToAgent(*t.SourceAgentID, cancelMsg)
	}
	if t.DestinationAgentID != nil {
		e.dispatcher.SendToAgent(*t.DestinationAgentID, cancelMsg)
	}

	// Cleanup
	e.tracker.Remove(transferID)
	e.relay.CleanupTransfer(transferID)
	e.transfers.UpdateStatus(ctx, transferID, transfer.StatusCancelled, "cancelled by user")

	e.logger.Printf("[ENGINE] Transfer %d cancelled", transferID)
	return nil
}

// CleanupStaleTransfers marks stale transfers as failed and cleans up their resources.
func (e *TransferEngine) CleanupStaleTransfers(ctx context.Context) {
	stale := e.tracker.StaleTransfers(e.opts.StaleTimeout)
	for _, transferID := range stale {
		e.logger.Printf("[ENGINE] Transfer %d is stale, marking as failed", transferID)
		e.transfers.UpdateStatus(ctx, transferID, transfer.StatusFailed, "transfer timed out")
		e.tracker.Remove(transferID)
		e.relay.CleanupTransfer(transferID)
	}
}

// IsChunkedTransfer checks if a transfer is using the chunked binary protocol.
func (e *TransferEngine) IsChunkedTransfer(transferID int) bool {
	_, err := e.tracker.GetState(transferID)
	return err == nil
}

// sendChunkAck sends a chunk acknowledgement to the agent.
func (e *TransferEngine) sendChunkAck(agentID int, transferID int, chunkIndex uint32) {
	ack := struct {
		Type string      `json:"type"`
		Data interface{} `json:"data"`
	}{
		Type: "chunk_ack",
		Data: struct {
			TransferID string `json:"transfer_id"`
			ChunkIndex uint32 `json:"chunk_index"`
		}{
			TransferID: strconv.Itoa(transferID),
			ChunkIndex: chunkIndex,
		},
	}
	if err := e.dispatcher.SendToAgent(agentID, ack); err != nil {
		e.logger.Printf("[ENGINE] Error sending chunk_ack to agent %d: %v", agentID, err)
	}
}

// sendChunkNack sends a chunk rejection to the agent.
func (e *TransferEngine) sendChunkNack(agentID int, transferID int, chunkIndex uint32, reason string) {
	nack := struct {
		Type string      `json:"type"`
		Data interface{} `json:"data"`
	}{
		Type: "chunk_nack",
		Data: struct {
			TransferID string `json:"transfer_id"`
			ChunkIndex uint32 `json:"chunk_index"`
			Reason     string `json:"reason"`
		}{
			TransferID: strconv.Itoa(transferID),
			ChunkIndex: chunkIndex,
			Reason:     reason,
		},
	}
	if err := e.dispatcher.SendToAgent(agentID, nack); err != nil {
		e.logger.Printf("[ENGINE] Error sending chunk_nack to agent %d: %v", agentID, err)
	}
}

// HandleAgentMessage processes a JSON message from an agent in context of the engine.
// Returns true if the engine handled the message, false if it should be handled by the legacy path.
func (e *TransferEngine) HandleAgentMessage(ctx context.Context, agentID int, msgType string, data json.RawMessage) bool {
	switch msgType {
	case "chunk_request":
		var req struct {
			TransferID string `json:"transfer_id"`
			ChunkIndex uint32 `json:"chunk_index"`
		}
		if err := json.Unmarshal(data, &req); err != nil {
			e.logger.Printf("[ENGINE] Error parsing chunk_request: %v", err)
			return true
		}
		transferID, _ := strconv.Atoi(req.TransferID)
		if err := e.HandleChunkRequest(ctx, agentID, transferID, req.ChunkIndex); err != nil {
			e.logger.Printf("[ENGINE] Error handling chunk_request: %v", err)
		}
		return true

	case "transfer_resume":
		var req struct {
			TransferID string `json:"transfer_id"`
		}
		if err := json.Unmarshal(data, &req); err != nil {
			e.logger.Printf("[ENGINE] Error parsing transfer_resume: %v", err)
			return true
		}
		transferID, _ := strconv.Atoi(req.TransferID)
		if err := e.ResumeTransfer(ctx, transferID); err != nil {
			e.logger.Printf("[ENGINE] Error resuming transfer: %v", err)
		}
		return true

	default:
		return false
	}
}
