package config

import (
	"os"
)

// Config enthält alle Konfigurationsparameter
type Config struct {
	ServerPort          string
	DatabaseURL         string
	Auth0Domain         string
	Auth0Audience       string
	StripeSecretKey     string
	StripeWebhookSecret string
	Environment         string
}

// GetEnv gibt den Wert einer Umgebungsvariable zurück oder den Standardwert
func GetEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

// LoadConfig lädt Konfiguration aus Umgebungsvariablen
func LoadConfig() *Config {
	return &Config{
		ServerPort:          GetEnv("SERVER_PORT", "8080"),
		DatabaseURL:         GetEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/fileflux?sslmode=disable"),
		Auth0Domain:         GetEnv("AUTH0_DOMAIN", ""),
		Auth0Audience:       GetEnv("AUTH0_AUDIENCE", ""),
		StripeSecretKey:     GetEnv("STRIPE_SECRET_KEY", ""),
		StripeWebhookSecret: GetEnv("STRIPE_WEBHOOK_SECRET", ""),
		Environment:         GetEnv("ENV", "development"),
	}
}
