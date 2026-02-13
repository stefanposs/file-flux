package websocket

import (
	"encoding/json"
	"time"
)

// MessageType definiert den Typ einer WebSocket-Nachricht.
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
)

// Message ist das Envelope-Format für alle WebSocket-Nachrichten.
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
	} `json:"transfer"`
}
