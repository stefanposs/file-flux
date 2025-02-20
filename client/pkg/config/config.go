package config

import (
	"os"

	"gopkg.in/yaml.v2"
)

type Config struct {
	ServerURL   string `yaml:"server_url"`
	UploadDir   string `yaml:"upload_dir"`
	DownloadDir string `yaml:"download_dir"`
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
