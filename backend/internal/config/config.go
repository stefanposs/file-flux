package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v2"
)

// Config repräsentiert die Hauptkonfiguration der Anwendung
type Config struct {
	Server   ServerConfig   `yaml:"server"`
	Database DatabaseConfig `yaml:"database"`
	Auth     AuthConfig     `yaml:"auth"`
	Logging  LoggingConfig  `yaml:"logging"`
}

// ServerConfig enthält die Server-spezifischen Einstellungen
type ServerConfig struct {
	Port          int    `yaml:"port"`
	WebSocketPort int    `yaml:"websocket_port"`
	Host          string `yaml:"host"`
}

// DatabaseConfig enthält die Datenbankeinstellungen
type DatabaseConfig struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	User     string `yaml:"user"`
	Password string `yaml:"password"`
	Database string `yaml:"database"`
	SSLMode  string `yaml:"sslmode"`
}

// AuthConfig enthält die Authentifizierungseinstellungen
type AuthConfig struct {
	JWTSecret      string `yaml:"jwt_secret"`
	TokenExpiresIn int    `yaml:"token_expires_in"` // in Stunden
}

// LoggingConfig enthält die Logging-Einstellungen
type LoggingConfig struct {
	Level string `yaml:"level"`
	File  string `yaml:"file"`
}

// LoadConfig lädt die Konfiguration aus einer YAML-Datei
func LoadConfig(filePath string) (*Config, error) {
	// Standardkonfiguration
	config := &Config{
		Server: ServerConfig{
			Port:          3001,
			WebSocketPort: 3002,
			Host:          "localhost",
		},
		Database: DatabaseConfig{
			Host:     "localhost",
			Port:     5432,
			User:     "fileflux",
			Password: "fileflux",
			Database: "fileflux",
			SSLMode:  "disable",
		},
		Auth: AuthConfig{
			JWTSecret:      "fileflux-secret-key",
			TokenExpiresIn: 24,
		},
		Logging: LoggingConfig{
			Level: "info",
			File:  "fileflux.log",
		},
	}

	// Datei lesen
	data, err := os.ReadFile(filePath)
	if err != nil {
		// Fallback: Verwende Umgebungsvariablen, wenn Datei nicht gelesen werden kann
		loadFromEnv(config)
		return config, nil
	}

	// YAML-Datei parsen
	if err := yaml.Unmarshal(data, config); err != nil {
		return nil, fmt.Errorf("fehler beim Parsen der Konfigurationsdatei: %v", err)
	}

	// Umgebungsvariablen haben Vorrang
	loadFromEnv(config)

	return config, nil
}

// loadFromEnv lädt Konfigurationswerte aus Umgebungsvariablen
func loadFromEnv(config *Config) {
	// Server
	if port := os.Getenv("SERVER_PORT"); port != "" {
		fmt.Sscanf(port, "%d", &config.Server.Port)
	}
	if wsPort := os.Getenv("WEBSOCKET_PORT"); wsPort != "" {
		fmt.Sscanf(wsPort, "%d", &config.Server.WebSocketPort)
	}
	if host := os.Getenv("SERVER_HOST"); host != "" {
		config.Server.Host = host
	}

	// Datenbank
	if dbHost := os.Getenv("DB_HOST"); dbHost != "" {
		config.Database.Host = dbHost
	}
	if dbPort := os.Getenv("DB_PORT"); dbPort != "" {
		fmt.Sscanf(dbPort, "%d", &config.Database.Port)
	}
	if dbUser := os.Getenv("DB_USER"); dbUser != "" {
		config.Database.User = dbUser
	}
	if dbPass := os.Getenv("DB_PASSWORD"); dbPass != "" {
		config.Database.Password = dbPass
	}
	if dbName := os.Getenv("DB_NAME"); dbName != "" {
		config.Database.Database = dbName
	}
	if dbSSL := os.Getenv("DB_SSLMODE"); dbSSL != "" {
		config.Database.SSLMode = dbSSL
	}

	// Auth
	if jwtSecret := os.Getenv("JWT_SECRET"); jwtSecret != "" {
		config.Auth.JWTSecret = jwtSecret
	}
	if tokenExp := os.Getenv("TOKEN_EXPIRES_IN"); tokenExp != "" {
		fmt.Sscanf(tokenExp, "%d", &config.Auth.TokenExpiresIn)
	}

	// Logging
	if logLevel := os.Getenv("LOG_LEVEL"); logLevel != "" {
		config.Logging.Level = logLevel
	}
	if logFile := os.Getenv("LOG_FILE"); logFile != "" {
		config.Logging.File = logFile
	}
}
