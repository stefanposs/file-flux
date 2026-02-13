---
title: "Docker"
weight: 2
---
# Docker

## Images

| Image | Description | Base |
|-------|-------------|------|
| `ghcr.io/stefanposs/file-flux/backend` | API + WebSocket server | `alpine:3.19` |
| `ghcr.io/stefanposs/file-flux/frontend` | Nginx serving static UI | `nginx:alpine` |
| `ghcr.io/stefanposs/file-flux/agent` | Endpoint agent | `alpine:3.19` |

## Docker Compose Services

```yaml
services:
  db:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    volumes: [postgres-data:/var/lib/postgresql/data]

  backend:
    build: ./backend
    ports: ["3001:3001", "3002:3002"]
    depends_on: [db]

  frontend:
    build: ./frontend
    ports: ["3000:80"]

  agent-central:
    build: ./agent
    depends_on: [backend]
```

## Building Images

```bash
# Build all images
just docker-build

# Build specific service
docker compose build backend
```

## Production Compose

Use the production overlay for hardened settings:

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d
```

## Volumes

| Volume | Purpose |
|--------|---------|
| `postgres-data` | Database persistence |
| `agent-data` | Agent working directory |

## Networking

All services communicate on internal Docker network. Only exposed ports:

- `3000` — Frontend (HTTP)
- `3001` — Backend REST API
- `3002` — Backend WebSocket
- `5432` — PostgreSQL (disable in production)
