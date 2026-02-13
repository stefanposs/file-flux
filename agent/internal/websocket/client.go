// Package websocket implementiert den WebSocket-Client für die Agent-Server-Kommunikation.
package websocket

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/stefanposs/file-flux/agent/internal/config"
	"github.com/stefanposs/file-flux/agent/internal/system"
)

// TransferHandler definiert die Schnittstelle für Transfer-Operationen.
type TransferHandler interface {
	StartTransfer(request TransferRequest) error
	CancelTransfer(transferID string) error
}

// Client ist der WebSocket-Client, der sich mit dem FileFlux-Server verbindet.
type Client struct {
	config          config.ConnectionConfig
	logger          *log.Logger
	conn            *websocket.Conn
	connLock        sync.Mutex
	done            chan struct{}
	sysInfo         *system.SystemInfo
	transferHandler TransferHandler
	connected       bool
}

// NewClient erstellt einen neuen WebSocket-Client.
func NewClient(cfg config.ConnectionConfig, logger *log.Logger) *Client {
	return &Client{
		config: cfg,
		logger: logger,
		done:   make(chan struct{}),
	}
}

// SetSystemInfo setzt die Systeminformationen für den Agenten.
func (c *Client) SetSystemInfo(info *system.SystemInfo) {
	c.sysInfo = info
}

// SetTransferManager setzt den Transfer-Handler.
func (c *Client) SetTransferManager(handler TransferHandler) {
	c.transferHandler = handler
}

// Connect stellt die WebSocket-Verbindung zum Server her.
func (c *Client) Connect() error {
	for attempt := 0; attempt <= c.config.ReconnectAttempts; attempt++ {
		if attempt > 0 {
			delay := time.Duration(c.config.ReconnectDelay) * time.Second
			c.logger.Printf("Reconnect-Versuch %d/%d in %v...", attempt, c.config.ReconnectAttempts, delay)
			time.Sleep(delay)
		}

		if err := c.dial(); err != nil {
			c.logger.Printf("Verbindungsfehler: %v", err)
			continue
		}

		// Verbindung erfolgreich — Lese-Schleife starten
		c.connected = true
		c.sendAgentInfo()
		go c.heartbeatLoop()
		c.readLoop()

		// readLoop beendet → Verbindung verloren
		c.connected = false
		c.logger.Println("Verbindung zum Server verloren")
	}

	return fmt.Errorf("maximale Reconnect-Versuche (%d) erreicht", c.config.ReconnectAttempts)
}

// Disconnect trennt die WebSocket-Verbindung.
func (c *Client) Disconnect() {
	close(c.done)
	c.connLock.Lock()
	defer c.connLock.Unlock()
	if c.conn != nil {
		c.conn.WriteMessage(
			websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""),
		)
		c.conn.Close()
		c.conn = nil
	}
}

// dial baut die eigentliche WebSocket-Verbindung auf.
func (c *Client) dial() error {
	header := http.Header{}
	header.Set("Authorization", "Bearer "+c.config.Token)

	dialer := websocket.DefaultDialer
	dialer.HandshakeTimeout = 10 * time.Second

	conn, _, err := dialer.Dial(c.config.ServerURL, header)
	if err != nil {
		return fmt.Errorf("WebSocket-Dial fehlgeschlagen: %w", err)
	}

	c.connLock.Lock()
	c.conn = conn
	c.connLock.Unlock()

	c.logger.Printf("Verbunden mit %s", c.config.ServerURL)
	return nil
}

// sendAgentInfo sendet Systeminformationen an den Server.
func (c *Client) sendAgentInfo() {
	if c.sysInfo == nil {
		return
	}

	msg := Message{
		Type: MessageTypeAgentInfo,
	}

	data, err := json.Marshal(c.sysInfo)
	if err != nil {
		c.logger.Printf("Fehler beim Serialisieren der Agent-Info: %v", err)
		return
	}
	msg.Data = data

	c.sendMessage(msg)
}

// heartbeatLoop sendet regelmäßig Heartbeats an den Server.
func (c *Client) heartbeatLoop() {
	interval := time.Duration(c.config.HeartbeatInterval) * time.Second
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-c.done:
			return
		case <-ticker.C:
			msg := Message{
				Type: MessageTypeHeartbeat,
			}
			heartbeat := HeartbeatData{
				Timestamp: time.Now(),
			}
			data, _ := json.Marshal(heartbeat)
			msg.Data = data
			c.sendMessage(msg)
		}
	}
}

