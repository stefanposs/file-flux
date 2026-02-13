// Package transfer implementiert den Transfer-Manager für den Agenten.
package transfer

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/stefanposs/file-flux/agent/internal/api"
	"github.com/stefanposs/file-flux/agent/internal/config"
	"github.com/stefanposs/file-flux/agent/internal/websocket"
)

// ProgressReporter sendet Fortschritts- und Fertigmeldungen an den Server.
type ProgressReporter interface {
	SendTransferProgress(transferID string, progress float64, currentBytes, totalBytes int64)
	SendTransferComplete(transferID string, duration time.Duration)
	SendTransferError(transferID string, errMsg string)
}

// Manager verwaltet aktive Dateitransfers.
type Manager struct {
	logger     *log.Logger
	config     config.TransferConfig
	active     map[string]*activeTransfer
	activeMu   sync.Mutex
	apiClient  *api.Client
	reporter   ProgressReporter
}

type activeTransfer struct {
	id       string
	cancel   chan struct{}
	done     chan struct{}
}

// NewManager erstellt einen neuen Transfer-Manager.
func NewManager(logger *log.Logger, cfg config.TransferConfig, apiClient *api.Client) *Manager {
	// Verzeichnisse sicherstellen
	os.MkdirAll(cfg.TempDir, 0o755)
	os.MkdirAll(cfg.BaseDir, 0o755)

	return &Manager{
		logger:    logger,
		config:    cfg,
		active:    make(map[string]*activeTransfer),
		apiClient: apiClient,
	}
}

// SetReporter setzt den ProgressReporter (WebSocket-Client).
func (m *Manager) SetReporter(r ProgressReporter) {
	m.reporter = r
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

		start := time.Now()
		var err error
		switch t.TransferType {
		case "upload":
			err = m.executeUpload(at, t.ID, t.SourcePath, t.DestinationPath)
		case "download":
			err = m.executeDownload(at, t.ID, t.SourcePath, t.DestinationPath)
		default:
			err = fmt.Errorf("unbekannter Transfer-Typ: %s", t.TransferType)
		}

		if err != nil {
			m.logger.Printf("Transfer %s fehlgeschlagen: %v", t.ID, err)
			if m.reporter != nil {
				m.reporter.SendTransferError(t.ID, err.Error())
			}
		} else {
			m.logger.Printf("Transfer %s abgeschlossen", t.ID)
			if m.reporter != nil {
				m.reporter.SendTransferComplete(t.ID, time.Since(start))
			}
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
		default:
			close(at.cancel)
		}
		<-at.done
	}
	m.logger.Println("Alle Transfers gestoppt")
}

// executeUpload liest eine lokale Datei und sendet sie per HTTP an den Server.
func (m *Manager) executeUpload(at *activeTransfer, transferID, srcPath, dstPath string) error {
	fullPath := srcPath
	if !filepath.IsAbs(srcPath) {
		fullPath = filepath.Join(m.config.BaseDir, srcPath)
	}
	src, err := os.Open(fullPath)
	if err != nil {
		return fmt.Errorf("quell-Datei öffnen: %w", err)
	}
	defer src.Close()

	stat, err := src.Stat()
	if err != nil {
		return fmt.Errorf("datei-Info lesen: %w", err)
	}

	totalBytes := stat.Size()
	filename := filepath.Base(srcPath)

	// Progress-Wrapper um den Reader
	pr := &progressReader{
		reader:     src,
		total:      totalBytes,
		transferID: transferID,
		reporter:   m.reporter,
		cancel:     at.cancel,
	}

	// Datei per HTTP an den Server senden
	if m.apiClient != nil {
		_, err = m.apiClient.UploadFile(transferID, filename, pr)
	} else {
		// Fallback: lokale Kopie (fuer Tests ohne Server)
		err = m.localCopy(at, fullPath, filepath.Join(m.config.TempDir, dstPath))
	}

	return err
}

// executeDownload laedt eine Datei vom Server und speichert sie lokal.
func (m *Manager) executeDownload(at *activeTransfer, transferID, srcPath, dstPath string) error {
	fullPath := dstPath
	if !filepath.IsAbs(dstPath) {
		fullPath = filepath.Join(m.config.BaseDir, dstPath)
	}
	os.MkdirAll(filepath.Dir(fullPath), 0o755)

	dst, err := os.Create(fullPath)
	if err != nil {
		return fmt.Errorf("ziel-Datei erstellen: %w", err)
	}
	defer dst.Close()

	if m.apiClient != nil {
		_, err = m.apiClient.DownloadFile(transferID, dst)
	} else {
		// Fallback: lokale Kopie
		err = m.localCopy(at, filepath.Join(m.config.BaseDir, srcPath), fullPath)
	}

	return err
}

// localCopy fuehrt eine lokale Dateikopie aus (Fallback).
func (m *Manager) localCopy(at *activeTransfer, srcPath, dstPath string) error {
	src, err := os.Open(srcPath)
	if err != nil {
		return fmt.Errorf("quell-Datei öffnen: %w", err)
	}
	defer src.Close()

	os.MkdirAll(filepath.Dir(dstPath), 0o755)
	dst, err := os.Create(dstPath)
	if err != nil {
		return fmt.Errorf("ziel-Datei erstellen: %w", err)
	}
	defer dst.Close()

	buf := make([]byte, 8*1024*1024)
	for {
		select {
		case <-at.cancel:
			os.Remove(dstPath)
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

// progressReader wraps an io.Reader and reports progress.
type progressReader struct {
	reader     io.Reader
	total      int64
	read       int64
	transferID string
	reporter   ProgressReporter
	cancel     chan struct{}
	lastReport time.Time
}

func (pr *progressReader) Read(p []byte) (int, error) {
	select {
	case <-pr.cancel:
		return 0, fmt.Errorf("transfer abgebrochen")
	default:
	}

	n, err := pr.reader.Read(p)
	pr.read += int64(n)

	// Fortschritt alle 500ms melden
	if pr.reporter != nil && time.Since(pr.lastReport) > 500*time.Millisecond && pr.total > 0 {
		progress := float64(pr.read) / float64(pr.total)
		pr.reporter.SendTransferProgress(pr.transferID, progress, pr.read, pr.total)
		pr.lastReport = time.Now()
	}

	return n, err
}
