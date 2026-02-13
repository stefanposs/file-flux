package transport

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"math/rand"
	"net/http"
	"sync"
	"time"
)

// PollingConfig enthält die Konfiguration für den HTTP Long-Polling Transport.
type PollingConfig struct {
	ServerHTTPURL  string
	Token          string
	PollTimeout    int // Sekunden — wie lange der Long-Poll offen bleibt (default: 30)
	ReconnectDelay int // Sekunden (Basis für Backoff)
}

// PollingTransport implementiert Transport über HTTP Long-Polling.
// Jeder Poll-Request gilt als impliziter Heartbeat.
type PollingTransport struct {
	config          PollingConfig
	logger          *log.Logger
	sysInfo         *SystemInfo
	transferHandler TransferHandler
	connected       bool
	done            chan struct{}
	httpClient      *http.Client
	mu              sync.Mutex
}

// NewPollingTransport erstellt einen neuen HTTP Long-Polling Transport.
func NewPollingTransport(cfg PollingConfig, logger *log.Logger, sysInfo *SystemInfo) *PollingTransport {
	if cfg.PollTimeout <= 0 {
		cfg.PollTimeout = 30
	}
	return &PollingTransport{
		config:  cfg,
		logger:  logger,
		sysInfo: sysInfo,
		done:    make(chan struct{}),
		httpClient: &http.Client{
			// Timeout muss länger sein als der Long-Poll Timeout des Servers
			Timeout: time.Duration(cfg.PollTimeout+10) * time.Second,
		},
	}
}

// SetTransferHandler setzt den Transfer-Handler für eingehende Befehle.
func (p *PollingTransport) SetTransferHandler(handler TransferHandler) {
	p.transferHandler = handler
}

// Connect stellt die Polling-Verbindung her (blockiert, infinite retry mit Backoff).
// Registriert den Agent zunächst via /api/agent/connect, dann startet der Poll-Loop.
func (p *PollingTransport) Connect() error {
	const maxBackoff = 5 * time.Minute
	baseDelay := time.Duration(p.config.ReconnectDelay) * time.Second
	if baseDelay < time.Second {
		baseDelay = 2 * time.Second
	}
	attempt := 0

	for {
		select {
		case <-p.done:
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
			p.logger.Printf("[POLL] Reconnect-Versuch %d in %v...", attempt, delay)
			time.Sleep(delay)
		}

		// Schritt 1: Agent registrieren
		if err := p.register(); err != nil {
			p.logger.Printf("[POLL] Registrierung fehlgeschlagen: %v", err)
			attempt++
			continue
		}

		// Schritt 2: Poll-Loop — blockiert bis Verbindung verloren
		attempt = 0
		p.mu.Lock()
		p.connected = true
		p.mu.Unlock()
		p.logger.Println("[POLL] Verbunden mit Server (HTTP Long-Polling)")
		p.pollLoop()

		p.mu.Lock()
		p.connected = false
		p.mu.Unlock()
		p.logger.Println("[POLL] Verbindung zum Server verloren")
		attempt = 1
	}
}

// Disconnect beendet den Polling-Transport.
func (p *PollingTransport) Disconnect() {
	select {
	case <-p.done:
	default:
		close(p.done)
	}
	p.mu.Lock()
	p.connected = false
	p.mu.Unlock()
}

// SendMessage sendet eine Nachricht per HTTP POST an den Server.
func (p *PollingTransport) SendMessage(msg Message) {
	data, err := json.Marshal(msg)
	if err != nil {
		p.logger.Printf("[POLL] Fehler beim Serialisieren der Nachricht: %v", err)
		return
	}

	url := fmt.Sprintf("%s/api/agent/messages", p.config.ServerHTTPURL)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(data))
	if err != nil {
		p.logger.Printf("[POLL] Fehler beim Erstellen des Requests: %v", err)
		return
	}
	req.Header.Set("Authorization", "Bearer "+p.config.Token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		p.logger.Printf("[POLL] Fehler beim Senden der Nachricht: %v", err)
		return
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		p.logger.Printf("[POLL] Server antwortete mit HTTP %d beim Senden", resp.StatusCode)
	}
}

// IsConnected gibt zurück ob der Polling-Transport aktiv ist.
func (p *PollingTransport) IsConnected() bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.connected
}

// Mode gibt den Transport-Modus zurück.
func (p *PollingTransport) Mode() Mode {
	return ModePolling
}

// --- interne Methoden ---

// register sendet Agent-Info via POST /api/agent/connect.
func (p *PollingTransport) register() error {
	payload := struct {
		SystemInfo *SystemInfo `json:"system_info"`
		Transport  string      `json:"transport"`
	}{
		SystemInfo: p.sysInfo,
		Transport:  "polling",
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("serialisierung: %w", err)
	}

	url := fmt.Sprintf("%s/api/agent/connect", p.config.ServerHTTPURL)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("request erstellen: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+p.config.Token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("HTTP-Fehler: %w", err)
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("server antwortete mit HTTP %d", resp.StatusCode)
	}

	return nil
}

