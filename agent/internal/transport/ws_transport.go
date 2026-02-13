package transport

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// WSConfig enthält die WebSocket-Verbindungsparameter.
type WSConfig struct {
	ServerURL         string
	Token             string
	HeartbeatInterval int // Sekunden
	ReconnectDelay    int // Sekunden (Basis für Backoff)
}

// WSTransport implementiert Transport über WebSocket.
type WSTransport struct {
	config          WSConfig
	logger          *log.Logger
	conn            *websocket.Conn
	connLock        sync.Mutex
	done            chan struct{}
	sysInfo         *SystemInfo
	transferHandler TransferHandler
	connected       bool
}

// NewWSTransport erstellt einen neuen WebSocket-Transport.
func NewWSTransport(cfg WSConfig, logger *log.Logger, sysInfo *SystemInfo) *WSTransport {
	return &WSTransport{
		config:  cfg,
		logger:  logger,
		sysInfo: sysInfo,
		done:    make(chan struct{}),
	}
}

// SetTransferHandler setzt den Transfer-Handler für eingehende Befehle.
func (t *WSTransport) SetTransferHandler(handler TransferHandler) {
	t.transferHandler = handler
}

// Connect stellt die WebSocket-Verbindung her (blockiert, infinite retry mit Backoff).
func (t *WSTransport) Connect() error {
	const maxBackoff = 5 * time.Minute
	baseDelay := time.Duration(t.config.ReconnectDelay) * time.Second
	if baseDelay < time.Second {
		baseDelay = 2 * time.Second
	}
	attempt := 0

	for {
		select {
		case <-t.done:
			return fmt.Errorf("transport wurde gestoppt")
		default:
		}

		if attempt > 0 {
			backoff := time.Duration(float64(baseDelay) * math.Pow(2, float64(attempt-1)))
			if backoff > maxBackoff {
				backoff = maxBackoff
			}
			jitter := time.Duration(rand.Int63n(int64(backoff / 4)))
			delay := backoff + jitter
			t.logger.Printf("[WS] Reconnect-Versuch %d in %v...", attempt, delay)
			time.Sleep(delay)
		}

		if err := t.dial(); err != nil {
			t.logger.Printf("[WS] Verbindungsfehler: %v", err)
			attempt++
			continue
		}

		attempt = 0
		t.connected = true
		t.sendAgentInfo()
		go t.heartbeatLoop()
		t.readLoop()

		t.connected = false
		t.logger.Println("[WS] Verbindung zum Server verloren")
		attempt = 1
	}
}

// TryConnect versucht eine einzelne WebSocket-Verbindung mit Timeout.
// Gibt nil zurück bei Erfolg, Fehler wenn Verbindung nicht möglich.
// Wird von AutoTransport genutzt um zu testen ob WS funktioniert.
func (t *WSTransport) TryConnect() error {
	if err := t.dial(); err != nil {
		return err
	}

	t.connected = true
	t.sendAgentInfo()
	go t.heartbeatLoop()

	// readLoop in Goroutine — wird über done-Channel gesteuert
	go func() {
		t.readLoop()
		t.connected = false
		t.logger.Println("[WS] Verbindung zum Server verloren")
	}()

	return nil
}

// Disconnect trennt die WebSocket-Verbindung.
func (t *WSTransport) Disconnect() {
	select {
	case <-t.done:
		// bereits geschlossen
	default:
		close(t.done)
	}

	t.connLock.Lock()
	defer t.connLock.Unlock()
	if t.conn != nil {
		t.conn.WriteMessage(
			websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""),
		)
		t.conn.Close()
		t.conn = nil
	}
	t.connected = false
}

// SendMessage sendet eine Nachricht über den WebSocket.
func (t *WSTransport) SendMessage(msg Message) {
	t.connLock.Lock()
	defer t.connLock.Unlock()

	if t.conn == nil {
		return
	}

	data, err := json.Marshal(msg)
	if err != nil {
		t.logger.Printf("[WS] Fehler beim Serialisieren der Nachricht: %v", err)
		return
	}

	t.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
	if err := t.conn.WriteMessage(websocket.TextMessage, data); err != nil {
		t.logger.Printf("[WS] Fehler beim Senden der Nachricht: %v", err)
	}
}

// IsConnected gibt zurück ob die WS-Verbindung aktiv ist.
func (t *WSTransport) IsConnected() bool {
	return t.connected
}

// Mode gibt den Transport-Modus zurück.
func (t *WSTransport) Mode() Mode {
	return ModeWebSocket
}

// --- interne Methoden ---

