# File Flux — Project Context Document

**Version:** 1.0  
**Last Updated:** 2026-02-12  
**Status:** Active — Single Source of Truth  
**Maintainer:** Context Manager Agent

---

## Table of Contents

1. [Project Identity](#1-project-identity)
2. [Architecture Overview](#2-architecture-overview)
3. [Current State Assessment](#3-current-state-assessment)
4. [Glossary](#4-glossary)
5. [Component Map](#5-component-map)
6. [Data Flow](#6-data-flow)
7. [API Surface](#7-api-surface)
8. [Configuration](#8-configuration)
9. [Development Environment](#9-development-environment)
10. [Decision Log (ADRs)](#10-decision-log-adrs)
11. [Known Issues & Tech Debt](#11-known-issues--tech-debt)
12. [Dependencies](#12-dependencies)
13. [Documentation Index](#13-documentation-index)

---

## 1. Project Identity

| Field | Value |
|-------|-------|
| **Name** | File Flux |
| **Tagline** | Self-hosted Managed File Transfer for the mid-market |
| **Repository** | `github.com/stefanposs/file-flux` |
| **License** | Proprietary (TBD) |
| **Language** | German comments throughout codebase; English documentation |
| **Current Phase** | Pre-Phase 0 (prototype with critical issues) |

### Tech Stack Summary

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Backend | Go | 1.21 (go.mod) | Target: Go 1.22 |
| Router | gorilla/mux | 1.8.1 | Active path — ADR-001 |
| Database | PostgreSQL | 16-alpine (Docker) | Raw SQL via `database/sql` |
| Frontend | Lit (Web Components) | ^2.6.1 | Vite bundler |
| Frontend Build | Vite | ^6.2.2 | TypeScript |
| Agent | Go | 1.21 | WebSocket client |
| Containerization | Docker Compose | v2 syntax | 4 services |
| Monitoring (planned) | Prometheus + Grafana | — | Config files exist, not wired |

### Project Goal

Build an enterprise-grade self-hosted MFT platform comparable to Stonebranch, enabling N-to-M file transfer job orchestration. Agents run on customer infrastructure (Linux/Windows/macOS), connect to a central backend over WebSocket, and execute file transfer jobs defined via a web UI.

---

## 2. Architecture Overview

### System Context

```
                        HTTPS (REST)
  ┌──────────┐      ◄──────────────────►      ┌───────────────────┐
  │ Browser  │          SSE (planned)         │    Backend (Go)    │
  │ (Lit UI) │◄────────────────────────────── │  Control Plane     │
  └──────────┘                                │  Port 3001 (REST)  │
                                              │  Port 3002 (WS)    │
                                              └───────┬────────────┘
                                                      │ WebSocket
                              ┌────────────────────────┼────────────────────────┐
                              │                        │                        │
                        ┌─────┴─────┐            ┌─────┴─────┐           ┌──────┴────┐
                        │  Agent A  │            │  Agent B  │           │  Agent N  │
                        │ (Source)  │            │  (Dest)   │           │           │
                        └─────┬─────┘            └─────┬─────┘           └───────────┘
                              │                        │
                        Local FS / NFS           Local FS / NFS
```

### Component Interaction

| From → To | Protocol | Port | Purpose |
|-----------|----------|------|---------|
| Browser → Backend | HTTP REST | 3001 | CRUD operations, auth |
| Browser ← Backend | SSE (planned) | 3001 | Real-time updates (not implemented) |
| Agent → Backend | WebSocket | 3002 | Registration, heartbeat, commands |
| Agent ← Backend | WebSocket | 3002 | Transfer requests, cancel commands |
| Backend → PostgreSQL | TCP | 5432 | Persistence |
| Frontend (Nginx) → Browser | HTTP | 3000 (80) | Serve SPA |

### Key Architectural Principles

1. **Agent-Mediated Transfer** — Agents handle actual file I/O on remote machines; backend is control plane only.
2. **Event-Driven Core** — Every state change should emit a domain event (not yet implemented).
3. **Resumable by Default** — Transfers are chunked, each chunk hash-verified (architecture specced, not implemented).
4. **Single Binary Deployment** — Backend and Agent each ship as one Go binary.

---

## 3. Current State Assessment

### What Works (✅)

| Component | Details |
|-----------|---------|
| REST API routing | `gorilla/mux` router in `backend/internal/api/router.go` — 5 resource groups wired |
| PostgreSQL schema | 5 tables (`users`, `agents`, `tokens`, `jobs`, `transfers`) in `backend/internal/db/schema.sql` |
| Database layer | `backend/internal/db/database.go` — raw SQL CRUD for agents (partial; jobs/transfers have TODOs) |
| WebSocket manager | `backend/internal/websocket/manager.go` — agent connections, heartbeat, message routing |
| WebSocket protocol | `backend/internal/websocket/protocol.go` — defined message types for heartbeat, transfer progress/complete/error |
| Frontend SPA | `frontend/src/app.ts` (507 lines) — Lit app with auth, routing, 10+ component imports |
| Agent startup | `agent/cmd/agent/main.go` — loads config, collects sysinfo, connects WebSocket |
| System info | `agent/internal/system/sysinfo.go` — hostname, OS, IP, CPU count |
| Docker Compose | 4 services: `db`, `backend`, `frontend`, `agent-central` with health checks |
| Makefile | Root Makefile with build/test/lint/docker/release targets |
| Demo mode | Frontend can run with mock data via `demo-mode.ts` |

### What's Broken (🔴)

| Issue | Location | Details |
|-------|----------|---------|
| **Token validation bypass** | `backend/internal/websocket/manager.go:121` | `validateToken()` returns hardcoded `return 1, nil` — ANY token grants agent ID 1 |
| **Three incompatible entry points** | `backend/cmd/main.go`, `backend/cmd/server/main.go` | Two `main()` functions with different architectures (see §3.1) |
| **Broken import paths** | `backend/internal/handlers/job_handler.go:11` | Uses `github.com/your-username/fileflux/...` (placeholder never replaced) |
| **Broken import paths** | `backend/internal/auth/auth0.go:13` | Same placeholder import `github.com/your-username/fileflux/...` |
| **Broken import paths** | `backend/internal/payment/stripe.go:10-11` | Same placeholder import |
| **Module path mismatch** | `backend/go.mod` vs `backend/internal/` | `go.mod` declares `github.com/stefanposs/file-flux/backend` but `internal/api/router.go` imports `fileflux/backend/internal/...` (no prefix) |
| **In-memory file storage** | `backend/internal/services/file_transfer_service.go:25` | `fileStorage = make(map[string][]byte)` — global var, 10 MB limit, data lost on restart |
| **Auth middleware stub** | `backend/internal/middleware/auth.go` | `Auth()` function body is empty (comment only) |

### What's Missing (⬜)

| Feature | Priority | Notes |
|---------|----------|-------|
| File transfer engine (chunking, compression, hashing) | P0 | Core value proposition |
| Job scheduler | P0 | Cron field in DB but no `robfig/cron` integration |
| SSE for frontend real-time | P1 | ADR-006 accepted, zero implementation |
| Event bus | P1 | ADR-002 accepted, zero implementation |
| Database migrations (golang-migrate) | P1 | ADR-008 accepted, using raw `schema.sql` exec |
| Structured logging (slog) | P1 | ADR-009 accepted, using `log.Logger` everywhere |
| Test suite | P1 | Zero tests across all components |
| CI/CD pipeline | P1 | No GitHub Actions config |
| RBAC beyond admin/user | P2 | Only two roles exist |
| Audit logging | P2 | No audit trail |
| Agent groups | P2 | No grouping mechanism |
| Retry/error handling | P2 | No retry policies |
| Compression | P2 | Config flag exists, no implementation |
| Webhook system | P3 | Not started |
| TLS/Traefik | P3 | Planned for production compose |

### 3.1 Architecture Debt — Three Code Paths

The backend contains **three competing architectures** that must be consolidated (ADR-001):

```
Path A — ACTIVE (wired to router.go):
  backend/internal/api/router.go      → gorilla/mux, *log.Logger
  backend/internal/db/database.go     → raw *sql.DB, hand-written SQL, int PKs
  backend/internal/models/            → plain structs (Agent, Job, Transfer, User)
  backend/internal/handlers/          → gorilla/mux handlers (auth, agent, job, transfer, token)
  backend/internal/websocket/         → gorilla/websocket Manager
  backend/internal/config/config.go   → YAML config loader
  Imports: "fileflux/backend/internal/..."

Path B — DORMANT (not wired to any main.go):
  backend/pkg/api/server.go           → gin.Engine, *gorm.DB, zap.Logger
  backend/pkg/domain/jobs/model.go    → GORM models, uuid.UUID PKs
  backend/pkg/domain/agents/model.go  → GORM models, uuid.UUID PKs
  backend/pkg/config/config.go        → env-only config (Auth0, Stripe)
  backend/internal/database/db.go     → Database interface, context-aware, string PKs
  backend/cmd/server/main.go          → uses Path B (zap, Auth0, Stripe, pkg/api)
  Imports: "github.com/stefanposs/file-flux/backend/pkg/..."

Path C — DEAD (Node.js prototype):
  backend/src/server.js               → Express + ws, never used
  backend/src/utils/setupDb.js        → DB setup script
```

**Path A** is what actually runs. **Path B** has better patterns (interfaces, context, UUIDs) but uses gin/GORM. **Path C** is a dead Node.js prototype. ADR-001 mandates: keep Path A's stack, adopt Path B's patterns, delete B and C.

---

## 4. Glossary

| Term | Definition |
|------|-----------|
| **Agent** | A Go binary installed on a customer's machine (Linux/Windows/macOS) that connects to the backend over WebSocket and executes file I/O operations. |
| **Job** | A configured file transfer task defining source agent, destination agent, paths, schedule, and transfer options. Jobs can be `push` or `pull` type. |
| **Transfer** | A single execution instance of a Job — one file being moved from source to destination. Has states: `pending` → `running` → `completed`/`failed`. |
| **Push Mode** | Agent reads a local file and uploads it through the backend to the destination agent. |
| **Pull Mode** | Agent requests a file from the source agent (via backend) and writes it locally. |
| **Chunk** | A segment of a file (default 8 MB in agent config). Files are split into chunks for parallel transfer and resumability. |
| **Token** | An opaque string used by agents to authenticate their WebSocket connection. Stored in the `tokens` table, linked to an agent. |
| **Heartbeat** | Periodic WebSocket message from agent to backend confirming liveness. Default interval: 60 seconds. |
| **Backend** | The central Go server. Acts as control plane (REST API, job scheduling, agent management) and data relay (chunks pass through in Phase 1). |
| **Control Plane** | Backend role: manages state, schedules, authentication. Does NOT directly touch files on disk. |
| **Data Plane** | Agent role: reads/writes files on local filesystem. Backend may relay chunk data between agents (Phase 1). |
| **SSE** | Server-Sent Events — planned mechanism for pushing real-time updates from backend to browser. |
| **Event Bus** | In-process pub/sub system for domain events (planned, ADR-002). |
| **MFT** | Managed File Transfer — enterprise category of software for automated, secure, auditable file exchange. |
| **Demo Mode** | Frontend feature that shows mock data without a running backend (`frontend/src/demo-mode.ts`). |

---

## 5. Component Map

### 5.1 Backend (`backend/`)

| Package | Path | Responsibility | Status |
|---------|------|---------------|--------|
| **cmd/main.go** | `backend/cmd/main.go` | Entry point (Path B — Auth0/Stripe/gin) | ❌ Broken imports, not the active entry point |
| **cmd/server/main.go** | `backend/cmd/server/main.go` | Entry point (Path B — zap/gin) | ❌ Same as above |
| **internal/api** | `backend/internal/api/router.go` | HTTP router setup, all route definitions | ✅ Active — gorilla/mux |
| **internal/config** | `backend/internal/config/config.go` | YAML + env config loading | ✅ Active |
| **internal/db** | `backend/internal/db/database.go` | PostgreSQL connection, raw SQL queries | ✅ Active (partial — agents only complete) |
| **internal/db** | `backend/internal/db/schema.sql` | DDL for 5 tables | ✅ Active |
| **internal/handlers** | `backend/internal/handlers/auth_handler.go` | Login, refresh, current user | ⚠️ Stub (Login body is empty comment) |
| **internal/handlers** | `backend/internal/handlers/job_handler.go` | Job CRUD + RunJob | ⚠️ Broken imports (`your-username`) |
| **internal/handlers** | `backend/internal/handlers/file_transfer.go` | Long-polling upload/download | ⚠️ Broken imports, in-memory storage |
| **internal/middleware** | `backend/internal/middleware/auth.go` | JWT auth middleware | ❌ Empty function body |
| **internal/models** | `backend/internal/models/models.go` | Agent struct, error constants | ✅ Active |
| **internal/models** | `backend/internal/models/job.go` | Job struct with types/statuses | ✅ Active |
| **internal/models** | `backend/internal/models/transfer.go` | Transfer struct with chunk fields | ✅ Active |
| **internal/models** | `backend/internal/models/user.go` | User struct (Auth0ID, StripeCustomerID) | ⚠️ Has Auth0/Stripe fields (tech debt) |
| **internal/websocket** | `backend/internal/websocket/manager.go` | WebSocket connection lifecycle, heartbeat, message dispatch | ⚠️ Token validation hardcoded |
| **internal/websocket** | `backend/internal/websocket/protocol.go` | Message type constants and DTOs | ✅ Active |
| **internal/services** | `backend/internal/services/file_transfer_service.go` | In-memory file upload/download | ❌ 10 MB limit, global state |
| **internal/auth** | `backend/internal/auth/auth.go` | Auth0 JWT validation | ❌ Path C — dead code, uses go-jwt-middleware/v2 |
| **internal/auth** | `backend/internal/auth/auth0.go` | Auth0 token validation | ❌ Path C — dead code, broken imports |
| **internal/payment** | `backend/internal/payment/stripe.go` | Stripe customer/subscription management | ❌ Dead code — Stripe not in scope |
| **internal/database** | `backend/internal/database/db.go` | Database interface + PostgresDB impl | ❌ Path B — dormant, context-aware, good patterns |
| **pkg/api** | `backend/pkg/api/server.go` | gin-based HTTP server | ❌ Path B — dormant |
| **pkg/config** | `backend/pkg/config/config.go` | Env-only config (Auth0/Stripe) | ❌ Path B — dormant |
| **pkg/domain/jobs** | `backend/pkg/domain/jobs/model.go` | GORM Job/JobEvent/JobStatistics models | ❌ Path B — dormant |
| **pkg/domain/agents** | `backend/pkg/domain/agents/model.go` | GORM Agent/AgentCommand models | ❌ Path B — dormant |
| **src/server.js** | `backend/src/server.js` | Express + WebSocket server | ❌ Path C — dead Node.js code |

### 5.2 Frontend (`frontend/`)

| File/Dir | Responsibility | Status |
|----------|---------------|--------|
| `src/app.ts` | Root app component, auth state, routing (507 lines, switch-based) | ✅ Working but monolithic |
| `src/main.ts` | Entry point, mounts `<file-flux-app>` | ✅ Working |
| `src/demo-mode.ts` | Mock data provider for offline demo | ✅ Working |
| `src/components/dashboard/dashboard.ts` | Dashboard view | ✅ Basic |
| `src/components/jobs/job-list.ts` | Job listing | ✅ Basic |
| `src/components/jobs/job-detail.ts` | Job detail view | ✅ Basic |
| `src/components/agents/agent-list.ts` | Agent listing | ✅ Basic |
| `src/components/agents/agent-detail.ts` | Agent detail view | ✅ Basic |
| `src/components/transfers/transfer-list.ts` | Transfer listing | ✅ Basic |
| `src/components/transfers/transfer-detail.ts` | Transfer detail view | ✅ Basic |
| `src/components/tokens/token-list.ts` | Token management | ✅ Basic |
| `src/components/shared/header.ts` | App header/navigation | ✅ Basic |
| `src/components/auth/` | Login components | ✅ Basic |
| `src/utils/color-picker.ts` | Color utility | ✅ Utility |
| `src/utils/demo-mode.ts` | Demo mode utility | ✅ Utility |
| `vite.config.ts` | Vite build configuration | ✅ Working |
| `nginx.conf` | Production Nginx config | ✅ For Docker |

### 5.3 Agent (`agent/`)

| Package | Path | Responsibility | Status |
|---------|------|---------------|--------|
| **cmd/agent/main.go** | `agent/cmd/agent/main.go` | Entry point — config, sysinfo, WebSocket connect | ✅ Working |
| **internal/config** | `agent/internal/config/config.go` | YAML config + defaults (platform-aware paths) | ✅ Working |
| **internal/system** | `agent/internal/system/sysinfo.go` | Collects hostname, OS, IP, CPU count | ✅ Working |
| **internal/websocket** | `agent/internal/websocket/` | WebSocket client (connect, heartbeat, receive commands) | ⚠️ Partial |
| **internal/transfer** | `agent/internal/transfer/` | Transfer manager | ❌ Empty directory |
| **internal/api** | `agent/internal/api/api_client.go` | REST API client | ⚠️ Unknown state |
| **internal/models** | `agent/internal/models/file_transfer.go` | Transfer model | ⚠️ Unknown state |

### 5.4 Infrastructure

| File | Purpose | Status |
|------|---------|--------|
| `docker-compose.yml` | Dev/quickstart: db, backend, frontend, agent-central | ✅ Working |
| `docker-compose.production.yml` | Production overrides (Traefik, Prometheus, Grafana) | ⚠️ Exists, untested |
| `Makefile` | Root build orchestration (build/test/lint/docker/release) | ✅ Working |
| `backend/Dockerfile` | Backend multi-stage build | ✅ Exists |
| `frontend/Dockerfile` | Frontend multi-stage build | ✅ Exists |
| `agent/Dockerfile` | Agent build | ✅ Exists |
| `agent/Makefile` | Agent-specific build targets | ✅ Exists |
| `agent/install.sh` | Agent install script (Linux/macOS) | ✅ Exists |
| `agent/install.ps1` | Agent install script (Windows) | ✅ Exists |
| `deploy/helm/fileflux/` | Helm chart (Chart.yaml, values.yaml, templates) | ⚠️ Scaffolded, untested |
| `monitoring/prometheus/prometheus.yml` | Prometheus scrape config | ⚠️ Config exists, not wired |
| `monitoring/grafana/` | Dashboards + provisioning | ⚠️ Config exists, not wired |

---

## 6. Data Flow

### 6.1 File Transfer — End-to-End (Target Architecture)

```
1. User creates a Job via UI
   Browser → POST /api/jobs → Backend → INSERT INTO jobs → 201 Created

2. Scheduler triggers job (cron) OR user clicks "Run Now"
   Backend Scheduler → Job → creates Transfer record
   Backend → INSERT INTO transfers (status='pending')

3. Backend sends transfer request to Source Agent
   Backend → WebSocket → Agent A (source)
   Message: { type: "transfer_request", data: { source_path, chunk_size, ... } }

4. Source Agent reads file, chunks it, compresses, hashes each chunk
   Agent A → reads /data/report.csv
   → splits into 8 MB chunks
   → compresses with zstd
   → computes SHA-256 per chunk and whole file

5. Source Agent streams chunks to Backend via WebSocket (binary frames)
   Agent A → WebSocket binary frame → Backend
   (Each frame: header + compressed chunk data)

6. Backend relays chunks to Destination Agent (Phase 1: relay)
   Backend → WebSocket binary frame → Agent B (destination)

7. Destination Agent reassembles file
   Agent B → receives chunks → decompresses → verifies hash → writes to disk

8. Destination Agent confirms completion
   Agent B → WebSocket → Backend
   Message: { type: "transfer_complete", data: { transfer_id, duration } }

9. Backend updates transfer status and emits event
   Backend → UPDATE transfers SET status='completed'
   Backend → Event Bus → SSE → Browser (real-time update)
```

### 6.2 Current Reality (What Actually Happens Today)

```
1. User creates a Job via UI → POST /api/jobs → Stored in DB ✅
2. No scheduler exists — "Run Now" button triggers handler ⚠️
3. File upload uses LongPollingUpload in file_transfer_service.go:
   - Reads multipart form (10 MB max)
   - Stores entire file in-memory: fileStorage[jobID] = data ❌
4. Download pulls from in-memory map and deletes it ❌
5. No chunking, no compression, no hashing ❌
6. No WebSocket-based transfer — WebSocket only does heartbeat + agent_info ⚠️
7. Transfer progress/complete/error handlers exist but are TODO stubs ⚠️
```

### 6.3 Agent Connection Flow (Current)

```
1. Agent starts → loads config.yaml
2. Collects system info (hostname, OS, IP, CPUs)
3. Connects: ws://backend:3002/ws/agent
   Header: Authorization: Bearer <token>
4. Backend validateToken() → return 1, nil (HARDCODED — accepts anything)
5. Backend marks agent as "online" in DB
6. Agent sends heartbeat every 60s → Backend updates last_seen
7. On disconnect → Backend marks agent "offline"
```

---

## 7. API Surface

### 7.1 Current Endpoints (Implemented in `router.go`)

All routes prefixed with `/api`. All except auth routes require JWT via `middleware.Auth()` (currently a stub).

#### Authentication

| Method | Path | Handler | Status |
|--------|------|---------|--------|
| POST | `/api/auth/login` | `authHandler.Login` | ⚠️ Stub |
| POST | `/api/auth/refresh` | `authHandler.RefreshToken` | ⚠️ Stub |
| GET | `/api/auth/user` | `authHandler.GetCurrentUser` | ⚠️ Stub |

#### Agents

| Method | Path | Handler | Status |
|--------|------|---------|--------|
| GET | `/api/agents` | `agentHandler.GetAgents` | ✅ |
| POST | `/api/agents` | `agentHandler.CreateAgent` | ✅ |
| GET | `/api/agents/{id}` | `agentHandler.GetAgent` | ✅ |
| PUT | `/api/agents/{id}` | `agentHandler.UpdateAgent` | ✅ |
| DELETE | `/api/agents/{id}` | `agentHandler.DeleteAgent` | ✅ |
| POST | `/api/agents/{id}/test` | `agentHandler.TestConnection` | ⚠️ |

#### Jobs

| Method | Path | Handler | Status |
|--------|------|---------|--------|
| GET | `/api/jobs` | `jobHandler.GetJobs` | ⚠️ Broken imports |
| POST | `/api/jobs` | `jobHandler.CreateJob` | ⚠️ Broken imports |
| GET | `/api/jobs/{id}` | `jobHandler.GetJob` | ⚠️ Broken imports |
| PUT | `/api/jobs/{id}` | `jobHandler.UpdateJob` | ⚠️ Broken imports |
| DELETE | `/api/jobs/{id}` | `jobHandler.DeleteJob` | ⚠️ Broken imports |
| POST | `/api/jobs/{id}/run` | `jobHandler.RunJob` | ⚠️ Broken imports |

#### Transfers

| Method | Path | Handler | Status |
|--------|------|---------|--------|
| GET | `/api/transfers` | `transferHandler.GetTransfers` | ⚠️ |
| POST | `/api/transfers` | `transferHandler.CreateTransfer` | ⚠️ |
| GET | `/api/transfers/{id}` | `transferHandler.GetTransfer` | ⚠️ |
| POST | `/api/transfers/{id}/cancel` | `transferHandler.CancelTransfer` | ⚠️ |

#### Tokens

| Method | Path | Handler | Status |
|--------|------|---------|--------|
| GET | `/api/tokens` | `tokenHandler.GetTokens` | ⚠️ |
| POST | `/api/tokens` | `tokenHandler.CreateToken` | ⚠️ |
| DELETE | `/api/tokens/{id}` | `tokenHandler.RevokeToken` | ⚠️ |

#### WebSocket

| Path | Protocol | Handler | Status |
|------|----------|---------|--------|
| `/ws/agent` | WebSocket | `wsManager.Handler()` | ⚠️ Auth bypass |

#### Static Files

| Path | Handler | Notes |
|------|---------|-------|
| `/*` | `http.FileServer("./static")` | Serves frontend in production |

### 7.2 Planned Endpoints (from Master Plan — ~40+ total)

Not yet implemented:

| Category | Endpoints |
|----------|-----------|
| Agent Groups | `GET/POST /api/agent-groups`, `PUT/DELETE /api/agent-groups/{id}` |
| Job Groups | `GET/POST /api/job-groups`, `PUT/DELETE /api/job-groups/{id}` |
| Job Scheduling | `POST /api/jobs/{id}/schedule` |
| Transfer Resume | `POST /api/transfers/{id}/resume` |
| Users (admin) | `GET /api/users`, `PUT /api/users/{id}/role` |
| API Keys | `GET/POST /api/api-keys` |
| Webhooks | `GET/POST /api/webhooks` |
| Audit Log | `GET /api/audit-log` |
| Dashboard Stats | `GET /api/dashboard/stats` |
| SSE Stream | `GET /api/events/stream` |
| Health | `GET /health` |
| Readiness | `GET /ready` |
| Metrics | `GET /metrics` (Prometheus) |

### 7.3 WebSocket Protocol (Defined in `protocol.go`)

#### Agent → Server Messages

| Type | Struct | Purpose |
|------|--------|---------|
| `heartbeat` | `HeartbeatMessage` | Liveness check (agent_id, timestamp) |
| `agent_info` | `AgentInfoMessage` | System info update (system, ip, version) |
| `transfer_progress` | `TransferProgressMessage` | Progress update (current_chunk, total_chunks, bytes_per_second, ETA) |
| `transfer_complete` | `TransferCompleteMessage` | Completion notification (transfer_id, duration) |
| `transfer_error` | `TransferErrorMessage` | Error report (transfer_id, error string) |

#### Server → Agent Messages

| Type | Struct | Purpose |
|------|--------|---------|
| `transfer_request` | `TransferRequestMessage` | Start a transfer (job_id, paths, compression, chunk_size, type) |
| `cancel_transfer` | `CancelTransferMessage` | Cancel in-progress transfer |
| `connection_test` | `ConnectionTestMessage` | Connectivity check (request_id) |

---

## 8. Configuration

### 8.1 Backend Configuration

**File:** `backend/config.yaml`  
**Loader:** `backend/internal/config/config.go` — `LoadConfig(filePath string)`  
**Priority:** Environment variables override YAML values.

```yaml
server:
  port: 3001              # REST API port
  websocket_port: 3002    # WebSocket port for agents
  host: "0.0.0.0"

database:
  host: "db"              # Docker service name
  port: 5432
  user: "fileflux"
  password: "fileflux"
  database: "fileflux"
  sslmode: "disable"

auth:
  jwt_secret: "fileflux-secret-key"   # ⚠️ Change in production
  token_expires_in: 24                # Hours

logging:
  level: "info"
  file: "fileflux.log"
```

**Environment Variables (from docker-compose.yml):**

| Variable | Default | Purpose |
|----------|---------|---------|
| `DB_HOST` | `db` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `fileflux` | DB username |
| `DB_PASSWORD` | `fileflux` | DB password |
| `DB_NAME` | `fileflux` | DB name |
| `DB_SSLMODE` | `disable` | SSL mode |
| `JWT_SECRET` | — | JWT signing key |
| `SERVER_PORT` | `3001` | REST API port |
| `WEBSOCKET_PORT` | `3002` | WebSocket port |
| `LOG_LEVEL` | `info` | Log level |
| `LOG_FORMAT` | `json` | Log format |
| `ENV` | `production` | Environment |

### 8.2 Agent Configuration

**File:** `agent/config.yaml`  
**Loader:** `agent/internal/config/config.go` — `LoadConfig(filePath string)`

```yaml
agent:
  name: "FileFlux-Agent"
  type: "client"                       # "client" or "server"
  description: "Default agent"

connection:
  server_url: "ws://backend:3002/ws/agent"
  token: "demo-token"                  # Agent auth token
  heartbeat_interval: 60               # Seconds
  reconnect_attempts: 5
  reconnect_delay: 10                  # Seconds

transfers:
  chunk_size: 8                        # MB
  concurrent_transfers: 3
  compression: true
  temp_dir: "/tmp/fileflux"
  base_dir: "/data"

logging:
  level: "info"
  file: "fileflux-agent.log"
  max_size: 10                         # MB
  max_backups: 3
  max_age: 7                           # Days
```

### 8.3 Docker Compose Configuration

**File:** `docker-compose.yml`

| Service | Image/Build | Ports | Networks |
|---------|------------|-------|----------|
| `db` | `postgres:16-alpine` | internal | `backend-net` |
| `backend` | `./backend/Dockerfile` | 3001, 3002 | `backend-net`, `frontend-net` |
| `frontend` | `./frontend/Dockerfile` | 3000 → 80 | `frontend-net` |
| `agent-central` | `./agent/Dockerfile` | — | `backend-net` |

**Volumes:** `postgres-data`, `agent-data`  
**Networks:** `backend-net` (bridge), `frontend-net` (bridge)

### 8.4 Other Config Files

| File | Purpose |
|------|---------|
| `backend/config.yml` | Alternate config (may contain job definitions for file_transfer_service) |
| `frontend/vite.config.ts` | Vite build config |
| `frontend/tsconfig.json` | TypeScript config |
| `frontend/nginx.conf` | Production Nginx config |
| `monitoring/prometheus/prometheus.yml` | Prometheus scrape targets |
| `monitoring/grafana/provisioning/datasources.yml` | Grafana data source config |
| `monitoring/grafana/provisioning/dashboards.yml` | Grafana dashboard provisioning |
| `deploy/helm/fileflux/values.yaml` | Helm default values |
| `deploy/helm/fileflux/Chart.yaml` | Helm chart metadata |

---

## 9. Development Environment

### 9.1 Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Go | ≥ 1.21 | Backend + Agent |
| Node.js | ≥ 18 | Frontend build |
| Docker | ≥ 24 | Container runtime |
| Docker Compose | v2 | Service orchestration |
| Make | any | Build automation |

### 9.2 Quick Start

```bash
# Clone repository
git clone https://github.com/stefanposs/file-flux.git
cd file-flux

# Start all services
docker compose up -d

# Check service health
docker compose ps

# Access:
#   Frontend:  http://localhost:3000
#   REST API:  http://localhost:3001/api
#   WebSocket: ws://localhost:3002/ws/agent
```

### 9.3 Local Development (Native)

```bash
# Backend
cd backend
go mod tidy
go run ./cmd/server     # ⚠️ Requires fixing import paths first

# Frontend
cd frontend
npm ci
npm run dev             # Vite dev server on http://localhost:5173

# Agent
cd agent
go mod tidy
go run ./cmd/agent --config config.yaml
```

### 9.4 Build Commands (Root Makefile)

| Command | Action |
|---------|--------|
| `make` / `make build` | Build all components |
| `make test` | Run all tests (currently nothing passes) |
| `make lint` | Lint all components (requires golangci-lint, eslint) |
| `make docker` | Build all Docker images |
| `make up` | `docker compose up -d` |
| `make down` | `docker compose down` |
| `make up-prod` | Start with production overrides |
| `make db-migrate` | Run golang-migrate (not yet set up) |
| `make db-reset` | Destroy and recreate database |
| `make agent-cross` | Cross-compile agent for 5 targets |
| `make release` | Full release: lint + test + agent-cross + docker |
| `make clean` | Remove all build artifacts |

### 9.5 Default Credentials

| Service | Username/Email | Password | Notes |
|---------|---------------|----------|-------|
| Admin User | `admin@fileflux.de` | (bcrypt hash in schema.sql) | Auto-created by schema |
| Database | `fileflux` | `fileflux` | Docker Compose default |

---

## 10. Decision Log (ADRs)

All ADRs are documented in `docs/ARCHITECTURE.md`, Section 12.

| ADR | Title | Status | Date | Rationale |
|-----|-------|--------|------|-----------|
| **ADR-001** | Consolidate on gorilla/mux + raw SQL; delete gin/GORM/Node.js | Accepted | 2026-02-12 | 3 competing code paths cause confusion and broken imports. gorilla/mux is the active stack. Delete dormant gin/GORM code (Path B) and dead Node.js code (Path C). Adopt Path B's good patterns (interfaces, context, UUIDs). |
| **ADR-002** | In-process event bus (not Kafka/NATS) | Accepted | 2026-02-12 | Self-hosted simplicity. Pluggable `EventSink` interface allows external brokers later. No operational overhead. |
| **ADR-003** | Backend relays file chunks (Phase 1) | Accepted | 2026-02-12 | Simpler than peer-to-peer. Works through firewalls/NAT. Direct agent-to-agent planned for Phase 5+. |
| **ADR-004** | Binary WebSocket frames for chunk data | Accepted | 2026-02-12 | 33% bandwidth savings vs base64-encoded JSON. Custom frame format: `[4B length][1B type][8B transfer_id][4B chunk_idx][32B sha256][payload]`. |
| **ADR-005** | SHA-256 checksums at chunk + whole-file level | Accepted | 2026-02-12 | Enterprise compliance. Chunk-level hashing enables resumption from last verified chunk. |
| **ADR-006** | SSE for frontend real-time updates | Accepted | 2026-02-12 | Simpler than WebSocket for read-only event streams. Built on standard HTTP. Auto-reconnect. |
| **ADR-007** | Keep Lit Web Components | Accepted | 2026-02-12 | 7KB bundle vs 40KB+ React. Already invested. Web standards. Enterprise-friendly. |
| **ADR-008** | golang-migrate for DB migrations | Accepted | 2026-02-12 | Versioned, reversible SQL migrations. CI-checkable. Industry standard for Go. Replaces current raw `schema.sql` exec. |
| **ADR-009** | Structured logging with log/slog (stdlib) | Accepted | 2026-02-12 | Zero external dependencies. JSON output for log aggregation. Replaces current `log.Logger` and dormant `zap.Logger`. |
| **ADR-010** | robfig/cron/v3 for scheduling | Accepted | 2026-02-12 | In-process, no external infrastructure. Mature library. Cron expressions already stored in `jobs.schedule` column. |

### Decision Chronology

| Date | Decision | Impact |
|------|----------|--------|
| Pre-2026 | Chose Go for backend + agent | Foundation: single-binary deploy, excellent concurrency |
| Pre-2026 | Chose Lit Web Components for frontend | 7KB bundle, Web standards, no framework lock-in |
| Pre-2026 | Chose PostgreSQL for persistence | ACID, JSONB, mature ecosystem |
| Pre-2026 | Prototyped with Auth0 + Stripe (SaaS model) | ❌ Abandoned — pivot to self-hosted |
| Pre-2026 | Created Node.js prototype (`backend/src/`) | ❌ Abandoned — consolidated into Go |
| Pre-2026 | Added gin + GORM as alternative architecture | ❌ Abandoned — ADR-001 consolidates on gorilla/mux |
| 2026-02-12 | Accepted ADR-001 through ADR-010 | Architectural foundation for Phase 0+ |
| 2026-02-12 | Created Master Plan (5 phases, 18-24 weeks) | Implementation roadmap |

### Open Questions

- [ ] How to handle cross-service transactions when backend relays between agents?
- [ ] Schema migration strategy: migrate existing `schema.sql` data or clean start?
- [ ] Agent auto-update mechanism — binary replacement vs package manager?
- [ ] Multi-tenancy: per-user isolation or shared tenancy?
- [ ] License model: open-source core + enterprise features, or fully proprietary?

---

## 11. Known Issues & Tech Debt

### Priority: 🔴 Critical (Fix Before Anything Else)

| # | Issue | Location | Details | Fix |
|---|-------|----------|---------|-----|
| 1 | **Auth bypass — hardcoded token validation** | `backend/internal/websocket/manager.go:121` | `validateToken()` always returns `(1, nil)`. ANY token is accepted. Any agent gets ID 1. | Implement actual DB lookup in `tokens` table. |
| 2 | **Auth middleware is empty** | `backend/internal/middleware/auth.go` | `Auth()` wraps `next` but does nothing — all "protected" routes are publicly accessible. | Implement JWT validation with `golang-jwt/jwt/v5`. |
| 3 | **In-memory file storage** | `backend/internal/services/file_transfer_service.go:25` | `fileStorage = make(map[string][]byte)` — global var, 10 MB limit, data lost on restart. | Replace with chunked WebSocket transfer engine. |
| 4 | **Broken import paths (your-username)** | `backend/internal/handlers/job_handler.go:11`, `auth/auth0.go:13`, `payment/stripe.go:10` | Import path `github.com/your-username/fileflux/...` is a placeholder template. Code won't compile. | Fix to actual module path or delete dead code (ADR-001). |
| 5 | **Module path mismatch** | `backend/go.mod` vs `backend/internal/api/router.go` | `go.mod` says `github.com/stefanposs/file-flux/backend`, but router imports `fileflux/backend/internal/...` (short form). Depending on Go toolchain behavior, may compile locally but fail in CI. | Align all imports to single module path. |

### Priority: 🟡 Major (Phase 0 Cleanup)

| # | Issue | Location | Details |
|---|-------|----------|---------|
| 6 | **Three competing architectures** | See §3.1 | Path A (gorilla/mux), Path B (gin/GORM), Path C (Node.js) all in same repo. Delete B and C per ADR-001. |
| 7 | **Dual go.mod dependencies** | `backend/go.mod` | Has both gorilla/mux AND gin + GORM. Bloated binary, confusing dependency graph. |
| 8 | **No tests** | Entire codebase | Zero test files across backend, frontend, agent. |
| 9 | **Two competing entry points** | `backend/cmd/main.go`, `backend/cmd/server/main.go` | Each uses different architecture. Consolidate into single `cmd/server/main.go`. |
| 10 | **User model has Auth0/Stripe fields** | `backend/internal/models/user.go` | `Auth0ID`, `StripeCustomerID`, `SubscriptionTier` — SaaS baggage in self-hosted product. |
| 11 | **WebSocket transfer handlers are TODO stubs** | `backend/internal/websocket/manager.go:212-253` | `transfer_progress`, `transfer_complete`, `transfer_error` cases have `// TODO` comments, no DB writes. |
| 12 | **Agent transfer manager is empty** | `agent/internal/transfer/` | Directory exists but no implementation files. |

### Priority: 🟠 Moderate (Phase 1-2)

| # | Issue | Location | Details |
|---|-------|----------|---------|
| 13 | No structured logging | Backend + Agent | Using `log.Logger` and `log.Printf` everywhere. Should be `log/slog` (ADR-009). |
| 14 | No database migrations | `backend/internal/db/database.go:55` | Schema applied via raw `ioutil.ReadFile` + `db.Exec`. Should use golang-migrate (ADR-008). |
| 15 | Monolithic `app.ts` | `frontend/src/app.ts` | 507 lines with switch-based routing. Needs declarative router with lazy loading. |
| 16 | No health/readiness endpoints | Backend | Docker Compose health check calls `/health` which doesn't exist — relies on `wget --spider` succeeding on any 200 response. |
| 17 | Frontend has no real API client | `frontend/src/` | API calls likely inline; no centralized error handling or auth token management. |
| 18 | No CORS configuration in active router | `backend/internal/api/router.go` | Custom `middleware.CORS` exists but quality unknown. Path B uses `github.com/rs/cors`. |
| 19 | Hardcoded JWT secret | `backend/config.yaml` | `jwt_secret: "fileflux-secret-key"` — must be env-overridden in production. |
| 20 | Default admin password in schema | `backend/internal/db/schema.sql` | Hardcoded bcrypt hash for `admin@fileflux.de`. Should be set via first-run setup. |

---

## 12. Dependencies

### 12.1 Backend (`backend/go.mod`)

**Module:** `github.com/stefanposs/file-flux/backend`  
**Go version:** 1.21

| Dependency | Version | Status | Purpose |
|-----------|---------|--------|---------|
| `github.com/gorilla/mux` | 1.8.1 | ✅ Keep (ADR-001) | HTTP router |
| `github.com/gorilla/websocket` | (transient) | ✅ Keep | WebSocket support |
| `github.com/lib/pq` | (transient) | ✅ Keep | PostgreSQL driver |
| `github.com/gin-gonic/gin` | 1.9.1 | ❌ Remove (ADR-001) | Dead code (Path B) |
| `gorm.io/gorm` | 1.25.4 | ❌ Remove (ADR-001) | Dead code (Path B) |
| `gorm.io/driver/postgres` | 1.5.2 | ❌ Remove (ADR-001) | Dead code (Path B) |
| `go.uber.org/zap` | 1.26.0 | ❌ Remove (ADR-009) | Replace with log/slog |
| `github.com/google/uuid` | 1.3.1 | ✅ Keep | UUID generation |
| `github.com/stretchr/testify` | 1.8.4 | ✅ Keep | Test assertions |
| `golang.org/x/crypto` | 0.23.0 | ✅ Keep | bcrypt password hashing |
| `gopkg.in/yaml.v3` | 3.0.1 | ✅ Keep | YAML config parsing |

**Dependencies to ADD (from Master Plan):**

| Dependency | Purpose |
|-----------|---------|
| `golang-jwt/jwt/v5` | JWT auth (replace empty middleware) |
| `golang-migrate/migrate/v4` | Database migrations (ADR-008) |
| `robfig/cron/v3` | Job scheduling (ADR-010) |
| `klauspost/compress` | zstd compression |
| `pierrec/lz4/v4` | LZ4 compression |
| `prometheus/client_golang` | Metrics endpoint |

### 12.2 Agent (`agent/go.mod`)

**Module:** `github.com/stefanposs/file-flux/agent`  
**Go version:** 1.21

| Dependency | Version | Purpose |
|-----------|---------|---------|
| `github.com/fsnotify/fsnotify` | 1.6.0 | File system watching (for file watcher feature) |
| `github.com/spf13/viper` | 1.16.0 | Config management |
| `go.uber.org/zap` | 1.26.0 | Structured logging (should migrate to slog per ADR-009) |

**Note:** Agent `go.mod` imports do NOT match actual code (`agent/internal/config/config.go` uses `gopkg.in/yaml.v2`, not viper).

### 12.3 Frontend (`frontend/package.json`)

**Package:** `file-flux-frontend` v0.1.0

| Dependency | Version | Purpose |
|-----------|---------|---------|
| `lit` | ^2.6.1 | Web Components framework |
| `typescript` | ^4.9.5 (dev) | Type checking |
| `vite` | ^6.2.2 (dev) | Build tool + dev server |

**Dependencies to ADD (from Master Plan):**

| Dependency | Purpose |
|-----------|---------|
| `chart.js` | Analytics charts |
| `@open-wc/testing` | Web Component test utilities |
| `vitest` | Test runner |

---

## 13. Documentation Index

| Document | Path | Contents | Status |
|----------|------|----------|--------|
| **Project Context** (this file) | `docs/PROJECT_CONTEXT.md` | Single source of truth for all project context | ✅ Current |
| **Master Plan** | `docs/MASTER_PLAN.md` | 5-phase, 18-24 week implementation roadmap with task breakdown | ✅ Complete |
| **Architecture** | `docs/ARCHITECTURE.md` | Architecture design document, C4 diagrams, 10 ADRs, migration roadmap | ✅ Complete |
| **Concept** | `docs/CONCEPT.md` | Original product vision, functional requirements, pricing model | ✅ Reference |
| **DevOps** | `docs/DEVOPS.md` | Docker, CI/CD, monitoring, deployment plans | ✅ Complete |
| **Test Strategy** | `docs/TEST_STRATEGY.md` | ~355 planned tests, 80% coverage target, test categories | ✅ Complete |
| **Stakeholder Analysis** | `docs/STAKEHOLDER_BUSINESS_ANALYSIS.md` | Business goals, personas, MVP scope | ✅ Reference |
| **Competitors** | `docs/COMPETITORS.md` | Competitive analysis (Stonebranch, GoAnywhere, etc.) | ✅ Reference |
| **Success Stories** | `docs/SUCCESS_STORIES.md` | Use case examples | ✅ Reference |
| **Frontend Plan** | `docs/FRONTEND_IMPLEMENTATION_PLAN.md` | Frontend rebuild plan | ✅ Complete |
| **Agent Plan** | `agent/IMPLEMENTATION_PLAN.md` | Agent implementation details | ✅ Complete |
| **Backend README** | `backend/README.md` | Backend quickstart | ⚠️ May be outdated |
| **Frontend README** | `frontend/README.md` | Frontend quickstart | ⚠️ May be outdated |
| **Agent README** | `agent/README.md` | Agent quickstart | ⚠️ May be outdated |
| **Root README** | `README.md` | Project overview | ⚠️ May be outdated |
| **Helm README** | `deploy/helm/fileflux/README.md` | Helm chart usage | ⚠️ Scaffold |

### Relationship Between Documents

```
PROJECT_CONTEXT.md  ← You are here (single source of truth)
    │
    ├── MASTER_PLAN.md        (what to build, in what order)
    ├── ARCHITECTURE.md       (how to build it, ADRs)
    ├── TEST_STRATEGY.md      (how to verify it)
    ├── DEVOPS.md             (how to deploy it)
    ├── FRONTEND_IMPLEMENTATION_PLAN.md  (frontend specifics)
    ├── agent/IMPLEMENTATION_PLAN.md     (agent specifics)
    │
    └── Reference docs (context, not actionable):
        ├── CONCEPT.md
        ├── STAKEHOLDER_BUSINESS_ANALYSIS.md
        ├── COMPETITORS.md
        └── SUCCESS_STORIES.md
```

---

## Appendix A: Database Schema (Current)

```sql
-- 5 tables, SERIAL integer PKs, no UUIDs, no updated_at columns

users          (id SERIAL PK, name, email UNIQUE, password_hash, role, created_at, last_login)
agents         (id SERIAL PK, name, type, status, ip_address, system, version, last_seen, description, created_at)
tokens         (id SERIAL PK, agent_id FK→agents, name, token_value UNIQUE, created_at, expires_at, last_used, description)
jobs           (id SERIAL PK, name, type, status, schedule, source_path, destination_path, source_agent_id FK, destination_agent_id FK, last_run, next_run, description, created_at)
transfers      (id SERIAL PK, job_id FK→jobs, filename, size, status, source_path, destination_path, source_agent_id FK, destination_agent_id FK, start_time, end_time, error, created_at)
```

**Note:** The Go models in `internal/models/` add fields not in the SQL schema (`UserID`, `Compressed`, `ChunkSize`, `TotalChunks`, `CompletedChunks` on Job/Transfer). These need to be reconciled during migration setup (Phase 0).

---

## Appendix B: Key File Paths Quick Reference

```
backend/
├── cmd/main.go                              # Entry point (Path B — broken, to delete)
├── cmd/server/main.go                       # Entry point (Path B — broken, to delete)
├── internal/api/router.go                   # ★ Active router — all routes defined here
├── internal/config/config.go                # ★ Active config loader (YAML + env)
├── internal/db/database.go                  # ★ Active DB layer (raw SQL)
├── internal/db/schema.sql                   # ★ Active DDL (5 tables)
├── internal/handlers/auth_handler.go        # Auth endpoints (stub)
├── internal/handlers/job_handler.go         # Job endpoints (broken imports)
├── internal/handlers/file_transfer.go       # File upload/download (in-memory, broken imports)
├── internal/middleware/auth.go              # JWT middleware (empty body)
├── internal/models/{models,job,transfer,user}.go  # ★ Active domain models
├── internal/websocket/manager.go            # ★ WebSocket lifecycle (auth bypass)
├── internal/websocket/protocol.go           # ★ WebSocket message types
├── internal/services/file_transfer_service.go  # In-memory file service (10MB limit)
├── internal/auth/{auth,auth0}.go            # Dead code (Auth0)
├── internal/payment/stripe.go               # Dead code (Stripe)
├── internal/database/db.go                  # Dormant (interface-based, good patterns)
├── pkg/api/server.go                        # Dormant (gin server)
├── pkg/domain/jobs/model.go                 # Dormant (GORM models)
├── pkg/domain/agents/model.go               # Dormant (GORM models)
├── src/server.js                            # Dead (Node.js prototype)
└── config.yaml                              # ★ Active config file

frontend/
├── src/app.ts                               # ★ Root component (507 lines)
├── src/main.ts                              # Entry point
├── src/demo-mode.ts                         # Demo data provider
├── src/components/                          # All UI components
└── package.json                             # Dependencies

agent/
├── cmd/agent/main.go                        # ★ Entry point
├── internal/config/config.go                # ★ Config loader
├── internal/system/sysinfo.go               # ★ System info collector
├── internal/transfer/                       # Empty (to implement)
└── config.yaml                              # ★ Agent config
```

---

*This document is maintained by the Context Manager Agent. Update after every significant decision, merge, or architecture change.*
