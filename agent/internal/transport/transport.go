// Package transport definiert die Transportabstraktion für die Agent-Server-Kommunikation.
// Unterstützt WebSocket (primär) und HTTP Long-Polling (Fallback) als Transportmechanismen.
package transport

import (
	"encoding/json"
	"time"
)

// MessageType definiert den Typ einer Nachricht.
type MessageType string

const (
	// Agent → Server
	MessageTypeHeartbeat        MessageType = "heartbeat"
	MessageTypeAgentInfo        MessageType = "agent_info"
	MessageTypeTransferProgress MessageType = "transfer_progress"
	MessageTypeTransferComplete MessageType = "transfer_complete"
	MessageTypeTransferError    MessageType = "transfer_error"

	// Server → Agent
	MessageTypeTransferRequest        MessageType = "transfer_request"
	MessageTypeCancelTransfer         MessageType = "cancel_transfer"
	MessageTypeConnectionTest         MessageType = "connection_test"
	MessageTypeConnectionTestResponse MessageType = "connection_test_response"

	// Binary protocol message types
	MessageTypeChunkAck       MessageType = "chunk_ack"
	MessageTypeChunkNack      MessageType = "chunk_nack"
	MessageTypeChunkRequest   MessageType = "chunk_request"
	MessageTypeTransferResume MessageType = "transfer_resume"
)

// Message ist das Envelope-Format für alle Nachrichten.
type Message struct {
	Type MessageType     `json:"type"`
	Data json.RawMessage `json:"data"`
}

// HeartbeatData enthält Heartbeat-Informationen.
type HeartbeatData struct {
	Timestamp time.Time `json:"timestamp"`
}

// TransferRequest wird vom Server gesendet, um einen Transfer zu starten.
type TransferRequest struct {
	Transfer struct {
		ID               string `json:"id"`
		JobID            string `json:"job_id"`
		SourcePath       string `json:"source_path"`
		DestinationPath  string `json:"destination_path"`
		Compressed       bool   `json:"compressed"`
		ChunkSize        int    `json:"chunk_size"`
		TransferType     string `json:"transfer_type"` // "upload" oder "download"
		DestinationAgent string `json:"destination_agent,omitempty"`
		Protocol         string `json:"protocol,omitempty"`    // "binary_ws" or "http" (default)
		Compression      string `json:"compression,omitempty"` // "zstd", "lz4", "none"
	} `json:"transfer"`
}

// TransferHandler definiert die Schnittstelle für Transfer-Operationen.
type TransferHandler interface {
	StartTransfer(request TransferRequest) error
	CancelTransfer(transferID string) error
}

// Mode beschreibt den aktiven Transport-Modus.
type Mode string

const (
	ModeWebSocket Mode = "websocket"
	ModePolling   Mode = "polling"
)

// BinaryHandler verarbeitet eingehende binäre WebSocket-Nachrichten.
type BinaryHandler func(data []byte)

// Transport definiert die Schnittstelle für die Agent-Server-Kommunikation.
// Beide Implementierungen (WebSocket und HTTP Long-Polling) erfüllen dieses Interface.
type Transport interface {
	// Connect stellt die Verbindung her. Blockiert und versucht unbegrenzt mit Backoff.
	Connect() error
	// Disconnect trennt die Verbindung ordnungsgemäß.
	Disconnect()
	// SendMessage sendet eine JSON-Nachricht an den Server.
	SendMessage(msg Message)
	// SendBinaryMessage sendet eine binäre Nachricht an den Server (für Chunk-Transfer).
	SendBinaryMessage(data []byte) error
	// SetTransferHandler setzt den Handler für eingehende Transfer-Befehle.
	SetTransferHandler(handler TransferHandler)
	// SetBinaryHandler setzt den Handler für eingehende binäre Nachrichten (Chunk-Downloads).
	SetBinaryHandler(handler BinaryHandler)
	// IsConnected gibt zurück, ob eine aktive Verbindung besteht.
	IsConnected() bool
	// Mode gibt den aktiven Transport-Modus zurück.
	Mode() Mode
}

// SystemInfo enthält die Systeminformationen, die beim Verbindungsaufbau gesendet werden.
type SystemInfo struct {
	Hostname      string `json:"hostname"`
	OSName        string `json:"os_name"`
	OSVersion     string `json:"os_version"`
	Arch          string `json:"arch"`
	IPAddress     string `json:"ip_address"`
	NumCPU        int    `json:"num_cpu"`
	TotalMemMB    int64  `json:"total_mem_mb"`
	GoVersion     string `json:"go_version"`
	Version       string `json:"version"`
	TransportMode string `json:"transport_mode,omitempty"`
}

// ProgressReporter sendet Fortschritts- und Fertigmeldungen an den Server.
// Wird vom Transfer-Manager benutzt und nutzt intern Transport.SendMessage().
type ProgressReporter interface {
	SendTransferProgress(transferID string, progress float64, currentBytes, totalBytes int64)
	SendTransferComplete(transferID string, duration time.Duration)
	SendTransferError(transferID string, errMsg string)
}
