# File Flux Agent — Implementation Plan

**Version:** 1.0  
**Date:** 2026-02-12  
**Status:** Approved  
**Go Version:** 1.22+  
**Module:** `github.com/stefanposs/file-flux/agent`

---

## Table of Contents

1. [Package Structure](#1-package-structure)
2. [Key Types & Interfaces](#2-key-types--interfaces)
3. [WebSocket Protocol Implementation](#3-websocket-protocol-implementation)
4. [Transfer Flow Diagrams](#4-transfer-flow-diagrams)
5. [Service Installation](#5-service-installation)
6. [CLI Command Implementation](#6-cli-command-implementation)
7. [Build Matrix](#7-build-matrix)
8. [Dependencies](#8-dependencies)
9. [Phased Implementation](#9-phased-implementation)

---

## 1. Package Structure

### Target Layout

```
agent/
├── cmd/
│   └── agent/
│       └── main.go                          # Cobra root command, CLI entry point
├── internal/
│   ├── buildinfo/
│   │   └── version.go                       # Build-time injected version, commit, date
│   ├── cli/
│   │   ├── root.go                          # Cobra root command definition
│   │   ├── start.go                         # `start` subcommand (foreground)
│   │   ├── install.go                       # `install` subcommand (service install)
│   │   ├── uninstall.go                     # `uninstall` subcommand
│   │   ├── status.go                        # `status` subcommand
│   │   ├── test_connection.go               # `test-connection` subcommand
│   │   ├── version.go                       # `version` subcommand
│   │   └── config_cmd.go                    # `config validate` / `config init` subcommands
│   ├── config/
│   │   ├── config.go                        # Config struct + YAML loading + env overlay
│   │   ├── config_test.go                   # Config unit tests
│   │   └── validate.go                      # Config validation rules
│   ├── engine/
│   │   ├── engine.go                        # TransferEngine — orchestrates transfers
│   │   ├── engine_test.go
│   │   ├── chunker.go                       # File → chunks, chunks → file
│   │   ├── chunker_test.go
│   │   ├── compressor.go                    # Compressor interface + zstd/lz4/none impls
│   │   ├── compressor_test.go
│   │   ├── hasher.go                        # SHA-256 per-chunk + whole-file hasher
│   │   ├── hasher_test.go
│   │   ├── progress.go                      # Progress tracking per transfer
│   │   ├── progress_test.go
│   │   ├── state.go                         # Transfer state machine + persistence
│   │   └── state_test.go
│   ├── models/
│   │   ├── chunk.go                         # Chunk, ChunkMeta types
│   │   ├── transfer.go                      # Transfer, TransferRequest, TransferState
│   │   ├── messages.go                      # All WebSocket message types (shared w/ backend)
│   │   └── errors.go                        # Sentinel errors
│   ├── service/
│   │   ├── service.go                       # Platform service interface
│   │   ├── service_linux.go                 # systemd implementation (build-tagged)
│   │   ├── service_darwin.go                # launchd implementation (build-tagged)
│   │   └── service_windows.go              # Windows Service implementation (build-tagged)
│   ├── system/
│   │   ├── sysinfo.go                       # System info collection (existing, enhanced)
│   │   └── sysinfo_test.go
│   ├── watcher/
│   │   ├── watcher.go                       # FileWatcher interface + fsnotify impl
│   │   ├── watcher_test.go
│   │   └── glob.go                          # Glob pattern matching helpers
│   └── ws/
│       ├── client.go                        # WebSocket client (connect, reconnect, read/write)
│       ├── client_test.go
│       ├── handler.go                       # Message router — dispatches to handlers
│       ├── handler_test.go
│       └── sender.go                        # Outbound message helper (JSON + binary frames)
├── config.yaml                              # Default/example config
├── Makefile                                 # Build targets (updated)
├── Dockerfile                               # Multi-stage build
├── install.sh                               # Linux/macOS installer (updated)
├── install.ps1                              # Windows installer (updated)
├── go.mod
└── go.sum
```

### Package Responsibility Matrix

| Package | Responsibility | Depends On |
|---------|---------------|------------|
| `cmd/agent` | Binary entry point, calls `cli.Execute()` | `cli` |
| `internal/cli` | Cobra commands, wires dependencies | `config`, `engine`, `ws`, `watcher`, `service`, `buildinfo` |
| `internal/config` | Load/validate/default config from YAML + env | — |
| `internal/engine` | Core transfer logic: chunk, compress, hash, assemble | `models`, `config` |
| `internal/models` | Domain types, message types, errors | — |
| `internal/service` | Platform service install/uninstall/status | `config` |
| `internal/system` | OS/hardware info collection | — |
| `internal/watcher` | Filesystem watching with glob filters | `models` |
| `internal/ws` | WebSocket client, message routing, reconnect | `models`, `engine` |
| `internal/buildinfo` | Version/commit/build-time constants | — |

---

## 2. Key Types & Interfaces

### 2.1 `internal/buildinfo/version.go`

```go
package buildinfo

// Set via ldflags at build time.
var (
    Version   = "dev"
    Commit    = "unknown"
    BuildDate = "unknown"
)

// Info returns a formatted version string.
func Info() string {
    return fmt.Sprintf("fileflux-agent %s (commit: %s, built: %s)", Version, Commit, BuildDate)
}
```

### 2.2 `internal/config/config.go` — Expanded Config

```go
package config

import (
    "time"
)

// Config is the root agent configuration.
type Config struct {
    Connection       ConnectionConfig  `yaml:"connection"`
    Agent            AgentConfig       `yaml:"agent"`
    Transfers        TransferConfig    `yaml:"transfers"`
    WatchDirectories []WatchDirConfig  `yaml:"watch_directories"`
    Logging          LoggingConfig     `yaml:"logging"`
}

type ConnectionConfig struct {
    ServerURL            string        `yaml:"server_url"`
    Token                string        `yaml:"token"`
    ReconnectInterval    time.Duration `yaml:"reconnect_interval"`
    MaxReconnectAttempts int           `yaml:"max_reconnect_attempts"` // 0 = infinite
    PingInterval         time.Duration `yaml:"ping_interval"`
    WriteTimeout         time.Duration `yaml:"write_timeout"`
    ReadTimeout          time.Duration `yaml:"read_timeout"`
}

type AgentConfig struct {
    Name  string `yaml:"name"`
    Type  string `yaml:"type"`  // "server" or "client"
    Group string `yaml:"group"`
}

type TransferConfig struct {
    ChunkSize              int           `yaml:"chunk_size"`    // bytes, default 4194304 (4MB)
    Compression            string        `yaml:"compression"`  // "zstd", "lz4", "none"
    CompressionLevel       int           `yaml:"compression_level"` // zstd: 1-19, lz4: ignored
    ParallelChunks         int           `yaml:"parallel_chunks"`   // default 4
    MaxConcurrentTransfers int           `yaml:"max_concurrent_transfers"` // default 3
    TempDirectory          string        `yaml:"temp_directory"`
    MaxRetries             int           `yaml:"max_retries"`        // per-chunk retry, default 3
    RetryBackoff           time.Duration `yaml:"retry_backoff"`      // default 2s
    HashAlgorithm          string        `yaml:"hash_algorithm"`     // "sha256" (only option for now)
}

type WatchDirConfig struct {
    Path           string `yaml:"path"`
    Pattern        string `yaml:"pattern"`          // glob, e.g. "*.csv"
    Recursive      bool   `yaml:"recursive"`
    PostAction     string `yaml:"post_action"`      // "delete", "move", "archive", "none"
    PostActionPath string `yaml:"post_action_path"` // destination for move/archive
}

type LoggingConfig struct {
    Level      string `yaml:"level"`       // "debug", "info", "warn", "error"
    File       string `yaml:"file"`        // empty = stdout only
    MaxSize    int    `yaml:"max_size"`    // MB
    MaxBackups int    `yaml:"max_backups"`
    MaxAge     int    `yaml:"max_age"`     // days
}

// Load reads config from path, applies defaults, overlays env vars.
func Load(path string) (*Config, error) { ... }

// Validate checks config for logical errors.
func (c *Config) Validate() error { ... }

// WriteDefault writes a default config to the given path.
func WriteDefault(path string) error { ... }
```

### 2.3 `internal/models/chunk.go`

```go
package models

// ChunkMeta describes a single chunk of a file.
type ChunkMeta struct {
    Index      int    `json:"index"`
    Offset     int64  `json:"offset"`      // byte offset in original file
    Size       int    `json:"size"`         // uncompressed size in bytes
    Hash       string `json:"hash"`         // SHA-256 hex of uncompressed data
    Compressed bool   `json:"compressed"`
}

// Chunk is the in-flight representation: metadata + payload.
type Chunk struct {
    TransferID string `json:"transfer_id"`
    Meta       ChunkMeta
    Data       []byte `json:"-"` // sent as binary WebSocket frame, not JSON
}
```

### 2.4 `internal/models/transfer.go`

```go
package models

import "time"

// TransferDirection distinguishes sender from receiver.
type TransferDirection string

const (
    DirectionUpload   TransferDirection = "upload"   // source agent → backend → dest
    DirectionDownload TransferDirection = "download"  // dest agent ← backend ← source
)

// TransferState is the state machine for a single transfer.
type TransferState string

const (
    StateQueued      TransferState = "queued"
    StateHashing     TransferState = "hashing"
    StateTransferring TransferState = "transferring"
    StateAssembling  TransferState = "assembling"
    StateVerifying   TransferState = "verifying"
    StateCompleted   TransferState = "completed"
    StateFailed      TransferState = "failed"
    StateCancelled   TransferState = "cancelled"
    StatePaused      TransferState = "paused"
)

// Transfer is the agent-side representation of an active transfer.
type Transfer struct {
    ID              string            `json:"id"`
    JobID           string            `json:"job_id"`
    Direction       TransferDirection `json:"direction"`
    State           TransferState     `json:"state"`
    SourcePath      string            `json:"source_path"`
    DestinationPath string            `json:"destination_path"`
    FileName        string            `json:"file_name"`
    FileSize        int64             `json:"file_size"`
    FileHash        string            `json:"file_hash"`     // whole-file SHA-256
    ChunkSize       int               `json:"chunk_size"`
    TotalChunks     int               `json:"total_chunks"`
    CompletedChunks map[int]bool      `json:"completed_chunks"` // for resume
    Compression     string            `json:"compression"`
    StartedAt       time.Time         `json:"started_at"`
    Error           string            `json:"error,omitempty"`
}

// Progress returns the transfer progress as 0.0–1.0.
func (t *Transfer) Progress() float64 {
    if t.TotalChunks == 0 {
        return 0
    }
    return float64(len(t.CompletedChunks)) / float64(t.TotalChunks)
}

// TransferRequest is sent by the backend to initiate a transfer.
type TransferRequest struct {
    TransferID       string `json:"transfer_id"`
    JobID            string `json:"job_id"`
    SourcePath       string `json:"source_path"`
    DestinationPath  string `json:"destination_path"`
    Direction        string `json:"direction"`       // "upload" or "download"
    ChunkSize        int    `json:"chunk_size"`
    Compression      string `json:"compression"`
    DestinationAgent string `json:"destination_agent,omitempty"`
}
```

### 2.5 `internal/models/messages.go` — WebSocket Message Types

```go
package models

import (
    "encoding/json"
    "time"
)

// MessageType is the discriminator for WebSocket JSON messages.
type MessageType string

// --- Backend → Agent ---
const (
    MsgTransferStart  MessageType = "transfer.start"
    MsgTransferChunk  MessageType = "transfer.chunk"
    MsgTransferCancel MessageType = "transfer.cancel"
    MsgTransferStatus MessageType = "transfer.status"
    MsgJobExecute     MessageType = "job.execute"
    MsgConfigUpdate   MessageType = "config.update"
    MsgPing           MessageType = "ping"
)

// --- Agent → Backend ---
const (
    MsgChunkData         MessageType = "transfer.chunk"
    MsgTransferProgress  MessageType = "transfer.progress"
    MsgTransferComplete  MessageType = "transfer.complete"
    MsgTransferFailed    MessageType = "transfer.failed"
    MsgAgentInfo         MessageType = "agent.info"
    MsgAgentHeartbeat    MessageType = "agent.heartbeat"
    MsgPong              MessageType = "pong"
)

// Envelope is the outer wrapper for all WebSocket JSON messages.
type Envelope struct {
    Type MessageType     `json:"type"`
    Data json.RawMessage `json:"data"`
}

// --- Outbound messages (Agent → Backend) ---

type ProgressMessage struct {
    TransferID     string  `json:"transfer_id"`
    Progress       float64 `json:"progress"`        // 0.0–1.0
    CurrentChunk   int     `json:"current_chunk"`
    TotalChunks    int     `json:"total_chunks"`
    BytesSent      int64   `json:"bytes_sent"`
    TotalBytes     int64   `json:"total_bytes"`
    BytesPerSecond int64   `json:"bytes_per_second"`
    ETA            int64   `json:"eta_ms"`
}

type CompleteMessage struct {
    TransferID string `json:"transfer_id"`
    FileHash   string `json:"file_hash"`   // whole-file SHA-256
    FileSize   int64  `json:"file_size"`
    DurationMs int64  `json:"duration_ms"`
}

type FailedMessage struct {
    TransferID string `json:"transfer_id"`
    Error      string `json:"error"`
    Retryable  bool   `json:"retryable"`
}

type HeartbeatMessage struct {
    Timestamp       time.Time `json:"timestamp"`
    ActiveTransfers int       `json:"active_transfers"`
    CPUPercent      float64   `json:"cpu_percent"`
    MemPercent      float64   `json:"mem_percent"`
    DiskFreeBytes   int64     `json:"disk_free_bytes"`
}

// --- Inbound messages (Backend → Agent) ---

type TransferStartMessage struct {
    Transfer TransferRequest `json:"transfer"`
}

// ChunkHeader is sent as a JSON preamble before the binary chunk data.
// Binary protocol: [2-byte header length][JSON header][chunk bytes]
type ChunkHeader struct {
    TransferID string `json:"transfer_id"`
    Index      int    `json:"index"`
    Size       int    `json:"size"`        // compressed size
    OrigSize   int    `json:"orig_size"`   // uncompressed size
    Hash       string `json:"hash"`        // SHA-256 of uncompressed data
    Compressed bool   `json:"compressed"`
    Final      bool   `json:"final"`       // last chunk flag
}

type CancelMessage struct {
    TransferID string `json:"transfer_id"`
    Reason     string `json:"reason"`
}

type StatusRequestMessage struct {
    TransferID string `json:"transfer_id"`
}

type JobExecuteMessage struct {
    JobID      string `json:"job_id"`
    SourcePath string `json:"source_path"`
    DestPath   string `json:"destination_path"`
    Direction  string `json:"direction"`
}
```

### 2.6 `internal/models/errors.go`

```go
package models

import "errors"

var (
    ErrTransferNotFound    = errors.New("transfer not found")
    ErrTransferCancelled   = errors.New("transfer cancelled")
    ErrChunkHashMismatch   = errors.New("chunk hash mismatch")
    ErrFileHashMismatch    = errors.New("file hash mismatch")
    ErrMaxRetriesExceeded  = errors.New("max retries exceeded")
    ErrInvalidChunkIndex   = errors.New("invalid chunk index")
    ErrTransferInProgress  = errors.New("transfer already in progress")
    ErrConnectionLost      = errors.New("websocket connection lost")
    ErrNotConnected        = errors.New("not connected to server")
    ErrMaxTransfersReached = errors.New("max concurrent transfers reached")
)
```

### 2.7 `internal/engine/engine.go` — TransferEngine

```go
package engine

import (
    "context"
    "log/slog"
    "sync"

    "github.com/stefanposs/file-flux/agent/internal/config"
    "github.com/stefanposs/file-flux/agent/internal/models"
)

// ChunkSender is the callback the engine uses to send chunk data outbound.
// Implemented by the WebSocket sender.
type ChunkSender interface {
    SendChunk(ctx context.Context, header models.ChunkHeader, data []byte) error
    SendProgress(ctx context.Context, msg models.ProgressMessage) error
    SendComplete(ctx context.Context, msg models.CompleteMessage) error
    SendFailed(ctx context.Context, msg models.FailedMessage) error
}

// Engine orchestrates all active file transfers.
type Engine struct {
    cfg        config.TransferConfig
    sender     ChunkSender
    logger     *slog.Logger

    mu         sync.RWMutex
    transfers  map[string]*activeTransfer // keyed by transfer ID
    sem        chan struct{}              // concurrency semaphore

    chunker    *Chunker
    compressor Compressor
    hasher     *Hasher
}

// activeTransfer wraps a models.Transfer with runtime state.
type activeTransfer struct {
    transfer *models.Transfer
    cancel   context.CancelFunc
    mu       sync.Mutex
}

// New creates a new transfer Engine.
func New(cfg config.TransferConfig, sender ChunkSender, logger *slog.Logger) (*Engine, error) {
    comp, err := NewCompressor(cfg.Compression, cfg.CompressionLevel)
    if err != nil {
        return nil, fmt.Errorf("creating compressor: %w", err)
    }

    return &Engine{
        cfg:        cfg,
        sender:     sender,
        logger:     logger,
        transfers:  make(map[string]*activeTransfer),
        sem:        make(chan struct{}, cfg.MaxConcurrentTransfers),
        chunker:    NewChunker(cfg.ChunkSize),
        compressor: comp,
        hasher:     NewHasher(),
    }, nil
}

// StartUpload begins a push transfer: read file → chunk → compress → hash → send.
func (e *Engine) StartUpload(ctx context.Context, req models.TransferRequest) error { ... }

// ReceiveChunk handles an inbound chunk during a pull transfer.
func (e *Engine) ReceiveChunk(ctx context.Context, header models.ChunkHeader, data []byte) error { ... }

// CancelTransfer cancels an active transfer.
func (e *Engine) CancelTransfer(transferID string) error { ... }

// GetTransfer returns the current state of a transfer.
func (e *Engine) GetTransfer(transferID string) (*models.Transfer, error) { ... }

// ActiveCount returns the number of active transfers.
func (e *Engine) ActiveCount() int { ... }

// StopAll cancels all active transfers and waits for completion.
func (e *Engine) StopAll() { ... }
```

### 2.8 `internal/engine/chunker.go`

```go
package engine

import (
    "io"
    "os"

    "github.com/stefanposs/file-flux/agent/internal/models"
)

// Chunker splits files into fixed-size chunks and reassembles them.
type Chunker struct {
    chunkSize int
}

// NewChunker creates a Chunker with the given chunk size in bytes.
func NewChunker(chunkSize int) *Chunker {
    return &Chunker{chunkSize: chunkSize}
}

// ChunkCount returns the total number of chunks for a file of the given size.
func (c *Chunker) ChunkCount(fileSize int64) int { ... }

// ReadChunk reads chunk at index from the file. Returns the raw bytes and metadata.
func (c *Chunker) ReadChunk(f *os.File, index int) ([]byte, models.ChunkMeta, error) { ... }

// ChunkIterator returns a function that yields successive chunks.
// Useful for streaming without loading entire file into memory.
func (c *Chunker) ChunkIterator(f *os.File, fileSize int64) func() ([]byte, models.ChunkMeta, error) { ... }

// Assembler manages writing received chunks to a temp file and renaming on completion.
type Assembler struct {
    destPath    string
    tmpPath     string
    tmpFile     *os.File
    totalChunks int
    fileSize    int64
    received    map[int]bool
}

// NewAssembler creates an Assembler for the given destination.
// It creates a .tmp file alongside the destination.
func NewAssembler(destPath string, totalChunks int, fileSize int64) (*Assembler, error) { ... }

// WriteChunk writes a chunk at the correct offset in the temp file.
// Chunks can arrive out of order.
func (a *Assembler) WriteChunk(index int, offset int64, data []byte) error { ... }

// IsComplete returns true if all chunks have been received.
func (a *Assembler) IsComplete() bool { ... }

// Finalize renames the temp file to the final destination atomically.
func (a *Assembler) Finalize() error { ... }

// Abort removes the temp file.
func (a *Assembler) Abort() error { ... }
```

### 2.9 `internal/engine/compressor.go`

```go
package engine

// Compressor defines the compression/decompression interface.
type Compressor interface {
    // Compress compresses data. Returns compressed bytes.
    Compress(data []byte) ([]byte, error)

    // Decompress decompresses data. Returns original bytes.
    Decompress(data []byte) ([]byte, error)

    // Name returns the compression algorithm name ("zstd", "lz4", "none").
    Name() string
}

// NewCompressor creates a Compressor for the named algorithm.
// Supported: "zstd" (default), "lz4", "none".
func NewCompressor(name string, level int) (Compressor, error) { ... }

// --- Implementations ---

// zstdCompressor uses github.com/klauspost/compress/zstd.
type zstdCompressor struct {
    encoder *zstd.Encoder
    decoder *zstd.Decoder
}

func (c *zstdCompressor) Compress(data []byte) ([]byte, error)   { ... }
func (c *zstdCompressor) Decompress(data []byte) ([]byte, error) { ... }
func (c *zstdCompressor) Name() string                           { return "zstd" }

// lz4Compressor uses github.com/pierrec/lz4/v4.
type lz4Compressor struct{}

func (c *lz4Compressor) Compress(data []byte) ([]byte, error)   { ... }
func (c *lz4Compressor) Decompress(data []byte) ([]byte, error) { ... }
func (c *lz4Compressor) Name() string                           { return "lz4" }

// noopCompressor passes data through unchanged.
type noopCompressor struct{}

func (c *noopCompressor) Compress(data []byte) ([]byte, error)   { return data, nil }
func (c *noopCompressor) Decompress(data []byte) ([]byte, error) { return data, nil }
func (c *noopCompressor) Name() string                           { return "none" }
```

### 2.10 `internal/engine/hasher.go`

```go
package engine

import (
    "crypto/sha256"
    "encoding/hex"
    "io"
    "os"
)

// Hasher computes SHA-256 hashes for chunks and whole files.
type Hasher struct{}

func NewHasher() *Hasher { return &Hasher{} }

// HashBytes computes SHA-256 of a byte slice. Returns hex string.
func (h *Hasher) HashBytes(data []byte) string { ... }

// HashFile computes SHA-256 of an entire file by streaming. Returns hex string.
func (h *Hasher) HashFile(path string) (string, error) { ... }

// HashReader computes SHA-256 from an io.Reader.
func (h *Hasher) HashReader(r io.Reader) (string, error) { ... }

// Verify checks that data matches the expected hex hash.
func (h *Hasher) Verify(data []byte, expectedHex string) bool { ... }
```

### 2.11 `internal/engine/progress.go`

```go
package engine

import (
    "sync"
    "time"

    "github.com/stefanposs/file-flux/agent/internal/models"
)

// ProgressTracker tracks bytes transferred and computes speed/ETA.
type ProgressTracker struct {
    mu            sync.Mutex
    transferID    string
    totalBytes    int64
    sentBytes     int64
    totalChunks   int
    sentChunks    int
    startTime     time.Time
    lastReportAt  time.Time
    reportInterval time.Duration // minimum interval between progress reports
}

// NewProgressTracker creates a tracker for a transfer.
func NewProgressTracker(transferID string, totalBytes int64, totalChunks int) *ProgressTracker { ... }

// RecordChunk records that a chunk of the given size was transferred.
func (p *ProgressTracker) RecordChunk(chunkIndex int, bytes int64) { ... }

// ShouldReport returns true if enough time has passed since last report.
func (p *ProgressTracker) ShouldReport() bool { ... }

// Snapshot returns the current progress as a ProgressMessage.
func (p *ProgressTracker) Snapshot() models.ProgressMessage { ... }
```

### 2.12 `internal/engine/state.go`

```go
package engine

import (
    "encoding/json"
    "os"
    "path/filepath"

    "github.com/stefanposs/file-flux/agent/internal/models"
)

// StateStore persists transfer state to disk for resume capability.
// State files live in the temp directory as <transfer_id>.state.json.
type StateStore struct {
    dir string
}

// NewStateStore creates a StateStore backed by the given directory.
func NewStateStore(dir string) *StateStore { ... }

// Save persists the transfer state to disk.
func (s *StateStore) Save(t *models.Transfer) error { ... }

// Load reads a transfer state from disk. Returns nil, nil if not found.
func (s *StateStore) Load(transferID string) (*models.Transfer, error) { ... }

// Delete removes the state file for a completed/cancelled transfer.
func (s *StateStore) Delete(transferID string) error { ... }

// ListPending returns all persisted transfer states (for resume after restart).
func (s *StateStore) ListPending() ([]*models.Transfer, error) { ... }
```

### 2.13 `internal/watcher/watcher.go`

```go
package watcher

import (
    "context"
    "log/slog"
    "path/filepath"

    "github.com/fsnotify/fsnotify"
    "github.com/stefanposs/file-flux/agent/internal/config"
)

// FileEvent represents a new/modified file detected by the watcher.
type FileEvent struct {
    Path    string
    Size    int64
    WatchDir config.WatchDirConfig
}

// Watcher monitors configured directories for new files.
type Watcher struct {
    dirs     []config.WatchDirConfig
    events   chan FileEvent
    logger   *slog.Logger
    watcher  *fsnotify.Watcher
}

// New creates a Watcher for the given directories.
func New(dirs []config.WatchDirConfig, logger *slog.Logger) (*Watcher, error) { ... }

// Events returns the channel of file events. Consumers read from this.
func (w *Watcher) Events() <-chan FileEvent { ... }

// Start begins watching. Blocks until ctx is cancelled.
func (w *Watcher) Start(ctx context.Context) error { ... }

// Stop stops the watcher and closes the events channel.
func (w *Watcher) Stop() error { ... }
```

### 2.14 `internal/watcher/glob.go`

```go
package watcher

// MatchGlob checks if a filename matches a glob pattern.
// Supports *, ?, [abc], {csv,json}.
func MatchGlob(pattern, name string) bool { ... }
```

### 2.15 `internal/ws/client.go`

```go
package ws

import (
    "context"
    "log/slog"
    "sync"
    "time"

    "github.com/gorilla/websocket"
    "github.com/stefanposs/file-flux/agent/internal/config"
    "github.com/stefanposs/file-flux/agent/internal/models"
)

// Client manages the WebSocket connection to the backend.
type Client struct {
    cfg      config.ConnectionConfig
    conn     *websocket.Conn
    logger   *slog.Logger
    handler  *Handler
    sender   *Sender

    mu       sync.Mutex
    done     chan struct{}
    connected bool
}

// New creates a new WebSocket Client.
func New(cfg config.ConnectionConfig, handler *Handler, logger *slog.Logger) *Client { ... }

// Connect establishes the WebSocket connection. Blocks until ctx is cancelled.
// Handles reconnection with exponential backoff.
func (c *Client) Connect(ctx context.Context) error { ... }

// Disconnect gracefully closes the WebSocket connection.
func (c *Client) Disconnect() error { ... }

// Sender returns the outbound message sender.
func (c *Client) Sender() *Sender { ... }

// IsConnected returns true if the WebSocket is connected.
func (c *Client) IsConnected() bool { ... }

// readLoop reads messages from the WebSocket and dispatches to the Handler.
func (c *Client) readLoop(ctx context.Context) { ... }

// heartbeatLoop sends periodic heartbeats.
func (c *Client) heartbeatLoop(ctx context.Context) { ... }

// reconnect attempts to reconnect with backoff.
func (c *Client) reconnect(ctx context.Context) error { ... }
```

### 2.16 `internal/ws/handler.go`

```go
package ws

import (
    "context"
    "encoding/json"
    "log/slog"

    "github.com/stefanposs/file-flux/agent/internal/engine"
    "github.com/stefanposs/file-flux/agent/internal/models"
    "github.com/stefanposs/file-flux/agent/internal/system"
)

// Handler routes inbound WebSocket messages to the appropriate handler function.
type Handler struct {
    engine  *engine.Engine
    sysInfo *system.SystemInfo
    logger  *slog.Logger
}

// NewHandler creates a message Handler.
func NewHandler(engine *engine.Engine, sysInfo *system.SystemInfo, logger *slog.Logger) *Handler { ... }

// HandleMessage parses the envelope and dispatches to the correct handler.
func (h *Handler) HandleMessage(ctx context.Context, msgType int, data []byte) error { ... }

// --- Individual message handlers ---

func (h *Handler) handleTransferStart(ctx context.Context, data json.RawMessage) error { ... }

// handleTransferChunk handles binary chunk frames.
// Binary frame format: [2-byte header len (big-endian)][JSON ChunkHeader][raw chunk bytes]
func (h *Handler) handleTransferChunk(ctx context.Context, data []byte) error { ... }

func (h *Handler) handleTransferCancel(ctx context.Context, data json.RawMessage) error { ... }

func (h *Handler) handleTransferStatus(ctx context.Context, data json.RawMessage) error { ... }

func (h *Handler) handleJobExecute(ctx context.Context, data json.RawMessage) error { ... }

func (h *Handler) handleConfigUpdate(ctx context.Context, data json.RawMessage) error { ... }

func (h *Handler) handlePing(ctx context.Context) error { ... }
```

### 2.17 `internal/ws/sender.go`

```go
package ws

import (
    "context"
    "encoding/binary"
    "encoding/json"
    "sync"

    "github.com/gorilla/websocket"
    "github.com/stefanposs/file-flux/agent/internal/models"
)

// Sender sends outbound messages over the WebSocket.
// It is goroutine-safe — all writes are serialized via a mutex.
type Sender struct {
    conn *websocket.Conn
    mu   sync.Mutex
}

// NewSender wraps a WebSocket connection for outbound messages.
func NewSender(conn *websocket.Conn) *Sender { ... }

// SendJSON sends a JSON text message wrapped in an Envelope.
func (s *Sender) SendJSON(ctx context.Context, msgType models.MessageType, data any) error { ... }

// SendChunk sends a binary WebSocket frame with the chunk header + data.
// Frame format: [2-byte header len (big-endian)][JSON ChunkHeader][chunk bytes]
func (s *Sender) SendChunk(ctx context.Context, header models.ChunkHeader, data []byte) error { ... }

// SendProgress sends a transfer progress update.
func (s *Sender) SendProgress(ctx context.Context, msg models.ProgressMessage) error { ... }

// SendComplete sends a transfer completion message.
func (s *Sender) SendComplete(ctx context.Context, msg models.CompleteMessage) error { ... }

// SendFailed sends a transfer failure message.
func (s *Sender) SendFailed(ctx context.Context, msg models.FailedMessage) error { ... }

// SendHeartbeat sends a heartbeat message.
func (s *Sender) SendHeartbeat(ctx context.Context, msg models.HeartbeatMessage) error { ... }

// SendAgentInfo sends agent system information.
func (s *Sender) SendAgentInfo(ctx context.Context, info *system.SystemInfo) error { ... }
```

### 2.18 `internal/service/service.go`

```go
package service

// Service manages the agent as a system service.
type Service interface {
    // Install registers the agent as a system service.
    Install(binaryPath, configPath string) error

    // Uninstall removes the system service registration.
    Uninstall() error

    // Status returns the current service status.
    Status() (ServiceStatus, error)

    // Start starts the service.
    Start() error

    // Stop stops the service.
    Stop() error
}

// ServiceStatus describes the current state of the service.
type ServiceStatus struct {
    Installed bool   `json:"installed"`
    Running   bool   `json:"running"`
    PID       int    `json:"pid,omitempty"`
    Uptime    string `json:"uptime,omitempty"`
}

// New returns the platform-appropriate Service implementation.
func New() Service { ... } // dispatches based on build tags
```

---

## 3. WebSocket Protocol Implementation

### 3.1 Wire Format

**Text frames (JSON)** — control messages:
```json
{"type": "transfer.start", "data": {"transfer": {...}}}
{"type": "transfer.progress", "data": {"transfer_id": "...", "progress": 0.75, ...}}
{"type": "agent.heartbeat", "data": {"timestamp": "...", "active_transfers": 2}}
```

**Binary frames** — chunk data (33% bandwidth savings vs base64):
```
┌──────────────────┬─────────────────────────┬──────────────────┐
│ Header Len (2B)  │ JSON ChunkHeader (var)  │ Chunk Data (var) │
│ big-endian u16   │ {"transfer_id":"...",    │ compressed bytes │
│                  │  "index":5,"hash":"..."}│                  │
└──────────────────┴─────────────────────────┴──────────────────┘
```

### 3.2 Binary Frame Encoding/Decoding

```go
// Encode binary frame
func EncodeBinaryFrame(header models.ChunkHeader, data []byte) ([]byte, error) {
    headerJSON, err := json.Marshal(header)
    if err != nil {
        return nil, err
    }
    frame := make([]byte, 2+len(headerJSON)+len(data))
    binary.BigEndian.PutUint16(frame[0:2], uint16(len(headerJSON)))
    copy(frame[2:2+len(headerJSON)], headerJSON)
    copy(frame[2+len(headerJSON):], data)
    return frame, nil
}

// Decode binary frame
func DecodeBinaryFrame(frame []byte) (models.ChunkHeader, []byte, error) {
    if len(frame) < 2 {
        return models.ChunkHeader{}, nil, errors.New("frame too short")
    }
    headerLen := binary.BigEndian.Uint16(frame[0:2])
    if int(2+headerLen) > len(frame) {
        return models.ChunkHeader{}, nil, errors.New("invalid header length")
    }
    var header models.ChunkHeader
    if err := json.Unmarshal(frame[2:2+headerLen], &header); err != nil {
        return models.ChunkHeader{}, nil, fmt.Errorf("decoding header: %w", err)
    }
    data := frame[2+headerLen:]
    return header, data, nil
}
```

### 3.3 Connection Authentication

```
Client → Server: WebSocket upgrade with header "Authorization: Bearer <token>"
Server validates token → returns 101 Switching Protocols or 401 Unauthorized
Client sends: agent.info message with system details
Server stores agent info, marks agent online
```

### 3.4 Reconnection Strategy

```go
// Exponential backoff: base * 2^attempt, capped at 60s, with jitter
func backoff(attempt int, base time.Duration) time.Duration {
    d := base * time.Duration(1<<min(attempt, 6))
    if d > 60*time.Second {
        d = 60 * time.Second
    }
    // Add 0–25% jitter
    jitter := time.Duration(rand.Int63n(int64(d) / 4))
    return d + jitter
}
```

### 3.5 Backward Compatibility with Backend

The existing backend uses these message types (from `protocol.go`):
- `heartbeat`, `agent_info`, `transfer_progress`, `transfer_complete`, `transfer_error`
- `transfer_request`, `cancel_transfer`, `connection_test`

**Strategy:** The agent will support **both** the legacy underscore format AND the new dot-delimited format. The handler checks both:

```go
switch msg.Type {
case "transfer.start", "transfer_request":   // both formats
    return h.handleTransferStart(ctx, msg.Data)
case "transfer.cancel", "cancel_transfer":
    return h.handleTransferCancel(ctx, msg.Data)
// ...
}
```

---

## 4. Transfer Flow Diagrams

### 4.1 Push Transfer (Source Agent Uploads)

```
Source Agent                    Backend                    Dest Agent
    │                             │                           │
    │ ◄── transfer.start ─────── │                           │
    │     {direction:"upload",   │                           │
    │      source_path:"/data/x"}│                           │
    │                             │                           │
    │── [open file, compute      │                           │
    │    chunk count, file hash] │                           │
    │                             │                           │
    │── transfer.progress ──────► │                           │
    │   {state:"hashing"}        │                           │
    │                             │                           │
    │  ┌─ for each chunk (parallel N=4):                     │
    │  │  read chunk                                         │
    │  │  compute SHA-256                                    │
    │  │  compress (zstd)                                    │
    │  │  ── binary frame ──────► │ ── binary frame ────────►│
    │  │     [header|data]        │    [header|data]          │
    │  │                          │                           │
    │  │  ── transfer.progress ─► │                           │
    │  │     {chunk:5/20, 25%}    │                           │
    │  └─                         │                           │
    │                             │                   [decompress]
    │                             │                   [verify hash]
    │                             │                   [write to .tmp]
    │                             │                           │
    │                             │ ◄── transfer.complete ───│
    │                             │     {file_hash:"abc..."}  │
    │── transfer.complete ──────► │                           │
    │   {file_hash:"abc...",      │                           │
    │    duration_ms: 12345}      │                           │
    │                             │                           │
    │── [post-action: move/       │                           │
    │    delete source file]      │                           │
```

### 4.2 Pull Transfer (Destination Agent Downloads)

```
Dest Agent                     Backend                    Source Agent
    │                             │                           │
    │ ◄── transfer.start ─────── │ ── transfer.start ──────►│
    │     {direction:"download"} │    {direction:"upload"}   │
    │                             │                           │
    │── [prepare assembler,       │                           │
    │    create .tmp file]        │  ◄── binary frame ───────│
    │                             │      [header|data]        │
    │ ◄── binary frame ────────── │                           │
    │     [header|data]           │                           │
    │                             │                           │
    │── [decompress chunk]        │                           │
    │── [verify chunk hash]       │                           │
    │── [write at offset]         │                           │
    │── [if hash mismatch:        │                           │
    │    request re-send]         │                           │
    │                             │                           │
    │── (all chunks received)     │                           │
    │── [verify whole-file hash]  │                           │
    │── [rename .tmp → final]     │                           │
    │                             │                           │
    │── transfer.complete ──────► │                           │
    │   {file_hash:"abc..."}      │                           │
```

### 4.3 File Watcher Push (Auto-Detect)

```
FileSystem                Source Agent                 Backend
    │                         │                           │
    │── CREATE event ────────►│                           │
    │   /data/out/report.csv  │                           │
    │                         │                           │
    │                         │── [wait for file stable]  │
    │                         │   (no writes for 2s)      │
    │                         │                           │
    │                         │── agent.file_ready ──────►│
    │                         │   {path, size, hash}      │
    │                         │                           │
    │                         │ ◄── transfer.start ──────│
    │                         │                           │
    │                         │── [begin upload flow      │
    │                         │    as in 4.1]             │
```

### 4.4 Resume After Disconnect

```
Agent (after restart)          Backend
    │                             │
    │── [load .state.json files   │
    │    from temp directory]     │
    │                             │
    │── [connect via WebSocket]   │
    │                             │
    │── agent.info ──────────────►│
    │── agent.resume ────────────►│
    │   {transfer_id:"...",       │
    │    completed_chunks:[0,1,2]}│
    │                             │
    │ ◄── transfer.start ────────│
    │     {resume: true,          │
    │      skip_chunks:[0,1,2]}   │
    │                             │
    │── [send only missing chunks]│
```

---

## 5. Service Installation

### 5.1 Linux — systemd

**File:** `internal/service/service_linux.go` (build tag: `//go:build linux`)

```go
// Install writes a systemd unit file and enables the service.
func (s *linuxService) Install(binaryPath, configPath string) error {
    unit := fmt.Sprintf(`[Unit]
Description=FileFlux Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=%s start --config %s
Restart=always
RestartSec=10
User=fileflux
Group=fileflux
LimitNOFILE=65536
Environment=GOGC=100
StandardOutput=journal
StandardError=journal
SyslogIdentifier=fileflux-agent

[Install]
WantedBy=multi-user.target
`, binaryPath, configPath)
    // Write to /etc/systemd/system/fileflux-agent.service
    // Run: systemctl daemon-reload && systemctl enable fileflux-agent
}
```

### 5.2 macOS — launchd

**File:** `internal/service/service_darwin.go` (build tag: `//go:build darwin`)

```go
// Install writes a launchd plist and loads it.
func (s *darwinService) Install(binaryPath, configPath string) error {
    plist := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
    "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.fileflux.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>%s</string>
        <string>start</string>
        <string>--config</string>
        <string>%s</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/usr/local/var/log/fileflux-agent.log</string>
    <key>StandardErrorPath</key>
    <string>/usr/local/var/log/fileflux-agent.err</string>
</dict>
</plist>
`, binaryPath, configPath)
    // Write to ~/Library/LaunchAgents/com.fileflux.agent.plist (user)
    //   or /Library/LaunchDaemons/com.fileflux.agent.plist (system, requires root)
    // Run: launchctl load <plist>
}
```

### 5.3 Windows — Windows Service

**File:** `internal/service/service_windows.go` (build tag: `//go:build windows`)

Uses `golang.org/x/sys/windows/svc` and `golang.org/x/sys/windows/svc/mgr`:

```go
// Install registers a Windows Service via the Service Control Manager.
func (s *windowsService) Install(binaryPath, configPath string) error {
    m, err := mgr.Connect()
    // ...
    svc, err := m.CreateService("FileFluxAgent",
        binaryPath,
        mgr.Config{
            DisplayName: "FileFlux Agent",
            Description: "FileFlux Managed File Transfer Agent",
            StartType:   mgr.StartAutomatic,
        },
        "start", "--config", configPath,
    )
    // ...
}

// The agent's main function detects if running as a Windows Service:
func main() {
    isService, _ := svc.IsWindowsService()
    if isService {
        runWindowsService()
    } else {
        runCLI()
    }
}
```

---

## 6. CLI Command Implementation

Using `github.com/spf13/cobra`:

### 6.1 `internal/cli/root.go`

```go
package cli

import (
    "github.com/spf13/cobra"
)

var (
    cfgFile string
)

func NewRootCmd() *cobra.Command {
    root := &cobra.Command{
        Use:   "fileflux-agent",
        Short: "FileFlux Agent — Managed File Transfer client",
    }

    root.PersistentFlags().StringVarP(&cfgFile, "config", "c", "/etc/fileflux-agent/config.yaml", "config file path")

    root.AddCommand(
        newStartCmd(),
        newInstallCmd(),
        newUninstallCmd(),
        newStatusCmd(),
        newTestConnectionCmd(),
        newVersionCmd(),
        newConfigCmd(),
    )

    return root
}

// Execute runs the root command.
func Execute() error {
    return NewRootCmd().Execute()
}
```

### 6.2 Command Mapping

| Command | Function | File |
|---------|----------|------|
| `fileflux-agent start` | `newStartCmd()` | `internal/cli/start.go` |
| `fileflux-agent install` | `newInstallCmd()` | `internal/cli/install.go` |
| `fileflux-agent uninstall` | `newUninstallCmd()` | `internal/cli/install.go` |
| `fileflux-agent status` | `newStatusCmd()` | `internal/cli/status.go` |
| `fileflux-agent test-connection` | `newTestConnectionCmd()` | `internal/cli/test_connection.go` |
| `fileflux-agent version` | `newVersionCmd()` | `internal/cli/version.go` |
| `fileflux-agent config validate` | subcommand | `internal/cli/config_cmd.go` |
| `fileflux-agent config init` | subcommand | `internal/cli/config_cmd.go` |

### 6.3 `start` Command — Wiring Everything Together

```go
func newStartCmd() *cobra.Command {
    return &cobra.Command{
        Use:   "start",
        Short: "Start the agent in foreground mode",
        RunE: func(cmd *cobra.Command, args []string) error {
            ctx, cancel := signal.NotifyContext(cmd.Context(), syscall.SIGINT, syscall.SIGTERM)
            defer cancel()

            // 1. Load & validate config
            cfg, err := config.Load(cfgFile)

            // 2. Set up structured logger (slog)
            logger := setupLogger(cfg.Logging)

            // 3. Collect system info
            sysInfo := system.CollectSystemInfo()

            // 4. Create WebSocket handler + engine (chicken-and-egg solved by setter)
            handler := ws.NewHandler(nil, sysInfo, logger)
            wsClient := ws.New(cfg.Connection, handler, logger)

            eng, err := engine.New(cfg.Transfers, wsClient.Sender(), logger)
            handler.SetEngine(eng) // resolve circular dep

            // 5. Start file watcher (if configured)
            if len(cfg.WatchDirectories) > 0 {
                w, _ := watcher.New(cfg.WatchDirectories, logger)
                go w.Start(ctx)
                go consumeWatchEvents(ctx, w.Events(), eng, wsClient.Sender())
            }

            // 6. Resume any interrupted transfers
            eng.ResumeAll(ctx)

            // 7. Connect WebSocket (blocks until ctx cancelled, auto-reconnects)
            return wsClient.Connect(ctx)
        },
    }
}
```

### 6.4 `cmd/agent/main.go` — New Entry Point

```go
package main

import (
    "fmt"
    "os"
    "runtime"

    "golang.org/x/sys/windows/svc"

    "github.com/stefanposs/file-flux/agent/internal/cli"
)

func main() {
    // On Windows, detect if running as a service
    if runtime.GOOS == "windows" {
        isService, _ := svc.IsWindowsService()
        if isService {
            runAsWindowsService()
            return
        }
    }

    if err := cli.Execute(); err != nil {
        fmt.Fprintln(os.Stderr, err)
        os.Exit(1)
    }
}
```

Note: The Windows service detection import will use a build tag to avoid importing `windows/svc` on non-Windows:

```go
// main_windows.go (//go:build windows)
// main_other.go   (//go:build !windows) — just calls cli.Execute()
```

---

## 7. Build Matrix

### 7.1 Targets

| GOOS | GOARCH | Binary Name | Notes |
|------|--------|-------------|-------|
| `linux` | `amd64` | `fileflux-agent-linux-amd64` | Primary server target |
| `linux` | `arm64` | `fileflux-agent-linux-arm64` | Raspberry Pi, ARM servers |
| `darwin` | `amd64` | `fileflux-agent-darwin-amd64` | Intel Macs |
| `darwin` | `arm64` | `fileflux-agent-darwin-arm64` | Apple Silicon |
| `windows` | `amd64` | `fileflux-agent-windows-amd64.exe` | Primary Windows target |

### 7.2 Updated Makefile

```makefile
.PHONY: all build test lint clean release

VERSION    ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
COMMIT     ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_DATE ?= $(shell date -u +%Y-%m-%dT%H:%M:%SZ)
MODULE     := github.com/stefanposs/file-flux/agent
LDFLAGS    := -s -w \
    -X '$(MODULE)/internal/buildinfo.Version=$(VERSION)' \
    -X '$(MODULE)/internal/buildinfo.Commit=$(COMMIT)' \
    -X '$(MODULE)/internal/buildinfo.BuildDate=$(BUILD_DATE)'

PLATFORMS := linux/amd64 linux/arm64 darwin/amd64 darwin/arm64 windows/amd64
BINARY    := fileflux-agent

all: test build

build:
	CGO_ENABLED=0 go build -ldflags "$(LDFLAGS)" -o bin/$(BINARY) ./cmd/agent

test:
	go test -race -cover -count=1 ./...

lint:
	golangci-lint run ./...

clean:
	rm -rf bin/ dist/

release: clean
	@for platform in $(PLATFORMS); do \
		GOOS=$$(echo $$platform | cut -d/ -f1); \
		GOARCH=$$(echo $$platform | cut -d/ -f2); \
		output="dist/$(BINARY)-$${GOOS}-$${GOARCH}"; \
		if [ "$$GOOS" = "windows" ]; then output="$${output}.exe"; fi; \
		echo "Building $$output..."; \
		CGO_ENABLED=0 GOOS=$$GOOS GOARCH=$$GOARCH \
			go build -ldflags "$(LDFLAGS)" -o $$output ./cmd/agent; \
	done

checksums:
	cd dist && sha256sum * > checksums.txt

docker:
	docker build -t fileflux-agent:$(VERSION) .

.PHONY: fmt vet
fmt:
	gofumpt -w .
	goimports -w .

vet:
	go vet ./...
```

### 7.3 Updated Dockerfile

```dockerfile
FROM golang:1.22-alpine AS builder
RUN apk add --no-cache ca-certificates git
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
ARG VERSION=dev
ARG COMMIT=unknown
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags "-s -w \
        -X 'github.com/stefanposs/file-flux/agent/internal/buildinfo.Version=${VERSION}' \
        -X 'github.com/stefanposs/file-flux/agent/internal/buildinfo.Commit=${COMMIT}' \
        -X 'github.com/stefanposs/file-flux/agent/internal/buildinfo.BuildDate=$(date -u +%Y-%m-%dT%H:%M:%SZ)'" \
    -o /bin/fileflux-agent ./cmd/agent

FROM scratch
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /bin/fileflux-agent /bin/fileflux-agent
ENTRYPOINT ["/bin/fileflux-agent"]
CMD ["start", "--config", "/etc/fileflux-agent/config.yaml"]
```

---

## 8. Dependencies

### 8.1 Go Module Dependencies

```
# Updated go.mod
module github.com/stefanposs/file-flux/agent

go 1.22

require (
    // CLI framework
    github.com/spf13/cobra             v1.8.1

    // WebSocket client
    github.com/gorilla/websocket        v1.5.3

    // Filesystem watcher
    github.com/fsnotify/fsnotify        v1.7.0

    // Compression
    github.com/klauspost/compress       v1.17.9   // zstd encoder/decoder
    github.com/pierrec/lz4/v4           v4.1.21   // LZ4 encoder/decoder

    // YAML config
    gopkg.in/yaml.v3                    v3.0.1

    // Windows service (conditional)
    golang.org/x/sys                    v0.25.0   // windows/svc

    // Logging (rotating file)
    gopkg.in/natefinish/lumberjack.v2   v2.2.1    // log file rotation (used by slog file handler)
)
```

### 8.2 Dependency Justification

| Dependency | Purpose | Why Not stdlib? |
|-----------|---------|----------------|
| `cobra` | CLI framework with subcommands | `flag` lacks subcommands, help gen |
| `gorilla/websocket` | WebSocket client with binary frames | `net/http` has no WS client; `nhooyr/websocket` is also viable but gorilla matches the backend |
| `fsnotify` | Cross-platform inotify/kqueue/ReadDirectoryChanges | No stdlib equivalent |
| `klauspost/compress` | zstd compression | Not in stdlib; fastest pure-Go zstd |
| `pierrec/lz4` | LZ4 compression | Not in stdlib |
| `yaml.v3` | YAML config parsing | No stdlib YAML parser |
| `golang.org/x/sys` | Windows Service API | Windows-only, build-tagged |
| `lumberjack` | Log file rotation | `slog` has no built-in rotation |

### 8.3 Stdlib Usage (no extra deps needed)

| Feature | stdlib Package |
|---------|---------------|
| SHA-256 hashing | `crypto/sha256` |
| Structured logging | `log/slog` (Go 1.21+) |
| Context propagation | `context` |
| Concurrency | `sync`, `sync/atomic` |
| Signal handling | `os/signal` |
| File I/O | `os`, `io`, `path/filepath` |
| JSON wire format | `encoding/json`, `encoding/binary` |
| Glob matching | `path/filepath.Match` |
| HTTP (test-connection) | `net/http` |

---

## 9. Phased Implementation

### Phase 1 — Foundation (Week 1–2) 🔴 Critical Path

**Goal:** Agent can connect, receive a transfer command, upload a single file in chunks, report progress and completion.

| # | Task | Files | Est. |
|---|------|-------|------|
| 1.1 | Update `go.mod` with new deps, `go mod tidy` | `go.mod` | 0.5h |
| 1.2 | Implement `internal/buildinfo/version.go` | 1 file | 0.5h |
| 1.3 | Rewrite `internal/config/config.go` with expanded config + `validate.go` | 2 files | 2h |
| 1.4 | Implement `internal/models/` (chunk, transfer, messages, errors) | 4 files | 2h |
| 1.5 | Implement `internal/engine/hasher.go` + tests | 2 files | 1h |
| 1.6 | Implement `internal/engine/compressor.go` (zstd, lz4, none) + tests | 2 files | 2h |
| 1.7 | Implement `internal/engine/chunker.go` (Chunker + Assembler) + tests | 2 files | 3h |
| 1.8 | Implement `internal/engine/progress.go` + tests | 2 files | 1h |
| 1.9 | Implement `internal/engine/state.go` (state persistence) + tests | 2 files | 1.5h |
| 1.10 | Implement `internal/engine/engine.go` (StartUpload, ReceiveChunk) + tests | 2 files | 4h |
| 1.11 | Implement `internal/ws/sender.go` (JSON + binary frames) | 1 file | 2h |
| 1.12 | Implement `internal/ws/handler.go` (message routing) + tests | 2 files | 2h |
| 1.13 | Implement `internal/ws/client.go` (connect, reconnect, read/write loops) + tests | 2 files | 3h |
| 1.14 | Implement `internal/cli/root.go` + `start.go` + `version.go` | 3 files | 2h |
| 1.15 | Rewrite `cmd/agent/main.go` for cobra | 1 file | 0.5h |
| 1.16 | Update `Makefile` with new build targets | 1 file | 0.5h |
| 1.17 | Integration test: agent connects, uploads a test file via WebSocket | 1 file | 2h |

**Phase 1 Deliverable:** `fileflux-agent start` connects to backend, receives `transfer.start`, reads file, chunks it, compresses, hashes, sends binary frames, reports progress + completion.

### Phase 2 — Pull Mode + Resume (Week 3)

| # | Task | Files | Est. |
|---|------|-------|------|
| 2.1 | Implement `ReceiveChunk` in engine (decompress, verify, write to assembler) | engine.go | 2h |
| 2.2 | Implement Assembler out-of-order write + finalize | chunker.go | 2h |
| 2.3 | Implement resume logic: load state on start, skip completed chunks | engine.go, state.go | 2h |
| 2.4 | Handle `transfer.cancel` message | handler.go | 1h |
| 2.5 | Handle `transfer.status` request | handler.go | 0.5h |
| 2.6 | Add chunk retry with backoff on hash mismatch or send failure | engine.go | 2h |
| 2.7 | Whole-file hash verification after assembly | engine.go | 1h |
| 2.8 | Tests for pull flow end-to-end | engine_test.go | 2h |

**Phase 2 Deliverable:** Agent can both push AND pull files. Transfers survive agent restarts. Failed chunks are retried.

### Phase 3 — File Watcher + Post-Actions (Week 4)

| # | Task | Files | Est. |
|---|------|-------|------|
| 3.1 | Implement `internal/watcher/watcher.go` with fsnotify | 1 file | 2h |
| 3.2 | Implement `internal/watcher/glob.go` pattern matching | 1 file | 1h |
| 3.3 | File stability detection (wait for no writes before triggering) | watcher.go | 1h |
| 3.4 | Wire watcher into `start` command, trigger uploads on new files | start.go | 1h |
| 3.5 | Post-transfer actions: delete, move, archive | engine.go | 1.5h |
| 3.6 | Recursive directory watching | watcher.go | 1h |
| 3.7 | Tests for watcher + glob | 2 files | 1.5h |

**Phase 3 Deliverable:** Agent auto-detects new files in watched directories, uploads them, and moves/deletes/archives originals.

### Phase 4 — CLI + Service Installation (Week 5)

| # | Task | Files | Est. |
|---|------|-------|------|
| 4.1 | `fileflux-agent install` command | cli/install.go | 1h |
| 4.2 | `fileflux-agent uninstall` command | cli/install.go | 0.5h |
| 4.3 | `fileflux-agent status` command | cli/status.go | 1h |
| 4.4 | `fileflux-agent test-connection` command | cli/test_connection.go | 1h |
| 4.5 | `fileflux-agent config validate` command | cli/config_cmd.go | 0.5h |
| 4.6 | `fileflux-agent config init` command | cli/config_cmd.go | 0.5h |
| 4.7 | Linux systemd service (`service_linux.go`) | 1 file | 1.5h |
| 4.8 | macOS launchd service (`service_darwin.go`) | 1 file | 1.5h |
| 4.9 | Windows Service (`service_windows.go`) + `main_windows.go` | 2 files | 3h |
| 4.10 | Update `install.sh` to use `fileflux-agent install` | install.sh | 1h |
| 4.11 | Update `install.ps1` to use `fileflux-agent install` | install.ps1 | 1h |

**Phase 4 Deliverable:** Agent installs as a native OS service on Linux/macOS/Windows. Full CLI with all subcommands.

### Phase 5 — Observability + Hardening (Week 6)

| # | Task | Files | Est. |
|---|------|-------|------|
| 5.1 | Structured logging with slog + lumberjack rotation | cli/start.go, config | 1.5h |
| 5.2 | Enhanced heartbeat with CPU/mem/disk metrics | system/sysinfo.go | 1.5h |
| 5.3 | Graceful shutdown: drain active transfers, flush state | engine.go, start.go | 1.5h |
| 5.4 | File locking during transfer (advisory locks) | engine.go | 1h |
| 5.5 | Config hot-reload via `config.update` message | handler.go, config.go | 1.5h |
| 5.6 | `job.execute` handler (on-demand job execution) | handler.go | 1h |
| 5.7 | Cross-compilation CI (`release` target) + checksums | Makefile | 1h |
| 5.8 | Updated Dockerfile (multi-stage, scratch base) | Dockerfile | 0.5h |
| 5.9 | `.golangci.yml` linter configuration | 1 file | 0.5h |
| 5.10 | Comprehensive integration tests | `*_test.go` | 3h |

**Phase 5 Deliverable:** Production-ready agent with observability, graceful shutdown, file locking, and CI pipeline.

---

### Implementation Priority Summary

```
Priority 1 (MUST):  Phase 1 + Phase 2  — Core transfer engine (push + pull + resume)
Priority 2 (MUST):  Phase 4            — CLI + service install (user-facing installation)
Priority 3 (SHOULD): Phase 3           — File watcher (push mode auto-detection)
Priority 4 (SHOULD): Phase 5           — Observability + hardening
```

### File Count Summary

| Category | New Files | Modified Files |
|----------|-----------|----------------|
| `internal/buildinfo/` | 1 | — |
| `internal/cli/` | 7 | — |
| `internal/config/` | 1 | 1 (rewrite config.go) |
| `internal/engine/` | 12 (incl. tests) | — |
| `internal/models/` | 3 | 1 (rewrite file_transfer.go) |
| `internal/service/` | 4 | — |
| `internal/system/` | 1 (test) | 1 (enhance sysinfo.go) |
| `internal/watcher/` | 4 (incl. tests) | — |
| `internal/ws/` | 5 (incl. tests) | — |
| `cmd/agent/` | 2 (main_windows.go, main_other.go) | 1 (rewrite main.go) |
| Root | 1 (.golangci.yml) | 3 (Makefile, Dockerfile, go.mod) |
| **Total** | **~41** | **~7** |
