# Phase 2: Transfer Engine — Detailed Implementation Plan

**Date:** February 13, 2026  
**Phase Duration:** Week 5–8 (4 weeks)  
**Depends on:** Phase 0 (Foundation) + Phase 1 (Security & Core Services)

---

## 1. Current State Analysis

### 1.1 Transfer Domain Model (As-Is)

**File:** `backend/domain/transfer/entity.go`

```go
type Status string  // "pending" | "running" | "completed" | "failed"

type Transfer struct {
    ID                 int        // PK
    JobID              *int       // FK → jobs (optional)
    Filename           string
    Size               int64
    Status             Status
    Progress           float64    // 0.0–1.0
    SourcePath         string
    DestinationPath    string
    SourceAgentID      *int       // FK → agents (optional)
    DestinationAgentID *int       // FK → agents (optional)
    StartTime          time.Time
    EndTime            *time.Time
    Error              *string
    CreatedAt          time.Time
}

type Repository interface {
    ListByUser(ctx, userID int) ([]Transfer, error)
    GetByID(ctx, id int) (*Transfer, error)
    GetByIDForUser(ctx, id int, userID int) (*Transfer, error)
    Create(ctx, transfer *Transfer) error
    UpdateStatus(ctx, id int, status Status, errorMsg string) error
    UpdateProgress(ctx, id int, progress float64) error
}
```

**Gaps relative to Phase 2 requirements:**
- No `file_hash`, `compression`, `chunk_size`, `total_chunks`, `completed_chunks`, `bytes_transferred`, `retry_count`, `max_retries` fields
- No `transfer_chunks` table or chunk-level tracking
- No concept of transfer phases (upload phase → relay → download phase)
- No resume capability
- Progress is a simple float, not derived from chunk completion

### 1.2 Transfer Application Service (As-Is)

**File:** `backend/application/transfer/service.go`

Simple CRUD service with:
- `ListByUser()`, `GetByID()`, `GetByIDForUser()` — read operations
- `Create()` — creates a pending transfer (validation: filename + paths required)
- `Cancel()` — sets status to "failed" with "cancelled by user"
- `UpdateStatus()` — generic status update with validation

**Gaps:**
- No chunking/compression orchestration
- No transfer engine workflow (chunk → compress → hash → relay → reassemble)
- No integration with WebSocket binary frames
- No resume logic
- No chunk-level operations

### 1.3 HTTP Transfer Handler (As-Is)

**File:** `backend/adapter/http/transfer_handler.go`

REST endpoints:
- `GET /api/transfers` — list user's transfers
- `POST /api/transfers` — create transfer
- `GET /api/transfers/{id}` — get single transfer
- `POST /api/transfers/{id}/cancel` — cancel transfer

**Gaps:**
- No `POST /api/transfers/{id}/resume` endpoint
- No chunk detail endpoint (`GET /api/transfers/{id}/chunks`)
- No transfer with chunk metadata in response

### 1.4 File Handler (As-Is)

**File:** `backend/adapter/http/file_handler.go`

Current approach: **whole-file upload/download via HTTP**
- `PUT /api/files/{transferId}/upload` — agent uploads entire file as stream, saved to `storage/transfer-{id}/`
- `GET /api/files/{transferId}/download` — agent downloads entire file
- 5 GB max upload size
- No chunking — single HTTP request per file
- No compression at transport level
- No integrity verification (no hashing)

### 1.5 WebSocket Protocol (As-Is)

**File:** `backend/internal/websocket/protocol.go`

Message types (all JSON text frames):

| Direction | Type | Purpose |
|-----------|------|---------|
| Agent → Server | `heartbeat` | Keep-alive |
| Agent → Server | `agent_info` | System info on connect |
| Agent → Server | `transfer_progress` | Progress update (float) |
| Agent → Server | `transfer_complete` | Transfer finished |
| Agent → Server | `transfer_error` | Transfer failed |
| Server → Agent | `transfer_request` | Start upload/download |
| Server → Agent | `cancel_transfer` | Abort transfer |
| Server → Agent | `connection_test` | Connectivity check |

`TransferRequestMessage` payload:
```go
Transfer struct {
    ID               string
    JobID            string
    SourcePath       string
    DestinationPath  string
    Compressed       bool       // exists but unused
    ChunkSize        int        // exists but unused (hardcoded 8)
    TransferType     string     // "upload" or "download"
    DestinationAgent string     // unused
}
```

**Critical gap:** All communication uses JSON text frames. ADR-004 mandates binary WebSocket frames for chunk data (33% bandwidth savings vs base64 JSON).

### 1.6 WebSocket Manager (As-Is)

**File:** `backend/internal/websocket/manager.go` (479 lines)

- Manages `map[int]*Client` (agentID → WebSocket connection)
- Token-based auth on upgrade
- Read pump: processes JSON messages, dispatches to handlers
- Write pump: sends queued messages, 30s ping interval
- **Two-phase dispatch built-in:** when source agent reports `transfer_complete`, manager checks if there's a destination agent and dispatches a download request
- `SendToAgent(agentID, message)` — sends JSON to specific agent
- `ReadLimit: 4096 bytes` — **far too small for binary chunk data**
- `ReadBufferSize/WriteBufferSize: 1024` — needs significant increase for binary transfers

### 1.7 Hybrid Dispatcher (As-Is)

**File:** `backend/internal/dispatch/dispatcher.go` (347 lines)

Two components:
1. **HybridDispatcher** — routes messages to agents via WS-first, polling-fallback
   - `SendToAgent()`: tries WS, falls back to message queue
   - `IsConnected()`: checks both WS and polling status
   - Polling agent tracking with `MarkPollingActive()`/cleanup
