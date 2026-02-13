module github.com/stefanposs/file-flux/backend

go 1.22.0

require (
	github.com/golang-jwt/jwt/v5 v5.2.1
	github.com/gorilla/mux v1.8.1
	github.com/gorilla/websocket v1.5.3
	github.com/lib/pq v1.10.9
	golang.org/x/crypto v0.25.0
	gopkg.in/yaml.v2 v2.4.0
)

require github.com/robfig/cron/v3 v3.0.1 // indirect
