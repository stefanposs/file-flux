package config

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"

	"gopkg.in/yaml.v2"
)

// Config repräsentiert die Hauptkonfiguration des Agenten
type Config struct {
	Agent      AgentConfig      `yaml:"agent"`
	Connection ConnectionConfig `yaml:"connection"`
	Transfers  TransferConfig   `yaml:"transfers"`
	Logging    LoggingConfig    `yaml:"logging"`
}

// AgentConfig enthält die Agenten-spezifischen Einstellungen
type AgentConfig struct {
	ID          string `yaml:"id"`
	Name        string `yaml:"name"`
	Type        string `yaml:"type"`
	Description string `yaml:"description"`
}

// ConnectionConfig enthält die Verbindungseinstellungen
type ConnectionConfig struct {
	ServerURL         string `yaml:"server_url"`
	ServerHTTPURL     string `yaml:"server_http_url"`
	Token             string `yaml:"token"`
	HeartbeatInterval int    `yaml:"heartbeat_interval"`
	ReconnectAttempts int    `yaml:"reconnect_attempts"`
	ReconnectDelay    int    `yaml:"reconnect_delay"`
}

// TransferConfig enthält die Transfereinstellungen
type TransferConfig struct {
	ChunkSize           int    `yaml:"chunk_size"`
	ConcurrentTransfers int    `yaml:"concurrent_transfers"`
	Compression         bool   `yaml:"compression"`
	TempDir             string `yaml:"temp_dir"`
	BaseDir             string `yaml:"base_dir"`
}

// LoggingConfig enthält die Logging-Einstellungen
type LoggingConfig struct {
	Level      string `yaml:"level"`
	File       string `yaml:"file"`
	MaxSize    int    `yaml:"max_size"`
	MaxBackups int    `yaml:"max_backups"`
	MaxAge     int    `yaml:"max_age"`
}

// DefaultConfig gibt eine Standardkonfiguration zurück
func DefaultConfig() *Config {
	// Plattformspezifische Standardwerte
	tempDir := os.TempDir()
	baseDir := "/data"

	if runtime.GOOS == "windows" {
		// Windows-spezifische Pfade
		baseDir = "C:\\FileFlux\\Data"
		tempDir = filepath.Join(tempDir, "FileFlux")
	} else {
		// Unix-spezifische Pfade
		baseDir = "/var/lib/fileflux/data"
		tempDir = "/tmp/fileflux"
	}

	return &Config{
		Agent: AgentConfig{
			ID:   "",
			Name: "FileFlux-Agent",
			Type: "client",
		},
		Connection: ConnectionConfig{
			ServerURL:         "ws://localhost:3002/ws/agent",
			ServerHTTPURL:     "http://localhost:3001",
			Token:             "",
			HeartbeatInterval: 60,
			ReconnectAttempts: 5,
			ReconnectDelay:    10,
		},
		Transfers: TransferConfig{
			ChunkSize:           8,
			ConcurrentTransfers: 3,
			Compression:         true,
			TempDir:             tempDir,
			BaseDir:             baseDir,
		},
		Logging: LoggingConfig{
			Level:      "info",
			File:       "fileflux-agent.log",
			MaxSize:    10,
			MaxBackups: 3,
			MaxAge:     7,
		},
	}
}

// LoadConfig lädt die Konfiguration aus einer YAML-Datei und Umgebungsvariablen
func LoadConfig(filePath string) (*Config, error) {
	// Standardkonfiguration
	config := DefaultConfig()

	// Datei lesen
	data, err := os.ReadFile(filePath)
	if err != nil {
		fmt.Printf("Warnung: Konfigurationsdatei %s konnte nicht gelesen werden: %v\n", filePath, err)
		fmt.Println("Verwende Standardkonfiguration und Umgebungsvariablen")
	} else {
		// YAML-Datei parsen
		if err := yaml.Unmarshal(data, config); err != nil {
			return nil, fmt.Errorf("fehler beim Parsen der Konfigurationsdatei: %v", err)
		}
	}

	// Umgebungsvariablen haben Vorrang
	loadFromEnv(config)

	return config, nil
}

// loadFromEnv lädt Konfigurationswerte aus Umgebungsvariablen
func loadFromEnv(config *Config) {
	// Agent
	if id := os.Getenv("AGENT_ID"); id != "" {
		config.Agent.ID = id
	}
	if name := os.Getenv("AGENT_NAME"); name != "" {
		config.Agent.Name = name
	}
	if typ := os.Getenv("AGENT_TYPE"); typ != "" {
		config.Agent.Type = typ
	}
	if desc := os.Getenv("AGENT_DESCRIPTION"); desc != "" {
		config.Agent.Description = desc
	}

	// Connection
	if url := os.Getenv("CONNECTION_SERVER_URL"); url != "" {
		config.Connection.ServerURL = url
	}
	if token := os.Getenv("CONNECTION_TOKEN"); token != "" {
		config.Connection.Token = token
	}
	if httpURL := os.Getenv("CONNECTION_HTTP_URL"); httpURL != "" {
		config.Connection.ServerHTTPURL = httpURL
	}

	// Weitere Umgebungsvariablen...
}