2. **MessageRouter** — processes inbound agent messages
   - Handles heartbeat, agent_info, transfer_progress, transfer_complete, transfer_error
   - Has identical two-phase dispatch logic as WS manager (code duplication!)
   - `handleTransferComplete()` dispatches download to destination agent after upload completes

**Gaps:**
- MessageRouter duplicates WS manager logic — needs consolidation
- No binary frame routing
- No chunk acknowledge/retry logic

### 1.8 Agent Transfer Manager (As-Is)

**File:** `agent/internal/transfer/manager.go`

- Manages active transfers with cancel channels
- `StartTransfer(request)` — dispatches to `executeUpload()` or `executeDownload()`
- `executeUpload()`: opens local file, wraps in `progressReader`, sends whole file via `apiClient.UploadFile()`
- `executeDownload()`: downloads whole file via `apiClient.DownloadFile()`, saves locally
- `progressReader`: reports progress every 500ms
- Local copy fallback for testing (no server)
- `StopAll()` — graceful shutdown

**Gaps:**
- No chunking — sends entire file in single HTTP request
- No compression (zstd/LZ4)
- No SHA-256 integrity hashing
- No resume logic (no state files, no chunk tracking)
- No binary WebSocket transfer — uses HTTP PUT/GET for file data
- No file watcher (fsnotify)
- 8 MB buffer for local copy but no formal chunk size management

### 1.9 Agent Transport Layer (As-Is)

**File:** `agent/internal/transport/` (4 files, ~1100 lines)

| File | Purpose |
|------|---------|
| `transport.go` | Interface + message types (mirrors backend protocol.go) |
| `ws_transport.go` | WebSocket implementation with reconnect + backoff |
| `polling_transport.go` | HTTP long-polling fallback |
| `auto_transport.go` | Auto-detect: tries WS → falls back to polling → probes for WS upgrade |

All three transports implement `Transport` interface + `ProgressReporter` interface.

**Gaps:**
- Only sends/receives JSON text frames
- No binary frame capability
- No chunk-level progress reporting
- File data goes through separate HTTP channel (`api.Client`), not through WebSocket

### 1.10 Agent API Client (As-Is)

**File:** `agent/internal/api/client.go`

- `UploadFile(transferID, filename, body)` — `PUT /api/files/{id}/upload`
- `DownloadFile(transferID, dst)` — `GET /api/files/{id}/download`
- 30-minute HTTP timeout for large files
- No chunking, no compression, no hash verification

### 1.11 Available Dependencies

**Backend (`backend/go.mod`):**
```
github.com/golang-jwt/jwt/v5     — JWT auth
github.com/gorilla/mux            — HTTP router
github.com/gorilla/websocket      — WebSocket (supports binary frames)
github.com/lib/pq                 — PostgreSQL driver
golang.org/x/crypto               — bcrypt
gopkg.in/yaml.v2                  — config
github.com/robfig/cron/v3         — cron scheduler (indirect, for Phase 3)
```

**Agent (`agent/go.mod`):**
```
github.com/gorilla/websocket      — WebSocket
gopkg.in/yaml.v2                  — config
```

**Dependencies to add for Phase 2:**
```
github.com/klauspost/compress     — zstd + snappy (backend + agent)
github.com/pierrec/lz4/v4         — LZ4 compression (backend + agent)
github.com/fsnotify/fsnotify      — file watcher (agent only)
```

---

## 2. Target Architecture (Phase 2)

### 2.1 Transfer Flow (To-Be)

```
User creates job (source_agent → destination_agent)
  │
  ▼
Backend: Job triggers Transfer creation
  │
  ▼
Backend TransferEngine.StartTransfer():
  ├─ Creates Transfer record (status=pending, chunk_size, compression)
  ├─ Sends TransferRequest to source_agent via dispatcher
  │
  ▼
Source Agent: Receives transfer_request (type="upload"):
  ├─ Opens source file
  ├─ Splits into chunks (configurable chunk_size, default 8MB)
  ├─ For each chunk:
  │   ├─ Compress (zstd or LZ4)
  │   ├─ Compute SHA-256 hash
  │   ├─ Send via binary WebSocket frame:
  │   │   [4B magic][4B transfer_id][4B chunk_index][4B total_chunks]
  │   │   [32B sha256][4B compressed_size][compressed_data]
  │   └─ Wait for chunk_ack from server
  ├─ Send transfer_complete (whole-file SHA-256)
  │
  ▼
Backend WebSocket Manager: Receives binary frames:
  ├─ Parse binary header → extract transfer_id, chunk_index
  ├─ Verify chunk SHA-256
  ├─ Store chunk to temp storage (file-based, not DB blob)
  ├─ Update transfer_chunks table
  ├─ Update transfer progress (completed_chunks / total_chunks)
  ├─ Send chunk_ack to source agent
  ├─ On all chunks received:
  │   ├─ Verify whole-file SHA-256
  │   └─ Dispatch download to destination_agent
  │
  ▼
Destination Agent: Receives transfer_request (type="download"):
  ├─ For each chunk (requested from server):
  │   ├─ Receive binary WebSocket frame
  │   ├─ Verify chunk SHA-256
  │   ├─ Decompress
  │   ├─ Write to temp file
  │   └─ Send chunk_ack
  ├─ Reassemble chunks into final file
  ├─ Verify whole-file SHA-256
  ├─ Move to destination path
  ├─ Send transfer_complete
  │
  ▼
Backend: Transfer marked completed
```

### 2.2 Binary WebSocket Protocol

**ADR-004: Binary frames for chunk data, JSON text frames for control messages.**

#### Binary Frame Layout (Upload: Agent → Server)

