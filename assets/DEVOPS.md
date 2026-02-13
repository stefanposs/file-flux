# File Flux — DevOps & Infrastructure Plan

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Docker Compose](#2-docker-compose)
3. [Multi-Stage Dockerfiles](#3-multi-stage-dockerfiles)
4. [CI/CD Pipeline](#4-cicd-pipeline)
5. [Health Check Specification](#5-health-check-specification)
6. [Monitoring & Observability](#6-monitoring--observability)
7. [Agent Distribution Strategy](#7-agent-distribution-strategy)
8. [Helm Chart Structure](#8-helm-chart-structure)
9. [Environment Variable Reference](#9-environment-variable-reference)
10. [Security Model](#10-security-model)
11. [Deployment Playbook](#11-deployment-playbook)

---

## 1. Architecture Overview

```
                    ┌───────────────┐
                    │   Internet    │
                    └───────┬───────┘
                            │ :443 (TLS)
                    ┌───────▼───────┐
                    │   Traefik     │  ← TLS termination, routing
                    │  (proxy-net)  │
                    └──┬────┬───┬───┘
             ┌─────────┘    │   └─────────┐
             │              │             │
    ┌────────▼──────┐ ┌─────▼──────┐ ┌────▼───────┐
    │   Frontend    │ │  Backend   │ │  Grafana   │
    │  (nginx:80)   │ │ :3001 API  │ │   :3000    │
    │ frontend-net  │ │ :3002 WS   │ │ backend-net│
    └───────────────┘ │ frontend-  │ └────────────┘
                      │ net +      │
                      │ backend-net│
                      └──────┬─────┘
                             │
                    ┌────────▼──────┐    ┌─────────────┐
                    │  PostgreSQL   │    │ Prometheus   │
                    │   :5432       │    │   :9090      │
                    │  backend-net  │    │  backend-net │
                    └───────────────┘    └──────────────┘

    Remote agents connect via WSS through Traefik → Backend :3002
```

### Network Segmentation

| Network        | Services                          | Purpose                        |
|----------------|-----------------------------------|--------------------------------|
| `proxy-net`    | Traefik, Frontend, Backend, Grafana | External-facing services      |
| `frontend-net` | Frontend, Backend                 | Frontend → API communication   |
| `backend-net`  | Backend, DB, Agent, Prometheus, Grafana | Internal services          |

**Key constraint:** Frontend cannot reach the database directly.

---

## 2. Docker Compose

### Quick-Start (`docker-compose.yml`)

For development and small deployments without TLS or monitoring.

```bash
cp .env.example .env
# Edit .env — set DB_PASSWORD, JWT_SECRET, AGENT_TOKEN
docker compose up -d
```

Provides: PostgreSQL 16, Backend, Frontend, Central Agent.
All services include health checks.

### Production (`docker-compose.yml` + `docker-compose.production.yml`)

Adds: Traefik (TLS), Prometheus, Grafana, DB backups, PostgreSQL tuning.

```bash
cp .env.example .env
# Edit .env — set DOMAIN, ACME_EMAIL, all passwords
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d
```

### Database Backup (on-demand)

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml \
  run --rm db-backup
```

---

## 3. Multi-Stage Dockerfiles

### Backend (`backend/Dockerfile`)

| Stage     | Base Image       | Purpose                                  |
|-----------|------------------|------------------------------------------|
| `builder` | `golang:1.22-alpine` | Compile Go binary with ldflags        |
| `migrate` | `migrate/migrate:v4.17.0` | Ship golang-migrate CLI          |
| `runtime` | `alpine:3.19`    | ~15 MB final image, non-root user        |

Build args: `VERSION`, `GIT_COMMIT`, `BUILD_TIME` — injected via CI/CD.

### Frontend (`frontend/Dockerfile`)

| Stage     | Base Image         | Purpose                                |
|-----------|--------------------|----------------------------------------|
| `deps`    | `node:20-alpine`   | `npm ci` with caching                 |
| `builder` | `node:20-alpine`   | `vite build` with `VITE_API_URL`       |
| `runtime` | `nginx:1.25-alpine`| Serve static files, ~25 MB             |

Build arg: `API_URL` → baked into Vite build as `VITE_API_URL`.

### Agent (`agent/Dockerfile`)

| Stage     | Base Image           | Purpose                              |
|-----------|----------------------|--------------------------------------|
| `builder` | `golang:1.22-alpine` | Cross-compile with TARGETOS/TARGETARCH |
| `runtime` | `alpine:3.19`        | Non-root, /data volume, ~12 MB       |

---

## 4. CI/CD Pipeline

### CI Workflow (`.github/workflows/ci.yml`)

Triggers: push to `main`/`develop`, PRs to `main`.

```
PR / Push
  │
  ├─ backend-lint ──→ backend-test ──→ backend-build
  │
  ├─ frontend-lint ──→ frontend-test ──→ frontend-build
  │
  ├─ agent-lint ──→ agent-test ──→ agent-build
  │
  └─ db-migration-check
                                        │
                              (main only) ▼
                          docker-build (backend, frontend, agent)
                              → push to ghcr.io
```

**Key features:**
- Concurrency: cancel in-progress runs on same ref
- PostgreSQL service container for backend tests + migration checks
- Code coverage uploaded to Codecov
- Docker layer caching via GitHub Actions cache
- Images pushed to GHCR with `sha-xxxxx` and `latest` tags

### Release Workflow (`.github/workflows/release.yml`)

Triggers: push tag `v*` (e.g., `v1.2.0`).

```
Tag v1.2.0
  │
  ├── validate (backend + agent tests)
  │
  ├── agent-binaries (5 targets, parallel)
  │     ├── linux/amd64
  │     ├── linux/arm64
  │     ├── darwin/amd64
  │     ├── darwin/arm64
  │     └── windows/amd64
  │
  ├── docker-release (backend, frontend, agent)
  │     → multi-platform: linux/amd64 + linux/arm64
  │     → tags: v1.2.0, v1.2, latest
  │
  └── github-release
        → Attach 5 agent binaries + SHA256 checksums
        → Auto-generated release notes
        → Docker pull instructions
        → Quick-install commands
```

### Release Process

```bash
# 1. Update version & changelog
# 2. Create and push tag
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin v1.2.0
# 3. CI builds everything, creates GitHub Release automatically
```

---

## 5. Health Check Specification

### Backend Endpoints

#### `GET /health` — Liveness probe

Returns `200 OK` if the process is alive. No dependency checks.

```json
{
  "status": "ok",
  "version": "1.2.0",
  "commit": "abc1234",
  "uptime": "4h32m"
}
```

#### `GET /ready` — Readiness probe

Returns `200 OK` if the service is ready to handle traffic. Checks database connectivity.

```json
{
  "status": "ready",
  "checks": {
    "database": { "status": "ok", "latency_ms": 2 },
    "websocket": { "status": "ok", "connections": 5 }
  }
}
```

Returns `503 Service Unavailable` if any critical dependency is down:

```json
{
  "status": "not_ready",
  "checks": {
    "database": { "status": "error", "error": "connection refused" },
    "websocket": { "status": "ok", "connections": 0 }
  }
}
```

#### `GET /metrics` — Prometheus metrics

Standard Prometheus exposition format.

### Docker Health Checks

| Service       | Check                                              | Interval | Start Period |
|---------------|---------------------------------------------------|----------|-------------|
| `db`          | `pg_isready -U fileflux -d fileflux`              | 10s      | 30s         |
| `backend`     | `wget --spider -q http://localhost:3001/health`    | 15s      | 10s         |
| `frontend`    | `wget --spider -q http://localhost:80/`            | 15s      | 5s          |
| `agent`       | `wget --spider -q http://localhost:8080/health`    | 30s      | 15s         |
| `prometheus`  | `wget --spider -q http://localhost:9090/-/healthy` | 15s      | —           |
| `grafana`     | `wget --spider -q http://localhost:3000/api/health`| 15s      | —           |

---

## 6. Monitoring & Observability

### Prometheus Metrics (Backend)

The backend exposes these custom metrics on `/metrics`:

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `fileflux_http_requests_total` | Counter | `method`, `path`, `status` | Total HTTP requests |
| `fileflux_http_request_duration_seconds` | Histogram | `method`, `path` | Request duration distribution |
| `fileflux_websocket_connections_active` | Gauge | — | Currently active WS connections |
| `fileflux_agents_connected` | Gauge | — | Connected agents |
| `fileflux_transfers_active` | Gauge | — | In-progress transfers |
| `fileflux_transfers_total` | Counter | `status` | Total transfers (completed/failed) |
| `fileflux_transfer_bytes_total` | Counter | `direction` | Total bytes transferred |
| `fileflux_db_connections_open` | Gauge | — | Open DB pool connections |
| `fileflux_db_connections_in_use` | Gauge | — | In-use DB connections |
| `fileflux_db_connections_idle` | Gauge | — | Idle DB connections |
| `fileflux_jobs_scheduled` | Gauge | — | Jobs with active schedules |

Plus standard Go runtime metrics via `promhttp`.

### Grafana Dashboard

Pre-built dashboard at `monitoring/grafana/dashboards/fileflux-overview.json` includes:

- **Service Health** — UP/DOWN indicator
- **HTTP Request Rate** — by method/path/status
- **HTTP Latency (p95)** — by endpoint
- **Active WebSocket Connections**
- **Connected Agents**
- **Active Transfers**
- **Transfer Throughput** — bytes/sec
- **Transfer Status Distribution** — pie chart
- **Database Connection Pool** — open/in-use/idle
- **Go Runtime Memory** — alloc vs sys

### Structured Logging

All components use `log/slog` with JSON output in production:

```json
{
  "time": "2026-02-12T14:30:00Z",
  "level": "INFO",
  "msg": "transfer completed",
  "transfer_id": 1234,
  "job_id": 56,
  "file": "report.csv",
  "size_bytes": 1048576,
  "duration_ms": 342
}
```

Configure via env vars: `LOG_LEVEL` (debug/info/warn/error), `LOG_FORMAT` (json/text).

---

## 7. Agent Distribution Strategy

### Pre-built Binaries

Each GitHub Release includes 5 binaries with SHA256 checksums:

| File | Platform |
|------|---------|
| `fileflux-agent-linux-amd64` | Linux x86_64 |
| `fileflux-agent-linux-arm64` | Linux ARM64 (Raspberry Pi, AWS Graviton) |
| `fileflux-agent-darwin-amd64` | macOS Intel |
| `fileflux-agent-darwin-arm64` | macOS Apple Silicon |
| `fileflux-agent-windows-amd64.exe` | Windows x86_64 |

### Install Scripts

**Linux/macOS** (`agent/install.sh`):
```bash
curl -sSL https://raw.githubusercontent.com/stefanposs/file-flux/main/agent/install.sh \
  | sudo bash -s -- --token TOKEN --server wss://fileflux.example.com/ws/agent
```

**Windows** (`agent/install.ps1`):
```powershell
iwr -useb https://raw.githubusercontent.com/stefanposs/file-flux/main/agent/install.ps1 | iex
```

### Auto-Update Mechanism

```
Agent start
  │
  ├── GET /api/agent/version → { "latest": "v1.3.0", "url": "..." }
  │
  ├── Compare main.Version vs latest
  │     └─ if newer → download binary, verify SHA256, replace, restart service
  │
  └── Re-check on interval (default: 6h)
```

The backend provides `GET /api/agent/version` returning:
```json
{
  "latest": "v1.3.0",
  "download_urls": {
    "linux-amd64": "https://github.com/stefanposs/file-flux/releases/download/v1.3.0/fileflux-agent-linux-amd64",
    "linux-arm64": "...",
    "darwin-amd64": "...",
    "darwin-arm64": "...",
    "windows-amd64": "..."
  },
  "checksums": {
    "linux-amd64": "sha256:abcdef..."
  }
}
```

---

## 8. Helm Chart Structure

For Kubernetes deployments, provide a Helm chart:

```
deploy/helm/fileflux/
├── Chart.yaml                  # name, version, appVersion
├── values.yaml                 # all configurable values
├── templates/
│   ├── _helpers.tpl            # template helpers
│   ├── namespace.yaml
│   ├── configmap.yaml          # backend + agent config
│   ├── secret.yaml             # DB password, JWT secret, agent token
│   │
│   ├── backend/
│   │   ├── deployment.yaml     # replicas, probes, resources
│   │   ├── service.yaml        # ClusterIP :3001, :3002
│   │   └── hpa.yaml            # HorizontalPodAutoscaler
│   │
│   ├── frontend/
│   │   ├── deployment.yaml
│   │   └── service.yaml        # ClusterIP :80
│   │
│   ├── agent/
│   │   ├── deployment.yaml     # central agent
│   │   └── pvc.yaml            # persistent volume for /data
│   │
│   ├── postgres/
│   │   ├── statefulset.yaml    # or use external DB
│   │   ├── service.yaml
│   │   └── pvc.yaml
│   │
│   ├── ingress.yaml            # Ingress with TLS
│   │
│   └── monitoring/
│       ├── servicemonitor.yaml # for Prometheus Operator
│       └── grafana-dashboard.yaml
│
└── README.md
```

### Key `values.yaml` structure:

```yaml
global:
  domain: fileflux.example.com

backend:
  image:
    repository: ghcr.io/stefanposs/file-flux/backend
    tag: ""  # defaults to Chart.appVersion
  replicas: 2
  resources:
    requests: { cpu: 100m, memory: 128Mi }
    limits:   { cpu: 500m, memory: 512Mi }

frontend:
  image:
    repository: ghcr.io/stefanposs/file-flux/frontend
    tag: ""
  replicas: 2
  resources:
    requests: { cpu: 50m, memory: 64Mi }
    limits:   { cpu: 200m, memory: 128Mi }

agent:
  image:
    repository: ghcr.io/stefanposs/file-flux/agent
    tag: ""
  persistence:
    size: 10Gi
    storageClass: ""

postgres:
  enabled: true           # set false to use external DB
  image: postgres:16-alpine
  persistence:
    size: 20Gi
  externalHost: ""        # when enabled=false

ingress:
  enabled: true
  className: nginx
  tls: true
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod

monitoring:
  serviceMonitor:
    enabled: true
    interval: 15s
```

---

## 9. Environment Variable Reference

| Variable | Default | Required | Service | Description |
|----------|---------|----------|---------|-------------|
| `DB_USER` | `fileflux` | — | Backend | PostgreSQL username |
| `DB_PASSWORD` | — | **Yes** | Backend, DB | PostgreSQL password |
| `DB_NAME` | `fileflux` | — | Backend, DB | Database name |
| `DB_HOST` | `db` | — | Backend | Database hostname |
| `DB_PORT` | `5432` | — | Backend | Database port |
| `DB_SSLMODE` | `disable` | — | Backend | `disable` / `require` |
| `JWT_SECRET` | — | **Yes** | Backend | Signing key for JWT tokens |
| `SERVER_PORT` | `3001` | — | Backend | HTTP API port |
| `WEBSOCKET_PORT` | `3002` | — | Backend | WebSocket port |
| `ENV` | `production` | — | Backend | `development` / `production` |
| `LOG_LEVEL` | `info` | — | Backend, Agent | `debug` / `info` / `warn` / `error` |
| `LOG_FORMAT` | `json` | — | Backend | `json` / `text` |
| `API_PORT` | `3001` | — | Compose | Host port mapping for API |
| `WS_PORT` | `3002` | — | Compose | Host port mapping for WS |
| `FRONTEND_PORT` | `3000` | — | Compose | Host port mapping for frontend |
| `API_URL` | `/api` | — | Frontend | Vite build-time API base URL |
| `AGENT_TOKEN` | — | **Yes** | Agent | Token for WebSocket auth |
| `AGENT_NAME` | `Central-Agent` | — | Agent | Display name for the agent |
| `DOMAIN` | — | Prod | Traefik | FQDN for TLS certificates |
| `ACME_EMAIL` | — | Prod | Traefik | Let's Encrypt notification email |
| `GRAFANA_USER` | `admin` | — | Grafana | Admin username |
| `GRAFANA_PASSWORD` | — | Prod | Grafana | Admin password |

---

## 10. Security Model

### Container Security

- **Non-root users** — all containers run as `fileflux` user (UID 1000)
- **Read-only root filesystem** — application writes only to designated volumes
- **No privilege escalation** — `--security-opt no-new-privileges`
- **Minimal base images** — Alpine-based (~15 MB backend, ~25 MB frontend)
- **No shell in production** — consider distroless for backend in the future

### Network Segmentation

```
proxy-net:    Traefik ←→ Frontend, Backend, Grafana
frontend-net: Frontend ←→ Backend
backend-net:  Backend ←→ PostgreSQL, Agent, Prometheus, Grafana
```

**Frontend cannot reach the database** — it's only on `frontend-net`, which doesn't include `db`.

### Secret Management

| Method | When | Example |
|--------|------|---------|
| `.env` file | Docker Compose | `DB_PASSWORD`, `JWT_SECRET` |
| Docker Secrets | Swarm mode | `docker secret create db_pass ...` |
| Kubernetes Secrets | Helm chart | `kubectl create secret ...` |
| Vault / SOPS | Enterprise | Encrypted secrets in Git |

### TLS

- **External traffic** — TLS terminated at Traefik (Let's Encrypt auto-renewal)
- **Agent connections** — WSS through Traefik → Backend
- **Internal traffic** — plain HTTP within Docker network (trusted boundary)
- **Database** — `DB_SSLMODE=require` for external PostgreSQL

---

## 11. Deployment Playbook

### Option A: Quick-Start (Docker Compose)

```bash
# 1. Clone / download
git clone https://github.com/stefanposs/file-flux.git
cd file-flux

# 2. Configure
cp .env.example .env
nano .env  # set DB_PASSWORD, JWT_SECRET, AGENT_TOKEN

# 3. Start
docker compose up -d

# 4. Access
open http://localhost:3000
# Login: admin@fileflux.de / admin
```

### Option B: Production (Docker Compose + TLS + Monitoring)

```bash
# 1. Configure
cp .env.example .env
nano .env  # set DOMAIN, ACME_EMAIL, all passwords

# 2. Start
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d

# 3. Verify
curl https://your-domain.com/api/health
curl https://your-domain.com/grafana  # Grafana dashboards
```

### Option C: Kubernetes (Helm)

```bash
# 1. Add repo (future)
# helm repo add fileflux https://charts.fileflux.dev

# 2. Install
helm install fileflux deploy/helm/fileflux \
  --namespace fileflux --create-namespace \
  --set global.domain=fileflux.example.com \
  --set backend.env.DB_PASSWORD=xxx \
  --set backend.env.JWT_SECRET=xxx
```

### Option D: Single Binary

```bash
# Download backend binary from GitHub Release
./fileflux-backend --config config.yaml
# Requires external PostgreSQL and separate frontend serving
```

---

## File Summary

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Quick-start compose with health checks & network segmentation |
| `docker-compose.production.yml` | Production overlay: Traefik TLS, Prometheus, Grafana, backups |
| `.env.example` | Environment variable template |
| `backend/Dockerfile` | Multi-stage Go build with migrate CLI |
| `frontend/Dockerfile` | Multi-stage Node build → nginx runtime |
| `agent/Dockerfile` | Multi-stage Go build with cross-compilation support |
| `.github/workflows/ci.yml` | CI: lint → test → build → Docker push (main) |
| `.github/workflows/release.yml` | Release: cross-compile agent, Docker multi-platform, GitHub Release |
| `Makefile` | Root project orchestration: build, test, lint, release, compose |
| `monitoring/prometheus/prometheus.yml` | Prometheus scrape config |
| `monitoring/grafana/provisioning/datasources.yml` | Grafana → Prometheus auto-config |
| `monitoring/grafana/provisioning/dashboards.yml` | Dashboard auto-provisioning |
| `monitoring/grafana/dashboards/fileflux-overview.json` | Pre-built Grafana dashboard |
