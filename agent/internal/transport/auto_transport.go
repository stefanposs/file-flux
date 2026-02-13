package transport

import (
	"fmt"
	"log"
	"sync"
	"time"
)

// AutoConfig enthält die Konfiguration für den Auto-Transport.
type AutoConfig struct {
	// Transport-Modus: "auto" (default), "websocket", "polling"
	TransportMode string

	// WebSocket-Parameter
	WS WSConfig

	// HTTP Long-Polling-Parameter
	Polling PollingConfig

	// Wie oft im Polling-Modus geprüft wird, ob WS wieder verfügbar ist (Sekunden).
	WSProbeInterval int
}

// AutoTransport versucht zuerst WebSocket und fällt bei Fehler
// automatisch auf HTTP Long-Polling zurück. Periodisch wird geprüft
// ob WebSocket wieder verfügbar ist (Upgrade zurück).
type AutoTransport struct {
	config          AutoConfig
	logger          *log.Logger
	sysInfo         *SystemInfo
	transferHandler TransferHandler

	// Aktiver Transport
	active   Transport
	activeMu sync.RWMutex
	done     chan struct{}
}

// NewAutoTransport erstellt einen neuen Auto-Transport.
func NewAutoTransport(cfg AutoConfig, logger *log.Logger, sysInfo *SystemInfo) *AutoTransport {
	if cfg.TransportMode == "" {
		cfg.TransportMode = "auto"
	}
	if cfg.WSProbeInterval <= 0 {
		cfg.WSProbeInterval = 300 // 5 Minuten
	}
	return &AutoTransport{
		config:  cfg,
		logger:  logger,
		sysInfo: sysInfo,
		done:    make(chan struct{}),
	}
}

// SetTransferHandler setzt den Transfer-Handler für eingehende Befehle.
func (a *AutoTransport) SetTransferHandler(handler TransferHandler) {
	a.transferHandler = handler
}

// Connect stellt die Verbindung her. Blockiert und versucht unbegrenzt.
func (a *AutoTransport) Connect() error {
	switch a.config.TransportMode {
	case "websocket":
		return a.connectWebSocket()
	case "polling":
		return a.connectPolling()
	default: // "auto"
		return a.connectAuto()
	}
}

// Disconnect trennt den aktiven Transport.
func (a *AutoTransport) Disconnect() {
	select {
	case <-a.done:
	default:
		close(a.done)
	}

	a.activeMu.RLock()
	t := a.active
	a.activeMu.RUnlock()
	if t != nil {
		t.Disconnect()
	}
}

// SendMessage sendet eine Nachricht über den aktiven Transport.
func (a *AutoTransport) SendMessage(msg Message) {
	a.activeMu.RLock()
	t := a.active
	a.activeMu.RUnlock()
	if t != nil {
		t.SendMessage(msg)
	}
}

// IsConnected gibt zurück ob der aktive Transport verbunden ist.
func (a *AutoTransport) IsConnected() bool {
	a.activeMu.RLock()
	t := a.active
	a.activeMu.RUnlock()
	if t != nil {
		return t.IsConnected()
	}
	return false
}

// Mode gibt den aktuellen Transport-Modus zurück.
func (a *AutoTransport) Mode() Mode {
	a.activeMu.RLock()
	t := a.active
	a.activeMu.RUnlock()
	if t != nil {
		return t.Mode()
	}
	return ""
}

// ActiveTransport gibt den aktiven Transport zurück (für ProgressReporter-Cast).
func (a *AutoTransport) ActiveTransport() Transport {
	a.activeMu.RLock()
	defer a.activeMu.RUnlock()
	return a.active
}

// --- ProgressReporter Implementierung ---
// Leitet an den aktiven Transport weiter.

func (a *AutoTransport) SendTransferProgress(transferID string, progress float64, currentBytes, totalBytes int64) {
	a.activeMu.RLock()
	t := a.active
	a.activeMu.RUnlock()
	if t == nil {
		return
	}
	// Typ-Assertion: Beide Transports implementieren ProgressReporter
	if pr, ok := t.(ProgressReporter); ok {
		pr.SendTransferProgress(transferID, progress, currentBytes, totalBytes)
	}
}

func (a *AutoTransport) SendTransferComplete(transferID string, duration time.Duration) {
	a.activeMu.RLock()
	t := a.active
	a.activeMu.RUnlock()
	if t == nil {
		return
	}
	if pr, ok := t.(ProgressReporter); ok {
		pr.SendTransferComplete(transferID, duration)
	}
}

func (a *AutoTransport) SendTransferError(transferID string, errMsg string) {
	a.activeMu.RLock()
	t := a.active
	a.activeMu.RUnlock()
	if t == nil {
		return
	}
	if pr, ok := t.(ProgressReporter); ok {
		pr.SendTransferError(transferID, errMsg)
	}
}