```
Offset  Size     Field              Description
──────  ───────  ─────────────────  ──────────────────────────
0       4 bytes  Magic              0x46465846 ("FFXF" — FileFlux Transfer)
4       4 bytes  TransferID         uint32 big-endian
8       4 bytes  ChunkIndex         uint32 big-endian (0-based)
12      4 bytes  TotalChunks        uint32 big-endian
16      32 bytes ChunkSHA256        raw hash bytes
48      4 bytes  UncompressedSize   uint32 big-endian
52      4 bytes  CompressedSize     uint32 big-endian
56      1 byte   CompressionType    0=none, 1=zstd, 2=lz4
57      N bytes  CompressedData     chunk payload
```

Total header: **57 bytes** + compressed payload.

#### Binary Frame Layout (Download: Server → Agent)

Same layout — server forwards stored chunks to destination agent.

#### New JSON Control Messages

| Direction | Type | Purpose |
|-----------|------|---------|
| Server → Agent | `chunk_ack` | Acknowledge receipt of chunk (includes chunk_index) |
| Server → Agent | `chunk_nack` | Reject chunk (hash mismatch), request resend |
| Agent → Server | `chunk_request` | Request specific chunk for download |
| Agent → Server | `transfer_resume` | Resume interrupted transfer (with last known chunk) |

```go
// New message types
const (
    MessageTypeChunkAck       MessageType = "chunk_ack"
    MessageTypeChunkNack      MessageType = "chunk_nack"
    MessageTypeChunkRequest   MessageType = "chunk_request"
    MessageTypeTransferResume MessageType = "transfer_resume"
)
```

---

## 3. Implementation Tasks — Detailed Breakdown

### Task 2.1: File Chunker (Backend) — 2 days

**Package:** `backend/internal/engine/chunker/`

**Files to create:**

1. `backend/internal/engine/chunker/chunker.go`:

```go
package chunker

// ChunkSize constants
const (
    DefaultChunkSize = 8 * 1024 * 1024  // 8 MB
    MinChunkSize     = 256 * 1024        // 256 KB
    MaxChunkSize     = 64 * 1024 * 1024  // 64 MB
)

// Chunk represents a single chunk of a file
type Chunk struct {
    Index            uint32
    Data             []byte
    Size             int64   // uncompressed size
    SHA256           [32]byte
    IsLast           bool
}

// Chunker splits files into chunks and reassembles them
type Chunker struct {
    chunkSize int64
}

func New(chunkSize int64) *Chunker
func (c *Chunker) Split(reader io.Reader) (<-chan Chunk, <-chan error)
func (c *Chunker) TotalChunks(fileSize int64) uint32
func (c *Chunker) Reassemble(writer io.Writer, chunks <-chan Chunk) error
func (c *Chunker) ReassembleFromDir(writer io.Writer, chunkDir string, totalChunks int) error
```

2. `backend/internal/engine/chunker/chunker_test.go`:
   - Test split + reassemble roundtrip
   - Test partial file (last chunk smaller)
   - Test exact multiple of chunk size
   - Test empty file
   - Test concurrent read from channel

**Integration points:**
- Used by `TransferEngine` (backend) to reassemble incoming chunks
- Used by `TransferEngine` to split for relay to destination agent

---

### Task 2.2: Compressor Interface (Backend + Agent) — 1.5 days

**Package:** `backend/internal/engine/compress/` (shared via same interface in agent)

**Files to create:**

1. `backend/internal/engine/compress/compress.go`:

```go
package compress

// Algorithm identifies a compression algorithm
type Algorithm uint8

const (
    None Algorithm = 0
    Zstd Algorithm = 1
    LZ4  Algorithm = 2
)

func (a Algorithm) String() string

// Compressor compresses and decompresses data
type Compressor interface {
    Compress(data []byte) ([]byte, error)
    Decompress(data []byte, uncompressedSize int) ([]byte, error)
    Algorithm() Algorithm
}

func New(algo Algorithm) Compressor
func NewZstd() Compressor     // uses klauspost/compress/zstd
func NewLZ4() Compressor      // uses pierrec/lz4/v4
func NewNone() Compressor     // passthrough (no compression)
```

2. `backend/internal/engine/compress/zstd.go` — zstd implementation
3. `backend/internal/engine/compress/lz4.go` — LZ4 implementation
4. `backend/internal/engine/compress/none.go` — passthrough
5. `backend/internal/engine/compress/compress_test.go` — roundtrip tests, large data, incompressible data

**Dependencies to add:**
```
go get github.com/klauspost/compress
go get github.com/pierrec/lz4/v4
```

**Agent mirror:** The agent needs the same compress package. Create identical package at `agent/internal/engine/compress/` or extract to shared module.

**Decision:** Duplicate the compress package in the agent (same code, separate module) to keep backend and agent independently buildable. The interface + implementations are ~200 lines total.

---

### Task 2.3: SHA-256 Hasher (Backend + Agent) — 1 day

**Package:** `backend/internal/engine/hasher/`

**Files to create:**

1. `backend/internal/engine/hasher/hasher.go`:

```go
package hasher

import "crypto/sha256"

// Hash computes SHA-256 of data
func Hash(data []byte) [32]byte

// HashReader computes SHA-256 of an io.Reader (streaming)
func HashReader(reader io.Reader) ([32]byte, int64, error)

// Verify checks data against expected hash
func Verify(data []byte, expected [32]byte) bool

// VerifyReader checks an io.Reader against expected hash
func VerifyReader(reader io.Reader, expected [32]byte) (bool, error)

// HexString converts hash to hex string for display/storage
func HexString(hash [32]byte) string

// FromHexString converts hex string back to hash
func FromHexString(s string) ([32]byte, error)
```

2. `backend/internal/engine/hasher/hasher_test.go`

**Notes:**
- Uses Go stdlib `crypto/sha256` — no external dependencies needed
- Same package duplicated in agent: `agent/internal/engine/hasher/`

---