// readLoop liest eingehende Nachrichten vom Server.
func (c *Client) readLoop() {
	for {
		select {
		case <-c.done:
			return
		default:
		}

		c.connLock.Lock()
		conn := c.conn
		c.connLock.Unlock()
		if conn == nil {
			return
		}

		conn.SetReadDeadline(time.Now().Add(90 * time.Second))
		_, raw, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				c.logger.Printf("WebSocket-Lesefehler: %v", err)
			}
			return
		}

		var msg Message
		if err := json.Unmarshal(raw, &msg); err != nil {
			c.logger.Printf("Fehler beim Parsen der Nachricht: %v", err)
			continue
		}

		c.handleMessage(msg)
	}
}

// handleMessage verarbeitet eingehende Nachrichten vom Server.
func (c *Client) handleMessage(msg Message) {
	switch msg.Type {
	case MessageTypeTransferRequest:
		var req TransferRequest
		if err := json.Unmarshal(msg.Data, &req); err != nil {
			c.logger.Printf("Fehler beim Parsen der Transfer-Anfrage: %v", err)
			return
		}
		if c.transferHandler != nil {
			if err := c.transferHandler.StartTransfer(req); err != nil {
				c.logger.Printf("Fehler beim Starten des Transfers: %v", err)
				// Fehlermeldung an Server senden
				c.sendTransferError(req.Transfer.ID, err.Error())
			}
		}

	case MessageTypeCancelTransfer:
		var cancel struct {
			TransferID string `json:"transfer_id"`
		}
		if err := json.Unmarshal(msg.Data, &cancel); err != nil {
			c.logger.Printf("Fehler beim Parsen der Cancel-Nachricht: %v", err)
			return
		}
		if c.transferHandler != nil {
			c.transferHandler.CancelTransfer(cancel.TransferID)
		}

	case MessageTypeConnectionTest:
		// Verbindungstest beantworten
		c.sendMessage(Message{
			Type: MessageTypeConnectionTestResponse,
			Data: msg.Data,
		})

	default:
		c.logger.Printf("Unbekannter Nachrichtentyp: %s", msg.Type)
	}
}

// sendMessage sendet eine Nachricht über den WebSocket.
func (c *Client) sendMessage(msg Message) {
	c.connLock.Lock()
	defer c.connLock.Unlock()

	if c.conn == nil {
		return
	}

	data, err := json.Marshal(msg)
	if err != nil {
		c.logger.Printf("Fehler beim Serialisieren der Nachricht: %v", err)
		return
	}

	c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
	if err := c.conn.WriteMessage(websocket.TextMessage, data); err != nil {
		c.logger.Printf("Fehler beim Senden der Nachricht: %v", err)
	}
}

// sendTransferError sendet eine Transfer-Fehlermeldung an den Server.
func (c *Client) sendTransferError(transferID, errMsg string) {
	errorData := struct {
		TransferID string `json:"transfer_id"`
		Error      string `json:"error"`
	}{
		TransferID: transferID,
		Error:      errMsg,
	}

	data, _ := json.Marshal(errorData)
	c.sendMessage(Message{
		Type: MessageTypeTransferError,
		Data: data,
	})
}

// SendTransferError implementiert transfer.ProgressReporter.
func (c *Client) SendTransferError(transferID, errMsg string) {
	c.sendTransferError(transferID, errMsg)
}

// SendTransferProgress meldet den Transfer-Fortschritt an den Server.
func (c *Client) SendTransferProgress(transferID string, progress float64, currentBytes, totalBytes int64) {
	progressData := struct {
		TransferID   string  `json:"transfer_id"`
		Progress     float64 `json:"progress"`
		CurrentBytes int64   `json:"current_bytes"`
		TotalBytes   int64   `json:"total_bytes"`
	}{
		TransferID:   transferID,
		Progress:     progress,
		CurrentBytes: currentBytes,
		TotalBytes:   totalBytes,
	}

	data, _ := json.Marshal(progressData)
	c.sendMessage(Message{
		Type: MessageTypeTransferProgress,
		Data: data,
	})
}

// SendTransferComplete meldet den erfolgreichen Abschluss eines Transfers.
func (c *Client) SendTransferComplete(transferID string, duration time.Duration) {
	completeData := struct {
		TransferID string `json:"transfer_id"`
		Duration   int64  `json:"duration"`
	}{
		TransferID: transferID,
		Duration:   duration.Milliseconds(),
	}

	data, _ := json.Marshal(completeData)
	c.sendMessage(Message{
		Type: MessageTypeTransferComplete,
		Data: data,
	})
}