// pollLoop führt den Long-Polling-Loop aus. Blockiert bis Fehler oder done.
func (p *PollingTransport) pollLoop() {
	consecutiveErrors := 0
	const maxConsecutiveErrors = 5

	for {
		select {
		case <-p.done:
			return
		default:
		}

		messages, err := p.poll()
		if err != nil {
			consecutiveErrors++
			p.logger.Printf("[POLL] Poll-Fehler (%d/%d): %v", consecutiveErrors, maxConsecutiveErrors, err)
			if consecutiveErrors >= maxConsecutiveErrors {
				p.logger.Println("[POLL] Zu viele aufeinanderfolgende Fehler, Verbindung wird als verloren betrachtet")
				return
			}
			// Kurze Pause vor erneutem Versuch
			time.Sleep(2 * time.Second)
			continue
		}

		consecutiveErrors = 0

		// Empfangene Nachrichten verarbeiten
		var ackIDs []int64
		for _, qm := range messages {
			p.handleMessage(qm.Message)
			if qm.ID > 0 {
				ackIDs = append(ackIDs, qm.ID)
			}
		}

		// Bestätigung senden
		if len(ackIDs) > 0 {
			p.ack(ackIDs)
		}
	}
}

// QueuedMessage ist eine Nachricht aus der Server-Queue mit ID.
type QueuedMessage struct {
	ID      int64   `json:"id"`
	Message Message `json:"message"`
}

// poll führt einen einzelnen Long-Poll-Request aus.
func (p *PollingTransport) poll() ([]QueuedMessage, error) {
	url := fmt.Sprintf("%s/api/agent/poll?timeout=%d", p.config.ServerHTTPURL, p.config.PollTimeout)
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("request erstellen: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+p.config.Token)

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HTTP-Fehler: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNoContent || resp.StatusCode == http.StatusGatewayTimeout {
		// Kein Event — normaler Timeout, sofort wieder pollen
		return nil, nil
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("server antwortete mit HTTP %d: %s", resp.StatusCode, string(body))
	}

	var messages []QueuedMessage
	if err := json.NewDecoder(resp.Body).Decode(&messages); err != nil {
		return nil, fmt.Errorf("antwort parsen: %w", err)
	}

	return messages, nil
}

// ack bestätigt den Empfang von Nachrichten via POST /api/agent/ack.
func (p *PollingTransport) ack(ids []int64) {
	payload := struct {
		MessageIDs []int64 `json:"message_ids"`
	}{MessageIDs: ids}

	data, err := json.Marshal(payload)
	if err != nil {
		p.logger.Printf("[POLL] Fehler beim Serialisieren der ACK: %v", err)
		return
	}

	url := fmt.Sprintf("%s/api/agent/ack", p.config.ServerHTTPURL)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(data))
	if err != nil {
		p.logger.Printf("[POLL] Fehler beim Erstellen des ACK-Requests: %v", err)
		return
	}
	req.Header.Set("Authorization", "Bearer "+p.config.Token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		p.logger.Printf("[POLL] Fehler beim Senden der ACK: %v", err)
		return
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)
}

func (p *PollingTransport) handleMessage(msg Message) {
	switch msg.Type {
	case MessageTypeTransferRequest:
		var req TransferRequest
		if err := json.Unmarshal(msg.Data, &req); err != nil {
			p.logger.Printf("[POLL] Fehler beim Parsen der Transfer-Anfrage: %v", err)
			return
		}
		if p.transferHandler != nil {
			if err := p.transferHandler.StartTransfer(req); err != nil {
				p.logger.Printf("[POLL] Fehler beim Starten des Transfers: %v", err)
				errorData := struct {
					TransferID string `json:"transfer_id"`
					Error      string `json:"error"`
				}{TransferID: req.Transfer.ID, Error: err.Error()}
				data, _ := json.Marshal(errorData)
				p.SendMessage(Message{Type: MessageTypeTransferError, Data: data})
			}
		}

	case MessageTypeCancelTransfer:
		var cancel struct {
			TransferID string `json:"transfer_id"`
		}
		if err := json.Unmarshal(msg.Data, &cancel); err != nil {
			p.logger.Printf("[POLL] Fehler beim Parsen der Cancel-Nachricht: %v", err)
			return
		}
		if p.transferHandler != nil {
			p.transferHandler.CancelTransfer(cancel.TransferID)
		}

	case MessageTypeConnectionTest:
		p.SendMessage(Message{
			Type: MessageTypeConnectionTestResponse,
			Data: msg.Data,
		})

	default:
		p.logger.Printf("[POLL] Unbekannter Nachrichtentyp: %s", msg.Type)
	}
}

// --- ProgressReporter Implementierung ---

// SendTransferProgress meldet den Transfer-Fortschritt an den Server.
func (p *PollingTransport) SendTransferProgress(transferID string, progress float64, currentBytes, totalBytes int64) {
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
	p.SendMessage(Message{Type: MessageTypeTransferProgress, Data: data})
}

// SendTransferComplete meldet den erfolgreichen Abschluss eines Transfers.
func (p *PollingTransport) SendTransferComplete(transferID string, duration time.Duration) {
	completeData := struct {
		TransferID string `json:"transfer_id"`
		Duration   int64  `json:"duration"`
	}{
		TransferID: transferID,
		Duration:   duration.Milliseconds(),
	}
	data, _ := json.Marshal(completeData)
	p.SendMessage(Message{Type: MessageTypeTransferComplete, Data: data})
}

// SendTransferError meldet einen Transfer-Fehler an den Server.
func (p *PollingTransport) SendTransferError(transferID string, errMsg string) {
	errorData := struct {
		TransferID string `json:"transfer_id"`
		Error      string `json:"error"`
	}{
		TransferID: transferID,
		Error:      errMsg,
	}
	data, _ := json.Marshal(errorData)
	p.SendMessage(Message{Type: MessageTypeTransferError, Data: data})
}