### Task 2.4: Binary WebSocket Protocol (Backend) — 2 days

**Package:** `backend/internal/engine/protocol/`

**Files to create:**

1. `backend/internal/engine/protocol/binary.go`:

```go
package protocol

import "encoding/binary"

const (
    MagicBytes     = 0x46465846  // "FFXF"
    HeaderSize     = 57           // bytes
    MaxChunkSize   = 64 * 1024 * 1024
)

// BinaryHeader is the fixed header for binary chunk frames
type BinaryHeader struct {
    Magic            uint32
    TransferID       uint32
    ChunkIndex       uint32
    TotalChunks      uint32
    ChunkSHA256      [32]byte
    UncompressedSize uint32
    CompressedSize   uint32
    Compression      uint8  // 0=none, 1=zstd, 2=lz4
}

// EncodeFrame creates a binary WebSocket frame from header + data
func EncodeFrame(h BinaryHeader, data []byte) []byte

// DecodeFrame parses a binary WebSocket frame into header + data
func DecodeFrame(frame []byte) (BinaryHeader, []byte, error)

// EncodeHeader writes header bytes
func EncodeHeader(h BinaryHeader) [HeaderSize]byte

// DecodeHeader parses header from bytes
func DecodeHeader(b []byte) (BinaryHeader, error)

// ValidateHeader checks magic bytes and size constraints
func ValidateHeader(h BinaryHeader) error
```

2. `backend/internal/engine/protocol/binary_test.go` — roundtrip encode/decode, malformed input, edge cases

**Changes to existing files:**

- `backend/internal/websocket/manager.go`:
  - Increase `ReadBufferSize` to `64 * 1024` (64 KB) and `WriteBufferSize` to `64 * 1024`
  - Increase `ReadLimit` from 4096 to `MaxChunkSize + HeaderSize + padding`
  - Add binary message handling in `readPump()`: detect `websocket.BinaryMessage` type and route to chunk handler
  - Add `SendBinaryToAgent(agentID int, data []byte) error` method

- Agent mirror: `agent/internal/engine/protocol/` — same encode/decode (agent encodes upload frames, decodes download frames)

---

### Task 2.5: Transfer Relay (Backend) — 3 days

**Package:** `backend/internal/engine/relay/`

This is the core relay logic: source → backend temp storage → destination.

**Files to create:**

1. `backend/internal/engine/relay/relay.go`:

```go
package relay

// Relay manages the intermediate storage of chunks during transfer
type Relay struct {
    storageDir string  // base directory for chunk storage
    logger     *log.Logger
}

func New(storageDir string, logger *log.Logger) *Relay

// StoreChunk stores a received chunk to disk and returns its path
func (r *Relay) StoreChunk(transferID int, chunkIndex uint32, data []byte) (string, error)

// GetChunk retrieves a stored chunk from disk
func (r *Relay) GetChunk(transferID int, chunkIndex uint32) ([]byte, error)

// GetAllChunks returns paths to all stored chunks in order
func (r *Relay) GetAllChunks(transferID int, totalChunks uint32) ([]string, error)

// CleanupTransfer removes all chunk files for a transfer
func (r *Relay) CleanupTransfer(transferID int) error

// DiskUsage returns total disk space used by relay storage
func (r *Relay) DiskUsage() (int64, error)
```

**Storage layout:**
```
storage/
  relay/
    transfer-{id}/
      chunk-000000.bin
      chunk-000001.bin
      ...
      chunk-{N}.bin
```

**Changes to existing files:**

- Replace current `backend/adapter/http/file_handler.go` approach (whole-file storage) with chunk-based relay storage
- Keep backward compatibility: old file_handler continues to work for HTTP-based transfers; new relay handles WS binary transfers

---

### Task 2.6: Transfer State Management — 2 days

**Package:** `backend/internal/engine/state/`

**Files to create:**

1. `backend/internal/engine/state/tracker.go`:

```go
package state

// TransferState tracks in-flight transfer state
type TransferState struct {
    TransferID      int
    TotalChunks     uint32
    CompletedChunks map[uint32]bool  // chunk_index → received
    FileHash        [32]byte          // expected whole-file hash
    ChunkSize       int64
    Compression     compress.Algorithm
    StartedAt       time.Time
    LastActivity    time.Time
    BytesSent       int64
    BytesReceived   int64
    Phase           TransferPhase     // upload | download
    mu              sync.Mutex
}

type TransferPhase string
const (
    PhaseUpload   TransferPhase = "upload"
    PhaseDownload TransferPhase = "download"
)

// Tracker manages all in-flight transfer states (in-memory with DB persistence)
type Tracker struct {
    active map[int]*TransferState  // transferID → state
    mu     sync.RWMutex
    repo   TransferChunkRepository
    logger *log.Logger
}

func NewTracker(repo TransferChunkRepository, logger *log.Logger) *Tracker

// Start creates a new in-flight transfer state
func (t *Tracker) Start(transferID int, totalChunks uint32, fileHash [32]byte, opts TransferOpts) error

// MarkChunkComplete marks a chunk as received and persists to DB
func (t *Tracker) MarkChunkComplete(transferID int, chunkIndex uint32, hash [32]byte) error

// IsComplete returns true when all chunks are received
func (t *Tracker) IsComplete(transferID int) bool

// GetMissingChunks returns indices of chunks not yet received (for resume)
func (t *Tracker) GetMissingChunks(transferID int) []uint32

// GetProgress returns (completedChunks, totalChunks)
func (t *Tracker) GetProgress(transferID int) (uint32, uint32)

// Remove cleans up state for completed/failed transfers
func (t *Tracker) Remove(transferID int)

// RecoverFromDB loads in-flight transfers from DB on startup (for resume after crash)
func (t *Tracker) RecoverFromDB(ctx context.Context) error

// StaleTransferCleanup marks transfers with no activity for >timeout as failed
func (t *Tracker) StaleTransferCleanup(timeout time.Duration) []int
```

