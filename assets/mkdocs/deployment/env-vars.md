---
title: "Environment Variables"
weight: 4
---
# Environment Variables

Complete reference of all environment variables for FileFlux components.

## Backend

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_HOST` | `0.0.0.0` | Bind address |
| `SERVER_PORT` | `3001` | HTTP API port |
| `SERVER_WS_PORT` | `3002` | WebSocket port |
| `SERVER_READ_TIMEOUT` | `30s` | HTTP read timeout |
| `SERVER_WRITE_TIMEOUT` | `30s` | HTTP write timeout |
| `SERVER_TIMEZONE` | `UTC` | Timezone for scheduling |
| `LOG_LEVEL` | `info` | Logging level |
| `LOG_FORMAT` | `json` | Log format (`json`, `text`) |

### Database

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `fileflux` | Database user |
| `DB_PASSWORD` | `fileflux` | Database password |
| `DB_NAME` | `fileflux` | Database name |
| `DB_SSLMODE` | `disable` | SSL mode |
| `DB_MAX_OPEN_CONNS` | `25` | Max open connections |
| `DB_MAX_IDLE_CONNS` | `5` | Max idle connections |
| `DB_CONN_MAX_LIFETIME` | `5m` | Connection max lifetime |

### Security

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | *(required)* | JWT signing secret |
| `JWT_EXPIRY` | `24h` | Token expiry |
| `BCRYPT_COST` | `12` | Password hash cost |
| `CORS_ORIGINS` | `*` | Allowed CORS origins |

### Transfers

| Variable | Default | Description |
|----------|---------|-------------|
| `TRANSFER_CHUNK_SIZE` | `1048576` | Chunk size (bytes) |
| `TRANSFER_MAX_RETRIES` | `3` | Max retry attempts |
| `TRANSFER_TIMEOUT` | `30m` | Transfer timeout |
| `TRANSFER_TEMP_DIR` | `/tmp/fileflux` | Temp chunk storage |

### Admin

| Variable | Default | Description |
|----------|---------|-------------|
| `INITIAL_ADMIN_EMAIL` | `admin@fileflux.de` | Initial admin email |
| `INITIAL_ADMIN_PASSWORD` | `admin123` | Initial admin password |

---

## Agent

| Variable | Default | Description |
|----------|---------|-------------|
| `FILEFLUX_SERVER_URL` | `ws://localhost:3002/ws` | Backend WebSocket URL |
| `FILEFLUX_AGENT_TOKEN` | *(required)* | Agent registration token |
| `FILEFLUX_AGENT_NAME` | hostname | Agent display name |
| `FILEFLUX_WORK_DIR` | `/var/lib/fileflux` | Working directory |
| `FILEFLUX_UPLOAD_DIR` | `$WORK_DIR/uploads` | Upload staging dir |
| `FILEFLUX_DOWNLOAD_DIR` | `$WORK_DIR/downloads` | Download target dir |
| `FILEFLUX_CHUNK_SIZE` | `1048576` | Chunk size (bytes) |
| `FILEFLUX_MAX_CONCURRENT` | `4` | Max parallel transfers |
| `FILEFLUX_LOG_LEVEL` | `info` | Log level |
| `FILEFLUX_LOG_FORMAT` | `json` | Log format |

---

## Docker Compose

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_USER` | `fileflux` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `fileflux` | PostgreSQL password |
| `POSTGRES_DB` | `fileflux` | Database name |
| `COMPOSE_PROJECT_NAME` | `file-flux` | Docker Compose project |