func (t *WSTransport) dial() error {
	header := http.Header{}
	header.Set("Authorization", "Bearer "+t.config.Token)

	dialer := websocket.DefaultDialer
	dialer.HandshakeTimeout = 10 * time.Second

	conn, _, err := dialer.Dial(t.config.ServerURL, header)
	if err != nil {
		return fmt.Errorf("WebSocket-Dial fehlgeschlagen: %w", err)
	}

	t.connLock.Lock()
	t.conn = conn
	t.connLock.Unlock()

	t.logger.Printf("[WS] Verbunden mit %s", t.config.ServerURL)
	return nil
}

func (t *WSTransport) sendAgentInfo() {
	if t.sysInfo == nil {
		return
	}

	// Transport-Modus setzen
	t.sysInfo.TransportMode = string(ModeWebSocket)

	data, err := json.Marshal(t.sysInfo)
	if err != nil {
		t.logger.Printf("[WS] Fehler beim Serialisieren der Agent-Info: %v", err)
		return
	}

	t.SendMessage(Message{
		Type: MessageTypeAgentInfo,
		Data: data,
	})
}

func (t *WSTransport) heartbeatLoop() {
	interval := time.Duration(t.config.HeartbeatInterval) * time.Second
	if interval <= 0 {
		interval = 60 * time.Second
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-t.done:
			return
		case <-ticker.C:
			heartbeat := HeartbeatData{Timestamp: time.Now()}
			data, _ := json.Marshal(heartbeat)
			t.SendMessage(Message{
				Type: MessageTypeHeartbeat,
				Data: data,
			})
		}
	}
}

func (t *WSTransport) readLoop() {
	for {
		select {
		case <-t.done:
			return
		default:
		}

		t.connLock.Lock()
		conn := t.conn
		t.connLock.Unlock()
		if conn == nil {
			return
		}

		conn.SetReadDeadline(time.Now().Add(90 * time.Second))
		_, raw, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				t.logger.Printf("[WS] Lesefehler: %v", err)
			}
			return
		}

		var msg Message
		if err := json.Unmarshal(raw, &msg); err != nil {
			t.logger.Printf("[WS] Fehler beim Parsen der Nachricht: %v", err)
			continue
		}

		t.handleMessage(msg)
	}
}

func (t *WSTransport) handleMessage(msg Message) {
	switch msg.Type {
	case MessageTypeTransferRequest:
		var req TransferRequest
		if err := json.Unmarshal(msg.Data, &req); err != nil {
			t.logger.Printf("[WS] Fehler beim Parsen der Transfer-Anfrage: %v", err)
			return
		}
		if t.transferHandler != nil {
			if err := t.transferHandler.StartTransfer(req); err != nil {
				t.logger.Printf("[WS] Fehler beim Starten des Transfers: %v", err)
				errorData := struct {
					TransferID string `json:"transfer_id"`
					Error      string `json:"error"`
				}{TransferID: req.Transfer.ID, Error: err.Error()}
				data, _ := json.Marshal(errorData)
				t.SendMessage(Message{Type: MessageTypeTransferError, Data: data})
			}
		}

	case MessageTypeCancelTransfer:
		var cancel struct {
			TransferID string `json:"transfer_id"`
		}
		if err := json.Unmarshal(msg.Data, &cancel); err != nil {
			t.logger.Printf("[WS] Fehler beim Parsen der Cancel-Nachricht: %v", err)
			return
		}
		if t.transferHandler != nil {
			t.transferHandler.CancelTransfer(cancel.TransferID)
		}

	case MessageTypeConnectionTest:
		t.SendMessage(Message{
			Type: MessageTypeConnectionTestResponse,
			Data: msg.Data,
		})

	default:
		t.logger.Printf("[WS] Unbekannter Nachrichtentyp: %s", msg.Type)
	}
}

// --- ProgressReporter Implementierung ---

// SendTransferProgress meldet den Transfer-Fortschritt an den Server.
func (t *WSTransport) SendTransferProgress(transferID string, progress float64, currentBytes, totalBytes int64) {
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
	t.SendMessage(Message{Type: MessageTypeTransferProgress, Data: data})
}

// SendTransferComplete meldet den erfolgreichen Abschluss eines Transfers.
func (t *WSTransport) SendTransferComplete(transferID string, duration time.Duration) {
	completeData := struct {
		TransferID string `json:"transfer_id"`
		Duration   int64  `json:"duration"`
	}{
		TransferID: transferID,
		Duration:   duration.Milliseconds(),
	}
	data, _ := json.Marshal(completeData)
	t.SendMessage(Message{Type: MessageTypeTransferComplete, Data: data})
}

// SendTransferError meldet einen Transfer-Fehler an den Server.
func (t *WSTransport) SendTransferError(transferID string, errMsg string) {
	errorData := struct {
		TransferID string `json:"transfer_id"`
		Error      string `json:"error"`
	}{
		TransferID: transferID,
		Error:      errMsg,
	}
	data, _ := json.Marshal(errorData)
	t.SendMessage(Message{Type: MessageTypeTransferError, Data: data})
}
