package config

import (
	"log"
	"os"

	"gopkg.in/yaml.v3"
)

type Job struct {
	ID            string `yaml:"id"`
	UploadToken   string `yaml:"uploadToken"`
	DownloadToken string `yaml:"downloadToken"`
}

type Config struct {
	Port           string `yaml:"port"`
	FileUploadPath string `yaml:"fileUploadPath"`
	LogLevel       string `yaml:"logLevel"`
	Jobs           []Job  `yaml:"jobs"`
}

func LoadConfig() *Config {
	data, err := os.ReadFile("config.yml")
	if err != nil {
		log.Fatalf("Error reading config.yml: %v", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		log.Fatalf("Error parsing config.yml: %v", err)
	}

	return &cfg
}