---

### Task 2.7: Transfer Chunk Repository — 1.5 days

**New DB migration + repository.**

**Migration SQL:**

```sql
-- Add columns to transfers table
ALTER TABLE transfers
    ADD COLUMN file_hash       VARCHAR(64),
    ADD COLUMN compression     VARCHAR(10) DEFAULT 'none',
    ADD COLUMN chunk_size      INTEGER DEFAULT 8388608,
    ADD COLUMN total_chunks    INTEGER DEFAULT 0,
    ADD COLUMN completed_chunks INTEGER DEFAULT 0,
    ADD COLUMN bytes_transferred BIGINT DEFAULT 0,
    ADD COLUMN retry_count     INTEGER DEFAULT 0,
    ADD COLUMN max_retries     INTEGER DEFAULT 3;

-- New transfer_chunks table
CREATE TABLE transfer_chunks (
    id              SERIAL PRIMARY KEY,
    transfer_id     INTEGER NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
    chunk_index     INTEGER NOT NULL,
    chunk_hash      VARCHAR(64) NOT NULL,
    size_compressed INTEGER NOT NULL,
    size_original   INTEGER NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, received, verified, failed
    received_at     TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (transfer_id, chunk_index)
);

CREATE INDEX idx_transfer_chunks_transfer ON transfer_chunks(transfer_id);
CREATE INDEX idx_transfer_chunks_status ON transfer_chunks(transfer_id, status);
```

**Files to create:**

1. `backend/adapter/postgres/transfer_chunk_repo.go`:

```go
package postgres

type TransferChunkRepo struct {
    db *sql.DB
}

func NewTransferChunkRepo(pgdb *DB) *TransferChunkRepo

// CreateChunks creates chunk records for a transfer (called on transfer start)
func (r *TransferChunkRepo) CreateChunks(ctx context.Context, transferID int, totalChunks int) error

// MarkChunkReceived updates a chunk as received with its hash
func (r *TransferChunkRepo) MarkChunkReceived(ctx context.Context, transferID int, chunkIndex int, hash string, compressedSize, originalSize int) error

// GetChunkStatus returns status of all chunks for a transfer
func (r *TransferChunkRepo) GetChunkStatus(ctx context.Context, transferID int) ([]ChunkStatus, error)

// GetPendingChunks returns indices of chunks not yet received
func (r *TransferChunkRepo) GetPendingChunks(ctx context.Context, transferID int) ([]int, error)

// GetCompletedCount returns count of received chunks
func (r *TransferChunkRepo) GetCompletedCount(ctx context.Context, transferID int) (int, error)
```

**Changes to existing files:**

- `backend/adapter/postgres/transfer_repo.go`:
  - Update `Create()` to include new columns
  - Add `UpdateChunkProgress(ctx, id, completedChunks, bytesTransferred)` method
  - Add `UpdateFileHash(ctx, id, hash)` method
  - Update `GetByID()` to include new columns

- `backend/domain/transfer/entity.go`:
  - Add new fields to `Transfer` struct:
    ```go
    FileHash          string  `json:"file_hash,omitempty"`
    Compression       string  `json:"compression,omitempty"`
    ChunkSize         int     `json:"chunk_size,omitempty"`
    TotalChunks       int     `json:"total_chunks"`
    CompletedChunks   int     `json:"completed_chunks"`
    BytesTransferred  int64   `json:"bytes_transferred"`
    RetryCount        int     `json:"retry_count"`
    MaxRetries        int     `json:"max_retries"`
    ```
  - Add new `StatusCancelled Status = "cancelled"` (distinct from failed)
  - Add `Repository.UpdateChunkProgress()` and `Repository.UpdateFileHash()` to interface

---

### Task 2.8: TransferEngine Orchestrator (Backend) — 2 days

**Package:** `backend/internal/engine/`

**This is the central coordinator that ties everything together.**

**Files to create:**

1. `backend/internal/engine/engine.go`:

```go
package engine

// TransferEngine orchestrates the entire transfer lifecycle
type TransferEngine struct {
    chunker    *chunker.Chunker
    compressor compress.Compressor
    relay      *relay.Relay
    tracker    *state.Tracker
    dispatcher dispatch.WSDispatcher   // to send to agents
    transfers  transfer.Repository
    chunks     TransferChunkRepository
    logger     *log.Logger
}

func New(opts EngineOpts) *TransferEngine

// StartTransfer initiates a new transfer
// - Creates DB records (transfer + chunk placeholders)
// - Sends transfer_request to source agent
// - Sets up in-flight tracking
func (e *TransferEngine) StartTransfer(ctx context.Context, req StartTransferRequest) (*transfer.Transfer, error)

// HandleChunkReceived processes an incoming binary chunk frame from source agent
// - Verify chunk hash
// - Store via relay
// - Update chunk status in DB
// - Check if all chunks received → trigger download phase
func (e *TransferEngine) HandleChunkReceived(ctx context.Context, agentID int, header protocol.BinaryHeader, data []byte) error

// HandleChunkRequest serves a chunk to destination agent (binary frame)
func (e *TransferEngine) HandleChunkRequest(ctx context.Context, agentID int, transferID int, chunkIndex uint32) error

// HandleTransferComplete processes transfer completion from destination agent
// - Verify whole-file hash
// - Update DB status
// - Cleanup relay storage
func (e *TransferEngine) HandleTransferComplete(ctx context.Context, agentID int, transferID int, fileHash string) error

// ResumeTransfer resumes a failed/interrupted transfer
// - Find missing chunks
// - Re-dispatch transfer request with chunk offset
func (e *TransferEngine) ResumeTransfer(ctx context.Context, transferID int) error

// CancelTransfer cancels an in-flight transfer
// - Send cancel to both agents
// - Cleanup relay storage
// - Update DB status
func (e *TransferEngine) CancelTransfer(ctx context.Context, transferID int) error

// GetTransferState returns current in-flight state (for API/debugging)
func (e *TransferEngine) GetTransferState(transferID int) (*state.TransferState, error)
```