// --- interne Methoden ---

func (a *AutoTransport) connectWebSocket() error {
	ws := NewWSTransport(a.config.WS, a.logger, a.sysInfo)
	ws.SetTransferHandler(a.transferHandler)
	a.setActive(ws)
	return ws.Connect() // blockiert
}

func (a *AutoTransport) connectPolling() error {
	poll := NewPollingTransport(a.config.Polling, a.logger, a.sysInfo)
	poll.SetTransferHandler(a.transferHandler)
	a.setActive(poll)
	return poll.Connect() // blockiert
}

func (a *AutoTransport) connectAuto() error {
	for {
		select {
		case <-a.done:
			return fmt.Errorf("transport wurde gestoppt")
		default:
		}

		// Phase 1: Versuche WebSocket (max 3 Versuche, kurzer Backoff)
		a.logger.Println("[AUTO] Versuche WebSocket-Verbindung...")
		ws := NewWSTransport(a.config.WS, a.logger, a.sysInfo)
		ws.SetTransferHandler(a.transferHandler)

		wsSuccess := false
		for i := 0; i < 3; i++ {
			select {
			case <-a.done:
				return fmt.Errorf("transport wurde gestoppt")
			default:
			}

			if err := ws.TryConnect(); err != nil {
				a.logger.Printf("[AUTO] WebSocket-Versuch %d/3 fehlgeschlagen: %v", i+1, err)
				if i < 2 {
					time.Sleep(2 * time.Second)
				}
				continue
			}

			wsSuccess = true
			break
		}

		if wsSuccess {
			a.logger.Println("[AUTO] WebSocket-Verbindung hergestellt")
			a.setActive(ws)

			// Warte bis Verbindung verloren geht
			a.waitForDisconnect(ws)
			a.logger.Println("[AUTO] WebSocket-Verbindung verloren, starte Fallback-Logik...")
			continue // Nächste Iteration: versuche wieder WS zuerst
		}

		// Phase 2: WebSocket fehlgeschlagen → Fallback auf Polling
		a.logger.Println("[AUTO] WebSocket nicht verfügbar, wechsle auf HTTP Long-Polling...")

		poll := NewPollingTransport(a.config.Polling, a.logger, a.sysInfo)
		poll.SetTransferHandler(a.transferHandler)
		a.setActive(poll)

		// Starte Polling in eigener Goroutine
		pollDone := make(chan struct{})
		go func() {
			defer close(pollDone)
			poll.Connect()
		}()

		// Starte WS-Probe: periodisch prüfen ob WS wieder geht
		probeInterval := time.Duration(a.config.WSProbeInterval) * time.Second
		a.logger.Printf("[AUTO] HTTP Long-Polling aktiv, nächster WebSocket-Probe in %v", probeInterval)

		probeTicker := time.NewTicker(probeInterval)
		defer probeTicker.Stop()

	probeLoop:
		for {
			select {
			case <-a.done:
				poll.Disconnect()
				return fmt.Errorf("transport wurde gestoppt")

			case <-pollDone:
				// Polling-Verbindung verloren
				a.logger.Println("[AUTO] Polling-Verbindung verloren")
				break probeLoop

			case <-probeTicker.C:
				// Versuche WebSocket-Upgrade
				a.logger.Println("[AUTO] Probe: Teste ob WebSocket wieder verfügbar ist...")
				probeWS := NewWSTransport(a.config.WS, a.logger, a.sysInfo)
				probeWS.SetTransferHandler(a.transferHandler)

				if err := probeWS.TryConnect(); err != nil {
					a.logger.Printf("[AUTO] WebSocket noch nicht verfügbar: %v", err)
					continue
				}

				// WS ist wieder da! Polling stoppen, auf WS wechseln
				a.logger.Println("[AUTO] WebSocket wieder verfügbar! Wechsle zurück von Polling...")
				poll.Disconnect()
				a.setActive(probeWS)

				// Warte bis WS-Verbindung wieder verloren geht
				a.waitForDisconnect(probeWS)
				a.logger.Println("[AUTO] WebSocket-Verbindung erneut verloren")
				break probeLoop
			}
		}

		probeTicker.Stop()
		// Nächste Iteration: versuche wieder WS zuerst
	}
}

func (a *AutoTransport) setActive(t Transport) {
	a.activeMu.Lock()
	a.active = t
	a.activeMu.Unlock()
}

func (a *AutoTransport) waitForDisconnect(t Transport) {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-a.done:
			return
		case <-ticker.C:
			if !t.IsConnected() {
				return
			}
		}
	}
}
