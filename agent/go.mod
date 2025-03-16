module github.com/stefanposs/file-flux/agent

go 1.21.0

require (
	github.com/fsnotify/fsnotify v1.6.0
	github.com/spf13/viper v1.16.0
	go.uber.org/zap v1.26.0
)

// weitere Abhängigkeiten werden automatisch durch go mod tidy hinzugefügt