**Changes to existing files:**

- `backend/internal/websocket/manager.go`:
  - Add `TransferEngine` dependency
  - In `readPump()`, detect `websocket.BinaryMessage` → route to `engine.HandleChunkReceived()`
  - Add `SendBinaryToAgent(agentID, data)` for sending chunk data

- `backend/internal/dispatch/dispatcher.go`:
  - Remove duplicated two-phase logic from `MessageRouter.handleTransferComplete()` — delegate to `TransferEngine`
  - Add `SendBinaryToAgent()` to `WSDispatcher` interface
  - `MessageRouter` get a reference to `TransferEngine` instead of doing dispatch logic itself

- `backend/adapter/http/transfer_handler.go`:
  - Add `ResumeTransfer()` handler at `POST /api/transfers/{id}/resume`
  - Add chunk listing to `GetTransfer()` response

- `backend/adapter/http/router.go`:
  - Add `POST /api/transfers/{id}/resume` route

---

### Task 2.9: Agent Chunker + Compressor + Hasher — 3 days

**Mirror the backend engine packages in the agent.**

**Packages to create:**
- `agent/internal/engine/chunker/` — same interface as backend
- `agent/internal/engine/compress/` — same zstd/LZ4 implementations
- `agent/internal/engine/hasher/` — same SHA-256 implementation
- `agent/internal/engine/protocol/` — binary frame encode/decode

**Dependencies to add to `agent/go.mod`:**
```
go get github.com/klauspost/compress
go get github.com/pierrec/lz4/v4
```

---

### Task 2.10: Agent Push Mode (Upload) — 3 days

**Rewrite `agent/internal/transfer/manager.go` `executeUpload()`.**

**New flow:**
```go
func (m *Manager) executeUpload(at *activeTransfer, req TransferRequest) error {
    // 1. Open source file
    // 2. Compute whole-file SHA-256 (streaming)
    // 3. Calculate total chunks
    // 4. For each chunk:
    //    a. Read chunk_size bytes
    //    b. Compute chunk SHA-256
    //    c. Compress (zstd/LZ4/none based on config)
    //    d. Encode binary frame (protocol.EncodeFrame)
    //    e. Send via WebSocket binary message
    //    f. Wait for chunk_ack (with timeout)
    //    g. On chunk_nack → resend chunk
    //    h. Report progress
    // 5. Send transfer_complete with whole-file SHA-256
}
```

**Changes to existing files:**

- `agent/internal/transfer/manager.go`:
  - Add `ChunkedUploader` field (uses engine packages)
  - Rewrite `executeUpload()` to use chunked binary protocol
  - Keep old HTTP upload as fallback (for backward compat / polling mode)
  - Add chunk ack/nack handling

- `agent/internal/transport/transport.go`:
  - Add `SendBinaryMessage(data []byte)` to `Transport` interface
  - Add `OnBinaryMessage(handler func([]byte))` callback registration

- `agent/internal/transport/ws_transport.go`:
  - Implement `SendBinaryMessage()` using `websocket.BinaryMessage` type
  - In `readLoop()`, detect binary messages and route to binary handler

---

### Task 2.11: Agent Pull Mode (Download) — 2 days

**New `executeDownload()` in agent transfer manager.**

**New flow:**
```go
func (m *Manager) executeDownload(at *activeTransfer, req TransferRequest) error {
    // 1. Create temp directory for chunks
    // 2. Send chunk_request for each chunk (or receive pushed chunks)
    // 3. For each received binary frame:
    //    a. Decode frame (protocol.DecodeFrame)
    //    b. Verify chunk SHA-256
    //    c. Decompress
    //    d. Write to temp chunk file
    //    e. Send chunk_ack
    //    f. Report progress
    // 4. Reassemble chunks into final file
    // 5. Verify whole-file SHA-256
    // 6. Move to destination path
    // 7. Send transfer_complete
    // 8. Cleanup temp files
}
```

---

### Task 2.12: Resume Logic — 2 days

**Backend side:**
- `TransferEngine.ResumeTransfer()`:
  - Query `transfer_chunks` for missing chunks
  - Recreate `TransferState` from DB
  - Send `transfer_request` with `resume_from_chunk` field
  - Only missing chunks are re-sent

**Agent side:**
- State persistence: write `.state` files to `config.TempDir`:
  ```json
  {
    "transfer_id": "123",
    "total_chunks": 100,
    "completed_chunks": [0,1,2,...,57],
    "file_hash": "abc...",
    "chunk_size": 8388608,
    "source_path": "/data/file.dat",
    "destination_path": "/backup/file.dat"
  }
  ```
- On startup: scan for `.state` files, report to server via `transfer_resume` message
- On chunk completion: update `.state` file
- On transfer completion: delete `.state` file

**Changes:**
- Add `StatusSuspended Status = "suspended"` to transfer domain for paused/interrupted transfers
- Add `resume_from_chunk` field to `TransferRequestMessage`

---

### Task 2.13: Retry with Exponential Backoff — 1 day

**Agent side (`agent/internal/transfer/manager.go`):**

