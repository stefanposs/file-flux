package websocket

import (
	"encoding/json"
	"time"
)

// MessageType definiert den Typ einer Websocket-Nachricht
type MessageType string

const (
	// Agent zu Server Nachrichten
	MessageTypeHeartbeat        MessageType = "heartbeat"
	MessageTypeAgentInfo        MessageType = "agent_info"
	MessageTypeTransferProgress MessageType = "transfer_progress"
	MessageTypeTransferComplete MessageType = "transfer_complete"
	MessageTypeTransferError    MessageType = "transfer_error"
	MessageTypeTransferResume   MessageType = "transfer_resume"

	// Server zu Agent Nachrichten
	MessageTypeTransferRequest MessageType = "transfer_request"
	MessageTypeCancelTransfer  MessageType = "cancel_transfer"
	MessageTypeConnectionTest  MessageType = "connection_test"
	MessageTypeChunkAck        MessageType = "chunk_ack"
	MessageTypeChunkNack       MessageType = "chunk_nack"
)

// Message repräsentiert eine Websocket-Nachricht
type Message struct {
	Type MessageType     `json:"type"`
	Data json.RawMessage `json:"data"`
}

// HeartbeatMessage wird vom Agenten gesendet, um anzuzeigen, dass er noch aktiv ist
type HeartbeatMessage struct {
	AgentID   int       `json:"agent_id"`
	Timestamp time.Time `json:"timestamp"`
}

// AgentInfoMessage enthält Informationen über den Agenten
type AgentInfoMessage struct {
	System    string `json:"system"`
	IPAddress string `json:"ip_address"`
	Version   string `json:"version"`
}

// TransferProgressMessage enthält Fortschrittsinformationen für einen Transfer
type TransferProgressMessage struct {
	TransferID      string  `json:"transfer_id"`
	Progress        float64 `json:"progress"`
	CurrentChunk    int     `json:"current_chunk"`
	TotalChunks     int     `json:"total_chunks"`
	CurrentBytes    int64   `json:"current_bytes"`
	TotalBytes      int64   `json:"total_bytes"`
	BytesPerSecond  int64   `json:"bytes_per_second"`
	EstimatedTimeMs int64   `json:"estimated_time_ms"`
}

// TransferCompleteMessage wird gesendet, wenn ein Transfer abgeschlossen ist
type TransferCompleteMessage struct {
	TransferID string        `json:"transfer_id"`
	Duration   time.Duration `json:"duration"`
}

// TransferErrorMessage wird gesendet, wenn ein Fehler beim Transfer auftritt
type TransferErrorMessage struct {
	TransferID string `json:"transfer_id"`
	Error      string `json:"error"`
}

// TransferRequestMessage wird an einen Agenten gesendet, um einen Transfer zu starten
type TransferRequestMessage struct {
	Transfer struct {
		ID               string `json:"id"`
		JobID            string `json:"job_id"`
		SourcePath       string `json:"source_path"`
		DestinationPath  string `json:"destination_path"`
		Compressed       bool   `json:"compressed"`
		ChunkSize        int    `json:"chunk_size"`
		TransferType     string `json:"transfer_type"` // "upload" oder "download"
		DestinationAgent string `json:"destination_agent,omitempty"`
		Protocol         string `json:"protocol,omitempty"` // "binary_ws" or "http" (default)
		ResumeFromChunk  int    `json:"resume_from_chunk,omitempty"`
		TotalChunks      int    `json:"total_chunks,omitempty"`
		Compression      string `json:"compression,omitempty"` // "zstd", "lz4", "none"
	} `json:"transfer"`
}

// CancelTransferMessage wird an einen Agenten gesendet, um einen Transfer abzubrechen
type CancelTransferMessage struct {
	TransferID string `json:"transfer_id"`
}

// ConnectionTestMessage wird für Verbindungstests verwendet
type ConnectionTestMessage struct {
	RequestID string `json:"request_id"`
}

// ConnectionTestResponseMessage ist die Antwort auf einen Verbindungstest
type ConnectionTestResponseMessage struct {
	RequestID string    `json:"request_id"`
	Timestamp time.Time `json:"timestamp"`
}

// ChunkAckMessage acknowledges receipt of a chunk.
type ChunkAckMessage struct {
	TransferID string `json:"transfer_id"`
	ChunkIndex uint32 `json:"chunk_index"`
}

// ChunkNackMessage rejects a chunk (e.g., hash mismatch) and requests resend.
type ChunkNackMessage struct {
	TransferID string `json:"transfer_id"`
	ChunkIndex uint32 `json:"chunk_index"`
	Reason     string `json:"reason"`
}

// TransferResumeMessage is sent by an agent to resume an interrupted transfer.
type TransferResumeMessage struct {
	TransferID     string   `json:"transfer_id"`
	LastChunkIndex uint32   `json:"last_chunk_index"`
	FileHash       string   `json:"file_hash"`
	MissingChunks  []uint32 `json:"missing_chunks,omitempty"`
}
