// Package transfer implementiert den Transfer-Manager für den Agenten.
package transfer

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sync"

	"github.com/stefanposs/file-flux/agent/internal/config"
	"github.com/stefanposs/file-flux/agent/internal/websocket"
)

// Manager verwaltet aktive Dateitransfers.
type Manager struct {
	logger    *log.Logger
	config    config.TransferConfig
	active    map[string]*activeTransfer
	activeMu  sync.Mutex
	progressFn func(transferID string, progress float64)
}

type activeTransfer struct {
	id       string
	cancel   chan struct{}
	done     chan struct{}
}

// NewManager erstellt einen neuen Transfer-Manager.
func NewManager(logger *log.Logger, cfg config.TransferConfig) *Manager {
	// Verzeichnisse sicherstellen
	os.MkdirAll(cfg.TempDir, 0o755)
	os.MkdirAll(cfg.BaseDir, 0o755)

	return &Manager{
		logger: logger,
		config: cfg,
		active: make(map[string]*activeTransfer),
	}
}

// StartTransfer startet einen neuen Transfer gemäß der Server-Anfrage.
func (m *Manager) StartTransfer(request websocket.TransferRequest) error {
	t := request.Transfer

	m.activeMu.Lock()
	if _, exists := m.active[t.ID]; exists {
		m.activeMu.Unlock()
		return fmt.Errorf("transfer %s läuft bereits", t.ID)
	}

	at := &activeTransfer{
		id:     t.ID,
		cancel: make(chan struct{}),
		done:   make(chan struct{}),
	}
	m.active[t.ID] = at
	m.activeMu.Unlock()

	go func() {
		defer func() {
			close(at.done)
			m.activeMu.Lock()
			delete(m.active, t.ID)
			m.activeMu.Unlock()
		}()

		var err error
		switch t.TransferType {
		case "upload":
			err = m.executeUpload(at, t.SourcePath, t.DestinationPath)
		case "download":
			err = m.executeDownload(at, t.SourcePath, t.DestinationPath)
		default:
			err = fmt.Errorf("unbekannter Transfer-Typ: %s", t.TransferType)
		}

		if err != nil {
			m.logger.Printf("Transfer %s fehlgeschlagen: %v", t.ID, err)
		} else {
			m.logger.Printf("Transfer %s abgeschlossen", t.ID)
		}
	}()

	m.logger.Printf("Transfer %s gestartet (Typ: %s, Quelle: %s, Ziel: %s)", t.ID, t.TransferType, t.SourcePath, t.DestinationPath)
	return nil
}

// CancelTransfer bricht einen laufenden Transfer ab.
func (m *Manager) CancelTransfer(transferID string) error {
	m.activeMu.Lock()
	at, ok := m.active[transferID]
	m.activeMu.Unlock()

	if !ok {
		return fmt.Errorf("transfer %s nicht gefunden", transferID)
	}

	close(at.cancel)
	<-at.done
	m.logger.Printf("Transfer %s abgebrochen", transferID)
	return nil
}

// StopAll stoppt alle laufenden Transfers.
func (m *Manager) StopAll() {
	m.activeMu.Lock()
	transfers := make([]*activeTransfer, 0, len(m.active))
	for _, at := range m.active {
		transfers = append(transfers, at)
	}
	m.activeMu.Unlock()

	for _, at := range transfers {
		select {
		case <-at.cancel:
			// Bereits abgebrochen
		default:
			close(at.cancel)
		}
		<-at.done
	}
	m.logger.Println("Alle Transfers gestoppt")
}

// executeUpload liest eine lokale Datei und schreibt sie in das Zielverzeichnis.
func (m *Manager) executeUpload(at *activeTransfer, srcPath, dstPath string) error {
	src, err := os.Open(filepath.Join(m.config.BaseDir, srcPath))
	if err != nil {
		return fmt.Errorf("quell-Datei öffnen: %w", err)
	}
	defer src.Close()

	dstFull := filepath.Join(m.config.TempDir, dstPath)
	os.MkdirAll(filepath.Dir(dstFull), 0o755)

	dst, err := os.Create(dstFull)
	if err != nil {
		return fmt.Errorf("ziel-Datei erstellen: %w", err)
	}
	defer dst.Close()

	chunkSize := int64(m.config.ChunkSize) * 1024 * 1024 // MB
	if chunkSize <= 0 {
		chunkSize = 8 * 1024 * 1024
	}

	buf := make([]byte, chunkSize)
	for {
		select {
		case <-at.cancel:
			os.Remove(dstFull)
			return fmt.Errorf("transfer abgebrochen")
		default:
		}

		n, err := src.Read(buf)
		if n > 0 {
			if _, wErr := dst.Write(buf[:n]); wErr != nil {
				return fmt.Errorf("schreiben fehlgeschlagen: %w", wErr)
			}
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("lesen fehlgeschlagen: %w", err)
		}
	}

	return nil
}

// executeDownload schreibt empfangene Daten in eine lokale Datei.
func (m *Manager) executeDownload(at *activeTransfer, srcPath, dstPath string) error {
	// Download = Datei vom Server empfangen und lokal speichern
	// Vorerst analog Upload implementiert (lokale Kopie)
	return m.executeUpload(at, srcPath, dstPath)
}