```go
// retryChunk resends a chunk with exponential backoff
func (m *Manager) retryChunk(at *activeTransfer, chunk Chunk, maxRetries int) error {
    baseDelay := 1 * time.Second
    for attempt := 0; attempt < maxRetries; attempt++ {
        err := m.sendChunk(at, chunk)
        if err == nil {
            return nil
        }
        delay := baseDelay * time.Duration(1<<attempt)
        if delay > 30*time.Second {
            delay = 30 * time.Second
        }
        select {
        case <-at.cancel:
            return fmt.Errorf("cancelled")
        case <-time.After(delay):
        }
    }
    return fmt.Errorf("max retries exceeded")
}
```

**Backend side:**
- Transfer `retry_count` and `max_retries` in DB
- `TransferEngine` increments `retry_count` on transfer-level retry
- Fails permanently when `retry_count >= max_retries`

---

### Task 2.14: File Watcher (Agent) — 2 days

**Package:** `agent/internal/watcher/`

**Files to create:**

1. `agent/internal/watcher/watcher.go`:

```go
package watcher

import "github.com/fsnotify/fsnotify"

// Config for file watching
type WatchConfig struct {
    Paths    []string  // directories to watch
    Patterns []string  // glob patterns (e.g., "*.csv", "report_*.pdf")
    Interval int       // polling interval in seconds (fallback if fsnotify unavailable)
}

// Watcher monitors directories for new files matching patterns
type Watcher struct {
    config   WatchConfig
    handler  FileHandler
    fsWatcher *fsnotify.Watcher
    logger   *log.Logger
    done     chan struct{}
}

type FileHandler interface {
    OnNewFile(path string, size int64) error
}

func New(cfg WatchConfig, handler FileHandler, logger *log.Logger) (*Watcher, error)
func (w *Watcher) Start() error   // starts watching (blocks)
func (w *Watcher) Stop()          // stops watching
```

**Integration:**
- Agent main loop creates `Watcher` with transfer manager as `FileHandler`
- When new file detected → check if it matches any active job's source pattern → trigger transfer
- Agent config gains `watch` section:
  ```yaml
  watch:
    enabled: true
    paths:
      - /data/outgoing
    patterns:
      - "*.csv"
      - "*.xlsx"
    interval: 30  # fallback polling interval
  ```

**Dependencies to add to `agent/go.mod`:**
```
go get github.com/fsnotify/fsnotify
```

---

## 4. File Change Summary

### New Files (Backend)

| # | File | Lines (est.) |
|---|------|-------------|
| 1 | `backend/internal/engine/chunker/chunker.go` | 150 |
| 2 | `backend/internal/engine/chunker/chunker_test.go` | 200 |
| 3 | `backend/internal/engine/compress/compress.go` | 60 |
| 4 | `backend/internal/engine/compress/zstd.go` | 60 |
| 5 | `backend/internal/engine/compress/lz4.go` | 60 |
| 6 | `backend/internal/engine/compress/none.go` | 30 |
| 7 | `backend/internal/engine/compress/compress_test.go` | 150 |
| 8 | `backend/internal/engine/hasher/hasher.go` | 80 |
| 9 | `backend/internal/engine/hasher/hasher_test.go` | 100 |
| 10 | `backend/internal/engine/protocol/binary.go` | 150 |
| 11 | `backend/internal/engine/protocol/binary_test.go` | 200 |
| 12 | `backend/internal/engine/relay/relay.go` | 150 |
| 13 | `backend/internal/engine/relay/relay_test.go` | 150 |
| 14 | `backend/internal/engine/state/tracker.go` | 250 |
| 15 | `backend/internal/engine/state/tracker_test.go` | 200 |
| 16 | `backend/internal/engine/engine.go` | 350 |
| 17 | `backend/internal/engine/engine_test.go` | 300 |
| 18 | `backend/adapter/postgres/transfer_chunk_repo.go` | 150 |
| 19 | DB migration: `0002_transfer_chunks.up.sql` | 30 |
| 20 | DB migration: `0002_transfer_chunks.down.sql` | 10 |

**Estimated new backend code: ~2,830 lines**

### New Files (Agent)

| # | File | Lines (est.) |
|---|------|-------------|
| 1 | `agent/internal/engine/chunker/chunker.go` | 150 |
| 2 | `agent/internal/engine/compress/compress.go` | 60 |
| 3 | `agent/internal/engine/compress/zstd.go` | 60 |
| 4 | `agent/internal/engine/compress/lz4.go` | 60 |
| 5 | `agent/internal/engine/compress/none.go` | 30 |
| 6 | `agent/internal/engine/hasher/hasher.go` | 80 |
| 7 | `agent/internal/engine/protocol/binary.go` | 150 |
| 8 | `agent/internal/watcher/watcher.go` | 200 |
| 9 | `agent/internal/watcher/watcher_test.go` | 150 |

**Estimated new agent code: ~940 lines**

### Modified Files

| # | File | Changes |
|---|------|---------|
| 1 | `backend/domain/transfer/entity.go` | Add 8 new fields to `Transfer`, 2 new repo methods |
| 2 | `backend/application/transfer/service.go` | Add resume, chunk-aware methods |
| 3 | `backend/adapter/http/transfer_handler.go` | Add `ResumeTransfer()`, chunk detail |
| 4 | `backend/adapter/http/router.go` | Add resume route |
| 5 | `backend/adapter/postgres/transfer_repo.go` | Update Create/Get for new columns, add methods |
| 6 | `backend/internal/websocket/manager.go` | Binary message handling, larger buffers, engine integration |
| 7 | `backend/internal/websocket/protocol.go` | New message types (chunk_ack, chunk_nack, chunk_request, transfer_resume) |
| 8 | `backend/internal/dispatch/dispatcher.go` | Remove duplicate logic, delegate to engine, add binary dispatch |
| 9 | `backend/go.mod` | Add klauspost/compress, pierrec/lz4 |
| 10 | `agent/internal/transfer/manager.go` | Rewrite upload/download to chunked binary |
| 11 | `agent/internal/transport/transport.go` | Add SendBinaryMessage, OnBinaryMessage |
| 12 | `agent/internal/transport/ws_transport.go` | Binary message support |
| 13 | `agent/internal/transport/polling_transport.go` | Binary fallback via base64-encoded HTTP (degraded) |
| 14 | `agent/internal/transport/auto_transport.go` | Pass through binary methods |
| 15 | `agent/go.mod` | Add klauspost/compress, pierrec/lz4, fsnotify |

