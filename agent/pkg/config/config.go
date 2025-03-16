package config

import (
	"os"

	"gopkg.in/yaml.v2"
)

// ClientJob definiert einen einzelnen Job inklusive eigener Ordner und Tokens.
type ClientJob struct {
	JobID         string `yaml:"job_id"`
	UploadDir     string `yaml:"upload_dir"`
	DownloadDir   string `yaml:"download_dir"`
	UploadToken   string `yaml:"upload_token"`
	DownloadToken string `yaml:"download_token"`
}

// Config enthält die allgemeine Server-URL und eine Liste von Jobs.
type Config struct {
	ServerURL string      `yaml:"server_url"`
	Jobs      []ClientJob `yaml:"jobs"`
}

func LoadConfig(configPath string) (*Config, error) {
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, err
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}

	return &cfg, nil
}
