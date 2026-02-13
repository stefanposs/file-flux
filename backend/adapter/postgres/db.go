// Package postgres implementiert die Repository-Interfaces mit PostgreSQL.
package postgres

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "github.com/lib/pq"
)

// DB kapselt die PostgreSQL-Datenbankverbindung.
type DB struct {
	Pool *sql.DB
}

// Config enthaelt die Datenbank-Konfiguration.
type Config struct {
	Host     string
	Port     int
	User     string
	Password string
	Database string
	SSLMode  string
}

// New erstellt eine neue Datenbankverbindung.
func New(cfg Config) (*DB, error) {
	connStr := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.Database, cfg.SSLMode,
	)

	pool, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("db open: %w", err)
	}

	pool.SetMaxOpenConns(25)
	pool.SetMaxIdleConns(5)
	pool.SetConnMaxLifetime(5 * time.Minute)

	if err := pool.Ping(); err != nil {
		return nil, fmt.Errorf("db ping: %w", err)
	}

	return &DB{Pool: pool}, nil
}

// Close schliesst die Datenbankverbindung.
func (db *DB) Close() error {
	return db.Pool.Close()
}

// Migrate fuehrt das Schema-SQL aus.
func (db *DB) Migrate() error {
	schemaPath := filepath.Join("internal", "db", "schema.sql")
	schema, err := os.ReadFile(schemaPath)
	if err != nil {
		return fmt.Errorf("schema read: %w", err)
	}
	_, err = db.Pool.Exec(string(schema))
	if err != nil {
		return fmt.Errorf("schema exec: %w", err)
	}
	return nil
}