---

## 5. Execution Order & Dependencies

```
Week 5:
  ├─ 2.1 Chunker (backend)              ── no deps
  ├─ 2.2 Compressor (backend + agent)   ── no deps
  ├─ 2.3 SHA-256 Hasher (backend+agent)  ── no deps
  └─ 2.9 Agent engine packages (mirror)  ── depends on 2.1/2.2/2.3 designs

Week 6:
  ├─ 2.4 Binary WS Protocol             ── no deps
  ├─ 2.7 Transfer Chunk Repository       ── depends on domain model changes
  ├─ 2.6 Transfer State Management       ── depends on 2.7
  └─ 2.14 File Watcher (agent)           ── no deps

Week 7:
  ├─ 2.5 Transfer Relay                  ── depends on 2.1, 2.4
  ├─ 2.8 TransferEngine Orchestrator     ── depends on 2.1–2.7 (all engine components)
  └─ 2.10 Agent Push Mode               ── depends on 2.9, 2.4

Week 8:
  ├─ 2.11 Agent Pull Mode               ── depends on 2.10
  ├─ 2.12 Resume Logic                  ── depends on 2.8, 2.10, 2.11
  ├─ 2.13 Retry with Backoff            ── depends on 2.10
  └─ Integration testing                 ── depends on all
```

---

## 6. Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Binary WS protocol bugs | High | Extensive table-driven tests, fuzz testing on decode |
| Chunk reassembly order | Medium | Chunks stored with index in filename; reassembly reads in order |
| Compression ratio varies | Low | Compression is optional per-transfer; auto-detect based on file type |
| Large file memory pressure | High | Streaming chunker (channel-based), never buffer entire file in memory |
| Agent crash mid-transfer | Medium | State files + chunk tracking enable resume from last known chunk |
| WS read limit too small for chunks | High | Increase to chunk_size + header (configurable); validated at frame decode |
| Polling agents can't do binary WS | Medium | Fallback: base64-encode chunks in JSON over HTTP; ~33% overhead accepted |
| Backend crash mid-relay | Medium | Chunk files on disk + DB state survive restart; `Tracker.RecoverFromDB()` on startup |

---

## 7. Testing Strategy

| Layer | Test Type | Count (est.) |
|-------|-----------|-------------|
| Chunker | Unit | 8 tests (split, reassemble, edge cases) |
| Compressor | Unit | 12 tests (roundtrip per algorithm, incompressible, empty) |
| Hasher | Unit | 6 tests (known vectors, streaming, verify) |
| Binary Protocol | Unit | 10 tests (encode/decode, malformed, max size) |
| Relay | Unit | 8 tests (store, get, cleanup, disk usage) |
| Tracker | Unit | 10 tests (lifecycle, concurrent access, recovery) |
| TransferEngine | Integration | 6 tests (full upload, full download, resume, cancel, error) |
| Agent Upload | Integration | 4 tests (small file, large file, interrupt, resume) |
| Agent Download | Integration | 4 tests (small file, large file, hash mismatch) |
| File Watcher | Unit | 6 tests (detect, glob match, debounce) |
| **Total** | | **~74 tests** |

---

## 8. Configuration Changes

### Backend `config.yaml` additions:
```yaml
transfer:
  chunk_size: 8388608        # 8 MB default
  compression: "zstd"        # "zstd", "lz4", "none"
  max_retries: 3
  relay_storage_dir: "./storage/relay"
  max_relay_disk_gb: 50      # max disk usage for relay
  stale_transfer_timeout: "1h"
  cleanup_interval: "5m"

websocket:
  read_buffer_size: 65536    # 64 KB
  write_buffer_size: 65536
  max_message_size: 67108864 # 64 MB (chunk + header)
```

### Agent `config.yaml` additions:
```yaml
transfer:
  chunk_size: 8388608
  compression: "zstd"
  max_retries: 3
  temp_dir: "/tmp/fileflux"
  chunk_ack_timeout: "30s"

watch:
  enabled: false
  paths: []
  patterns: []
  interval: 30
```

---

## 9. Backward Compatibility

The existing HTTP-based file transfer (`PUT /api/files/{id}/upload`, `GET /api/files/{id}/download`) will **continue to work** alongside the new binary WebSocket chunked transfer. This ensures:

1. **Polling agents** that can't use binary WS frames fall back to HTTP file transfer
2. **Gradual migration** — existing demo scripts continue working
3. **Simple transfers** (small files) can optionally skip chunking overhead

The `TransferRequestMessage` gains a `protocol` field:
```go
Protocol string `json:"protocol"` // "binary_ws" (new) or "http" (legacy)
```

The agent checks this field and uses the appropriate transfer method.

---

## 10. Success Criteria for Phase 2

| Metric | Target |
|--------|--------|
| Transfer throughput | > 100 MB/s (local network, binary WS) |
| Compression ratio (zstd) | > 60% on typical office files |
| Chunk integrity | 100% SHA-256 verified (chunk + whole-file) |
| Resume success rate | > 95% (after crash simulation) |
| Max file size tested | > 10 GB |
| Agent reconnect + resume | < 10s |
| All unit tests passing | 74+ tests |
| Backward compat | Old HTTP transfer still works |
| No full-file buffering | ✓ (streaming chunker) |
