package config

import (
	"log"
	"os"
)

type Config struct {
	Port           string
	FileUploadPath string
	LogLevel       string
}

func LoadConfig() *Config {
	return &Config{
		Port:           getEnv("PORT", "8080"),
		FileUploadPath: getEnv("FILE_UPLOAD_PATH", "./uploads"),
		LogLevel:       getEnv("LOG_LEVEL", "info"),
	}
}

func getEnv(key, fallback string) string {
	value, exists := os.LookupEnv(key)
	if !exists {
		log.Printf("Environment variable %s not set, using default: %s", key, fallback)
		return fallback
	}
	return value
}
