# File Flux — Architecture Design Document

**Version:** 1.0  
**Date:** 2026-02-12  
**Status:** Proposed  
**Author:** Lead Architect

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Assessment](#2-current-state-assessment)
3. [System Overview](#3-system-overview)
4. [Component Architecture](#4-component-architecture)
5. [Data Model](#5-data-model)
6. [Communication Protocols](#6-communication-protocols)
7. [Transfer Engine Design](#7-transfer-engine-design)
8. [Event System Design](#8-event-system-design)
9. [Security Architecture](#9-security-architecture)
10. [Deployment Architecture](#10-deployment-architecture)
11. [Technology Decisions](#11-technology-decisions)
12. [Architecture Decision Records](#12-architecture-decision-records)
13. [Migration Roadmap](#13-migration-roadmap)

---

## 1. Executive Summary

File Flux is a self-hosted Managed File Transfer (MFT) platform targeting mid-market enterprises. It orchestrates file transfer jobs between N source agents and M destination agents over a central backend. The system must support bidirectional push/pull transfers, cron-based scheduling, chunked & compressed streaming, real-time progress monitoring, and enterprise-grade security.

This document defines the target architecture, identifies gaps in the current codebase, prescribes the necessary structural changes, and provides Architecture Decision Records for every significant choice.

### Key Architectural Principles

- **Agent-Mediated Transfer** — All file data flows through agents; the backend is a control plane, not a data plane.
- **Event-Driven Core** — Every state change emits a domain event; external integrations consume events via webhooks.
- **Resumable by Default** — Every transfer is chunked; every chunk is hash-verified; resumption is a first-class capability.
- **Single Binary Deployment** — Backend ships as one Go binary; Agent ships as one Go binary. No JVM, no runtime dependencies.

---

## 2. Current State Assessment

### 2.1 What Works

| Component | Status | Notes |
|-----------|--------|-------|
| REST API routing | ✅ Working | gorilla/mux, 5 resource groups (auth, agents, jobs, transfers, tokens) |
| PostgreSQL schema | ✅ Working | 5 tables, raw SQL migrations |
| WebSocket agent connection | ✅ Working | Token-based auth, heartbeat, bidirectional messaging |
| Frontend SPA | ✅ Working | Lit-based, 10+ components, demo mode, routing |
| Agent CLI | ✅ Working | WebSocket client, sysinfo, config via YAML |
| Docker Compose | ✅ Working | 4 services (db, backend, frontend, agent) |

### 2.2 Critical Gaps

| Gap | Severity | Current State |
|-----|----------|---------------|
| Token validation | 🔴 Critical | Hardcoded `return 1, nil` — no actual DB lookup |
| File transfer engine | 🔴 Critical | In-memory buffer (`map[string][]byte`), 10 MB limit, no chunking |
| Job scheduler | 🔴 Critical | Cron field exists in DB but no scheduler implementation |
| Dual architecture | 🟡 Major | Two competing patterns: `internal/db/` (raw SQL + gorilla/mux) vs. `pkg/domain/` (GORM + gin). Must consolidate |
| Dual go.mod dependencies | 🟡 Major | Both `gorilla/mux` AND `gin-gonic/gin` + `gorm` in backend go.mod |
| Transfer progress persistence | 🟡 Major | WebSocket handler has TODO stubs for progress/complete/error |
| RBAC | 🟡 Major | Only `admin`/`user` roles; no resource-level permissions |
| Compression | 🟠 Moderate | Config flag exists but no compression implementation |
| Chunking | 🟠 Moderate | `ChunkSize` field exists in models but no chunking logic |
| Audit logging | 🟠 Moderate | No audit trail |
| Agent groups | 🟠 Moderate | No grouping mechanism |
| Retry/error handling | 🟠 Moderate | No retry policies |
| Event system | 🟠 Moderate | `JobEvent` model exists in `pkg/domain/` but no event bus |

### 2.3 Architecture Debt

The codebase contains **two parallel architectures** that must be consolidated:

```
Path A (Active — used by router.go):
  internal/db/database.go      → raw *sql.DB, hand-written SQL
  internal/models/             → plain structs with json/db tags
  internal/handlers/           → gorilla/mux handlers
  internal/api/router.go       → gorilla/mux router

Path B (Dormant — not wired):
  pkg/domain/jobs/model.go     → GORM models with uuid.UUID PKs
  pkg/domain/agents/model.go   → GORM models
  internal/database/db.go      → interface-based, uuid PKs, context-aware
  backend go.mod               → gin-gonic/gin, gorm dependencies
```

**Decision:** Consolidate on Path A's stack (gorilla/mux, raw SQL) but adopt Path B's patterns (interfaces, context, UUIDs). See ADR-001.

---

## 3. System Overview

### 3.1 System Context Diagram

```
┌─────────────┐         HTTPS/WSS          ┌──────────────────────┐
│  Enterprise  │◄──────────────────────────►│    File Flux         │
│  Admin UI    │         REST API           │    Backend           │
│  (Browser)   │                            │    (Control Plane)   │
└─────────────┘                             └──────┬───┬───────────┘
                                                   │   │
                                    ┌──────────────┘   └──────────────┐
                                    │ WebSocket                       │ WebSocket
                                    ▼                                 ▼
                            ┌───────────────┐                 ┌───────────────┐
                            │  Agent A      │    Peer-to-Peer │  Agent B      │
                            │  (Source)     │◄───────────────►│  (Destination)│
                            │  Linux/Win   │   Data Stream    │  Linux/Win   │
                            └───────┬───────┘   (TCP/TLS)     └───────┬───────┘
                                    │                                 │
                                    ▼                                 ▼
                            ┌───────────────┐                 ┌───────────────┐
                            │  Local FS /   │                 │  Local FS /   │
                            │  NFS / SMB    │                 │  NFS / SMB    │
                            └───────────────┘                 └───────────────┘
```

### 3.2 Container Diagram (C4 Level 2)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        File Flux Platform                           │
│                                                                     │
│  ┌──────────────┐   ┌────────────────────────────────────────────┐  │
│  │   Frontend   │   │              Backend (Go)                  │  │
│  │   (Lit/TS)   │   │                                            │  │
│  │              │   │  ┌──────────┐ ┌───────────┐ ┌───────────┐  │  │
│  │  Dashboard   │──►│  │ REST API │ │ Scheduler │ │ WS Manager│  │  │
│  │  Jobs        │   │  │ (mux)   │ │ (cron)    │ │           │  │  │
│  │  Agents      │   │  └────┬─────┘ └─────┬─────┘ └─────┬─────┘  │  │
│  │  Transfers   │   │       │             │             │        │  │
│  │  Tokens      │   │  ┌────▼─────────────▼─────────────▼─────┐  │  │
│  │  Settings    │   │  │          Event Bus (in-process)       │  │  │
│  └──────────────┘   │  └────┬───────────────────────────┬─────┘  │  │
│                     │       │                           │        │  │
│                     │  ┌────▼─────┐  ┌──────────┐ ┌─────▼──────┐ │  │
│                     │  │ Transfer │  │ Webhook  │ │ Audit Log  │ │  │
│                     │  │ Engine   │  │ Notifier │ │ Writer     │ │  │
│                     │  └────┬─────┘  └──────────┘ └────────────┘ │  │
│                     │       │                                    │  │
│                     │  ┌────▼─────┐                              │  │
│                     │  │PostgreSQL│                              │  │
│                     │  └──────────┘                              │  │
│                     └────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Agent 1    │  │   Agent 2    │  │   Agent N    │              │
│  │  (Go binary) │  │  (Go binary) │  │  (Go binary) │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.3 Data Flow — File Transfer (Push)

```
 Source Agent                   Backend                    Dest Agent
     │                            │                            │
     │  1. WS: transfer_start     │                            │
     │◄───────────────────────────│  Job scheduled/triggered   │
     │                            │                            │
     │  2. Read file, chunk,      │                            │
     │     compress, hash         │                            │
     │                            │                            │
     │  3. WS: chunk_ready        │                            │
     │───────────────────────────►│                            │
     │                            │  4. WS: chunk_relay        │
     │                            │───────────────────────────►│
     │                            │                            │
     │                            │  5. WS: chunk_ack          │
     │                            │◄───────────────────────────│
     │  6. WS: chunk_ack          │                            │
     │◄───────────────────────────│                            │
     │                            │                            │
     │  ... repeat for N chunks   │                            │
     │                            │                            │
     │  7. WS: transfer_complete  │                            │
     │───────────────────────────►│  8. Verify integrity       │
     │                            │  9. Emit event             │
     │                            │  10. Update DB             │
     │                            │                            │
```

> **Important architectural choice:** For Phase 1, file data flows through the backend as a relay (simplifies firewall/NAT traversal). Phase 2 introduces optional direct agent-to-agent streaming when both agents are on the same network.

---

## 4. Component Architecture

### 4.1 Backend — Package Structure (Target)

```
backend/
├── cmd/
│   └── server/
│       └── main.go                  # Entry point, DI wiring
├── internal/
│   ├── api/
│   │   ├── router.go                # HTTP router (gorilla/mux) ← KEEP
│   │   ├── middleware/
│   │   │   ├── auth.go              # JWT validation
│   │   │   ├── rbac.go              # NEW: Role-based access control
│   │   │   ├── cors.go              # CORS
│   │   │   ├── logging.go           # Request logging
│   │   │   └── recovery.go          # Panic recovery
│   │   └── handlers/
│   │       ├── auth_handler.go
│   │       ├── agent_handler.go
│   │       ├── job_handler.go
│   │       ├── transfer_handler.go
│   │       ├── token_handler.go
│   │       ├── webhook_handler.go   # NEW
│   │       ├── audit_handler.go     # NEW
│   │       └── settings_handler.go  # NEW
│   ├── domain/                      # NEW: Domain layer (DDD)
│   │   ├── agent/
│   │   │   ├── model.go
│   │   │   ├── repository.go        # Interface
│   │   │   └── service.go
│   │   ├── job/
│   │   │   ├── model.go
│   │   │   ├── repository.go
│   │   │   └── service.go
│   │   ├── transfer/
│   │   │   ├── model.go
│   │   │   ├── chunk.go             # NEW: Chunk model
│   │   │   ├── repository.go
│   │   │   └── service.go
│   │   ├── event/
│   │   │   ├── model.go             # NEW: Domain events
│   │   │   ├── bus.go               # NEW: In-process event bus
│   │   │   └── handlers.go          # NEW: Event handlers
│   │   ├── user/
│   │   │   ├── model.go
│   │   │   └── repository.go
│   │   └── notification/
│   │       ├── model.go             # NEW
│   │       └── webhook.go           # NEW
│   ├── infrastructure/              # NEW: Infrastructure layer
│   │   ├── postgres/
│   │   │   ├── connection.go
│   │   │   ├── migrations/          # NEW: Versioned migrations
│   │   │   │   ├── 001_initial.sql
│   │   │   │   ├── 002_agent_groups.sql
│   │   │   │   ├── 003_audit_log.sql
│   │   │   │   └── ...
│   │   │   ├── agent_repo.go        # Implements domain/agent/repository.go
│   │   │   ├── job_repo.go
│   │   │   ├── transfer_repo.go
│   │   │   └── user_repo.go
│   │   └── websocket/
│   │       ├── manager.go           # ← KEEP, refactor
│   │       └── protocol.go          # ← KEEP, extend
│   ├── scheduler/                   # NEW: Job scheduling engine
│   │   ├── scheduler.go
│   │   ├── cron.go
│   │   └── trigger.go
│   └── transfer/                    # NEW: Transfer engine
│       ├── engine.go                # Orchestrates transfers
│       ├── chunker.go               # File → chunks
│       ├── compressor.go            # zstd/LZ4 compression
│       ├── hasher.go                # SHA-256 integrity
│       └── relay.go                 # Backend relay logic
├── pkg/                             # Public packages (shared with agent)
│   └── protocol/
│       ├── messages.go              # Shared WS message types
│       └── chunks.go                # Shared chunk format
└── go.mod
```

#### Key Structural Changes

1. **Delete** `internal/database/` — dormant GORM-based code, unused
2. **Delete** `pkg/domain/` — dormant GORM models, consolidate into `internal/domain/`
3. **Promote** `internal/db/` → `internal/infrastructure/postgres/` — keep raw SQL, add repository interfaces
4. **Move** `internal/handlers/` → `internal/api/handlers/`
5. **Move** `internal/middleware/` → `internal/api/middleware/`
6. **Add** `internal/domain/` — clean domain models, repository interfaces, services
7. **Add** `internal/scheduler/` — cron-based job scheduling
8. **Add** `internal/transfer/` — chunking, compression, hashing engine
9. **Remove** `gin-gonic/gin` and `gorm` from `go.mod` — standardize on gorilla/mux + raw SQL

### 4.2 Agent — Package Structure (Target)

```
agent/
├── cmd/
│   └── agent/
│       └── main.go                  # ← KEEP
├── internal/
│   ├── config/
│   │   └── config.go                # ← KEEP
│   ├── system/
│   │   └── sysinfo.go               # ← KEEP
│   ├── websocket/
│   │   ├── client.go                # ← KEEP, extend
│   │   └── reconnect.go             # NEW: Exponential backoff
│   ├── transfer/
│   │   ├── manager.go               # ← KEEP, refactor
│   │   ├── chunker.go               # NEW: Mirrors backend chunker
│   │   ├── compressor.go            # NEW: zstd/LZ4
│   │   ├── hasher.go                # NEW: SHA-256
│   │   └── resumable.go             # NEW: Resume tracking
│   ├── watcher/                     # NEW: File system watcher
│   │   └── watcher.go               # fsnotify-based
│   └── protocols/                   # NEW: Protocol adapters
│       ├── local.go                 # Local filesystem
│       ├── sftp.go                  # SFTP client
│       └── s3.go                    # S3-compatible storage
└── go.mod
```

### 4.3 Frontend — Component Architecture (Target)

```
frontend/src/
├── app.ts                           # ← KEEP, refactor routing
├── main.ts                          # ← KEEP
├── services/                        # NEW: API service layer
│   ├── api-client.ts                # HTTP client with auth
│   ├── websocket-client.ts          # Real-time updates
│   ├── auth-service.ts
│   └── notification-service.ts
├── stores/                          # NEW: State management
│   ├── auth-store.ts
│   ├── job-store.ts
│   ├── agent-store.ts
│   └── transfer-store.ts
├── components/
│   ├── shared/
│   │   ├── header.ts                # ← KEEP
│   │   ├── sidebar-navigation.ts    # ← KEEP
│   │   ├── data-table.ts            # NEW: Reusable table
│   │   ├── status-badge.ts          # NEW
│   │   └── toast-notification.ts    # NEW
│   ├── dashboard/
│   │   ├── dashboard.ts             # ← KEEP, enhance
│   │   ├── transfer-chart.ts        # NEW: Transfer volume chart
│   │   └── agent-status-grid.ts     # NEW
│   ├── jobs/
│   │   ├── job-list.ts              # ← KEEP
│   │   ├── job-detail.ts            # ← KEEP
│   │   ├── job-form.ts              # NEW: Create/edit form
│   │   └── cron-editor.ts           # NEW: Visual cron builder
│   ├── agents/
│   │   ├── agent-list.ts            # ← KEEP
│   │   ├── agent-detail.ts          # ← KEEP
│   │   └── agent-group-manager.ts   # NEW
│   ├── transfers/
│   │   ├── transfer-list.ts         # ← KEEP
│   │   ├── transfer-detail.ts       # ← KEEP
│   │   └── transfer-progress.ts     # NEW: Real-time progress bar
│   ├── settings/                    # NEW
│   │   ├── webhook-config.ts
│   │   ├── notification-rules.ts
│   │   └── user-management.ts
│   └── audit/                       # NEW
│       └── audit-log.ts
└── utils/
    ├── color-picker.ts              # ← KEEP
    └── formatters.ts                # NEW: Size, date, duration formatters
```

---

## 5. Data Model

### 5.1 Enhanced Schema

The following shows additions and modifications to the existing schema. **Existing tables are marked; new tables are prefixed with `NEW`.**

```sql
-- ============================================================
-- EXISTING TABLES — MODIFICATIONS
-- ============================================================

-- agents: Add group support, tags, capabilities
ALTER TABLE agents ADD COLUMN agent_group_id INTEGER REFERENCES agent_groups(id);
ALTER TABLE agents ADD COLUMN tags JSONB DEFAULT '[]';
ALTER TABLE agents ADD COLUMN capabilities JSONB DEFAULT '[]';
-- capabilities: ["sftp", "s3", "compression:zstd", "compression:lz4"]
ALTER TABLE agents ADD COLUMN max_concurrent_transfers INTEGER DEFAULT 3;
ALTER TABLE agents ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- jobs: Add retry policy, file patterns, priority, group
ALTER TABLE jobs ADD COLUMN priority INTEGER DEFAULT 5; -- 1 (highest) to 10 (lowest)
ALTER TABLE jobs ADD COLUMN file_pattern TEXT; -- glob: "*.csv", "report_*.xlsx"
ALTER TABLE jobs ADD COLUMN retry_max_attempts INTEGER DEFAULT 3;
ALTER TABLE jobs ADD COLUMN retry_delay_seconds INTEGER DEFAULT 60;
ALTER TABLE jobs ADD COLUMN retry_backoff_multiplier REAL DEFAULT 2.0;
ALTER TABLE jobs ADD COLUMN compression_algorithm VARCHAR(10) DEFAULT 'none';
-- values: 'none', 'zstd', 'lz4'
ALTER TABLE jobs ADD COLUMN chunk_size_bytes INTEGER DEFAULT 4194304; -- 4MB
ALTER TABLE jobs ADD COLUMN integrity_check BOOLEAN DEFAULT true;
ALTER TABLE jobs ADD COLUMN timeout_seconds INTEGER DEFAULT 3600;
ALTER TABLE jobs ADD COLUMN job_group_id INTEGER REFERENCES job_groups(id);
ALTER TABLE jobs ADD COLUMN enabled BOOLEAN DEFAULT true;
ALTER TABLE jobs ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE jobs ADD COLUMN created_by INTEGER REFERENCES users(id);

-- transfers: Add chunk tracking, checksum, bytes transferred, retry count
ALTER TABLE transfers ADD COLUMN checksum_sha256 VARCHAR(64);
ALTER TABLE transfers ADD COLUMN bytes_transferred BIGINT DEFAULT 0;
ALTER TABLE transfers ADD COLUMN total_chunks INTEGER DEFAULT 0;
ALTER TABLE transfers ADD COLUMN completed_chunks INTEGER DEFAULT 0;
ALTER TABLE transfers ADD COLUMN compression_algorithm VARCHAR(10);
ALTER TABLE transfers ADD COLUMN compression_ratio REAL;
ALTER TABLE transfers ADD COLUMN retry_count INTEGER DEFAULT 0;
ALTER TABLE transfers ADD COLUMN transfer_rate_bps BIGINT; -- bytes per second
ALTER TABLE transfers ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- users: Add organization, MFA
ALTER TABLE users ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
ALTER TABLE users ADD COLUMN mfa_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN mfa_secret VARCHAR(255);
ALTER TABLE users ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- ============================================================
-- NEW TABLES
-- ============================================================

-- Organizations (multi-tenancy foundation)
CREATE TABLE organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent Groups
CREATE TABLE agent_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    organization_id INTEGER REFERENCES organizations(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Job Groups (folders/categories for jobs)
CREATE TABLE job_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_id INTEGER REFERENCES job_groups(id), -- hierarchical
    organization_id INTEGER REFERENCES organizations(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transfer Chunks (resumable transfer tracking)
CREATE TABLE transfer_chunks (
    id SERIAL PRIMARY KEY,
    transfer_id INTEGER REFERENCES transfers(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    offset_bytes BIGINT NOT NULL,
    size_bytes INTEGER NOT NULL,
    checksum_sha256 VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- 'pending', 'in_progress', 'completed', 'failed'
    attempts INTEGER DEFAULT 0,
    completed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(transfer_id, chunk_index)
);

-- Audit Log (immutable, append-only)
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    -- 'job.created', 'job.deleted', 'transfer.started', 'agent.connected', etc.
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(100),
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT
);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);

-- Domain Events (event store for event sourcing)
CREATE TABLE domain_events (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    aggregate_type VARCHAR(50) NOT NULL,
    aggregate_id VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    processed BOOLEAN DEFAULT false
);
CREATE INDEX idx_domain_events_aggregate ON domain_events(aggregate_type, aggregate_id);
CREATE INDEX idx_domain_events_unprocessed ON domain_events(processed) WHERE processed = false;

-- Webhook Configurations
CREATE TABLE webhooks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    secret VARCHAR(255),
    events TEXT[] NOT NULL DEFAULT '{}',
    -- e.g. {'transfer.completed', 'transfer.failed', 'agent.offline'}
    enabled BOOLEAN DEFAULT true,
    organization_id INTEGER REFERENCES organizations(id),
    headers JSONB DEFAULT '{}',
    retry_count INTEGER DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Webhook Delivery Log
CREATE TABLE webhook_deliveries (
    id BIGSERIAL PRIMARY KEY,
    webhook_id INTEGER REFERENCES webhooks(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    attempt INTEGER DEFAULT 1,
    delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    success BOOLEAN DEFAULT false
);

-- Notification Rules
CREATE TABLE notification_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    condition_type VARCHAR(50) NOT NULL,
    -- 'transfer_failed', 'agent_offline', 'job_stalled', 'threshold_exceeded'
    condition_config JSONB NOT NULL DEFAULT '{}',
    action_type VARCHAR(50) NOT NULL,
    -- 'email', 'webhook', 'in_app'
    action_config JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN DEFAULT true,
    organization_id INTEGER REFERENCES organizations(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Schedules (decoupled from jobs for reuse)
CREATE TABLE schedules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    cron_expression VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    enabled BOOLEAN DEFAULT true,
    next_run TIMESTAMP WITH TIME ZONE,
    last_run TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Job-Schedule link (M:N — a job can have multiple schedules)
CREATE TABLE job_schedules (
    job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
    schedule_id INTEGER REFERENCES schedules(id) ON DELETE CASCADE,
    PRIMARY KEY (job_id, schedule_id)
);

-- RBAC: Roles and Permissions
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '[]',
    -- e.g. ["jobs:read", "jobs:write", "agents:read", "transfers:read"]
    is_system BOOLEAN DEFAULT false,
    organization_id INTEGER REFERENCES organizations(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pre-seed system roles
INSERT INTO roles (name, description, permissions, is_system) VALUES
('admin', 'Full system access', '["*"]', true),
('operator', 'Manage jobs and transfers', '["jobs:*","transfers:*","agents:read"]', true),
('viewer', 'Read-only access', '["jobs:read","transfers:read","agents:read"]', true);

-- User-Role assignment
CREATE TABLE user_roles (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- API Keys (for programmatic access, separate from agent tokens)
CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(8) NOT NULL, -- first 8 chars for identification
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    permissions JSONB DEFAULT '["*"]',
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 5.2 Entity Relationship Summary

```
Organization 1──N Users
Organization 1──N Agent Groups
Organization 1──N Job Groups
Organization 1──N Webhooks
Organization 1──N Notification Rules
Organization 1──N Roles

Agent Group 1──N Agents
Job Group  1──N Job Groups (hierarchical)
Job Group  1──N Jobs

User N──M Roles (via user_roles)
User 1──N API Keys
User 1──N Audit Log entries

Job 1──N Transfers
Job N──M Schedules (via job_schedules)
Job N──1 Source Agent
Job N──1 Destination Agent

Transfer 1──N Transfer Chunks
Transfer N──1 Source Agent
Transfer N──1 Destination Agent

Domain Event → (aggregate_type, aggregate_id) → any entity
Webhook 1──N Webhook Deliveries
```

---

## 6. Communication Protocols

### 6.1 WebSocket Protocol (Enhanced)

The current protocol supports 7 message types. The target protocol adds 12+ types to support chunked transfers, direct commands, and real-time dashboard updates.

#### Message Envelope

```json
{
  "type": "string",
  "id": "uuid",            // NEW: Message correlation ID
  "timestamp": "ISO8601",  // NEW
  "data": {}
}
```

#### Agent → Backend Messages

| Type | Purpose | Current | Data Payload |
|------|---------|---------|-------------|
| `heartbeat` | Keep-alive | ✅ Exists | `{ agent_id, timestamp, cpu_percent, mem_percent, disk_free_bytes }` |
| `agent_info` | System info on connect | ✅ Exists | `{ system, ip_address, version, hostname, os, arch, capabilities }` |
| `transfer_progress` | Chunk-level progress | ✅ Exists | `{ transfer_id, chunk_index, total_chunks, bytes_transferred, total_bytes, rate_bps }` |
| `transfer_complete` | Transfer finished | ✅ Exists | `{ transfer_id, checksum_sha256, duration_ms, bytes_total, compression_ratio }` |
| `transfer_error` | Transfer failed | ✅ Exists | `{ transfer_id, chunk_index, error, retryable }` |
| `chunk_data` | **NEW** Binary chunk | ❌ New | Binary frame: `[8B transfer_id][4B chunk_index][4B size][32B sha256][data]` |
| `chunk_ack` | **NEW** Chunk received | ❌ New | `{ transfer_id, chunk_index, checksum_valid }` |
| `file_list` | **NEW** Directory listing | ❌ New | `{ request_id, path, files: [{ name, size, modified, is_dir }] }` |

#### Backend → Agent Messages

| Type | Purpose | Current | Data Payload |
|------|---------|---------|-------------|
| `transfer_request` | Start a transfer | ✅ Exists | `{ transfer_id, job_id, source_path, dest_path, direction, compression, chunk_size, file_pattern }` |
| `cancel_transfer` | Cancel transfer | ✅ Exists | `{ transfer_id }` |
| `connection_test` | Ping agent | ✅ Exists | `{ request_id }` |
| `chunk_relay` | **NEW** Relay chunk to dest | ❌ New | Binary frame (same as `chunk_data`) |
| `list_files` | **NEW** Request directory listing | ❌ New | `{ request_id, path, pattern }` |
| `agent_config_update` | **NEW** Push config changes | ❌ New | `{ config_delta }` |
| `pause_transfer` | **NEW** Pause transfer | ❌ New | `{ transfer_id }` |
| `resume_transfer` | **NEW** Resume transfer | ❌ New | `{ transfer_id, from_chunk }` |

#### Binary Frame Format for Chunk Data

```
┌──────────────┬──────────────┬──────────┬──────────────┬─────────────┐
│ transfer_id  │ chunk_index  │ size     │ sha256       │ payload     │
│ (16 bytes    │ (4 bytes     │ (4 bytes │ (32 bytes    │ (variable)  │
│  UUID)       │  uint32 BE)  │  uint32) │  raw)        │             │
└──────────────┴──────────────┴──────────┴──────────────┴─────────────┘
Total header: 56 bytes
```

Using binary WebSocket frames for chunk data avoids the 33% overhead of base64-encoding binary payloads in JSON.

### 6.2 REST API Contract (Enhanced)

#### New Endpoints

```
# Existing (keep as-is)
POST   /api/auth/login
POST   /api/auth/refresh
GET    /api/auth/user

GET    /api/agents
POST   /api/agents
GET    /api/agents/:id
PUT    /api/agents/:id
DELETE /api/agents/:id
POST   /api/agents/:id/test

GET    /api/jobs
POST   /api/jobs
GET    /api/jobs/:id
PUT    /api/jobs/:id
DELETE /api/jobs/:id
POST   /api/jobs/:id/run

GET    /api/transfers
POST   /api/transfers
GET    /api/transfers/:id
POST   /api/transfers/:id/cancel

GET    /api/tokens
POST   /api/tokens
DELETE /api/tokens/:id

# NEW: Agent Groups
GET    /api/agent-groups
POST   /api/agent-groups
PUT    /api/agent-groups/:id
DELETE /api/agent-groups/:id

# NEW: Job Groups
GET    /api/job-groups
POST   /api/job-groups
PUT    /api/job-groups/:id
DELETE /api/job-groups/:id

# NEW: Schedules
GET    /api/schedules
POST   /api/schedules
PUT    /api/schedules/:id
DELETE /api/schedules/:id
POST   /api/schedules/:id/attach/:jobId
DELETE /api/schedules/:id/detach/:jobId

# NEW: Transfer details
GET    /api/transfers/:id/chunks          # Chunk-level progress
POST   /api/transfers/:id/retry           # Retry failed transfer
POST   /api/transfers/:id/pause           # Pause active transfer
POST   /api/transfers/:id/resume          # Resume paused transfer

# NEW: Job enhancements
GET    /api/jobs/:id/history              # Transfer history for a job
GET    /api/jobs/:id/stats                # Aggregated statistics
POST   /api/jobs/:id/enable
POST   /api/jobs/:id/disable

# NEW: Agent file browsing
GET    /api/agents/:id/files?path=/data   # Browse agent filesystem

# NEW: Webhooks
GET    /api/webhooks
POST   /api/webhooks
PUT    /api/webhooks/:id
DELETE /api/webhooks/:id
POST   /api/webhooks/:id/test             # Send test payload
GET    /api/webhooks/:id/deliveries       # Delivery log

# NEW: Notification Rules
GET    /api/notification-rules
POST   /api/notification-rules
PUT    /api/notification-rules/:id
DELETE /api/notification-rules/:id

# NEW: Audit Log
GET    /api/audit-log?action=&resource_type=&from=&to=&limit=&offset=

# NEW: Dashboard / Stats
GET    /api/dashboard/stats               # KPIs: transfer volume, success rate, etc.
GET    /api/dashboard/activity            # Recent activity feed

# NEW: Settings
GET    /api/settings                      # System settings
PUT    /api/settings

# NEW: User Management
GET    /api/users
POST   /api/users
PUT    /api/users/:id
DELETE /api/users/:id
GET    /api/users/:id/roles
PUT    /api/users/:id/roles

# NEW: Roles
GET    /api/roles
POST   /api/roles
PUT    /api/roles/:id
DELETE /api/roles/:id

# NEW: Real-time event stream (SSE for frontend)
GET    /api/events/stream                 # Server-Sent Events
```

### 6.3 Frontend ↔ Backend Real-Time

The current frontend polls REST endpoints. For real-time updates, add **Server-Sent Events (SSE)** via `/api/events/stream`:

```
Event Types:
  transfer.progress   — { transfer_id, progress, rate }
  transfer.completed  — { transfer_id, duration, size }
  transfer.failed     — { transfer_id, error }
  agent.connected     — { agent_id, name }
  agent.disconnected  — { agent_id, name }
  job.started         — { job_id, name }
  job.completed       — { job_id, name }
```

SSE is simpler than a second WebSocket connection for the browser and works through HTTP/2 proxies.

---

## 7. Transfer Engine Design

### 7.1 Overall Architecture

```
┌─────────────────────────────────────────────────┐
│                Transfer Engine                   │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Chunker  │  │Compressor│  │    Hasher      │  │
│  │          │  │          │  │   (SHA-256)    │  │
│  │ Split    │  │ zstd/LZ4 │  │ Per-chunk +   │  │
│  │ files    │  │ per chunk│  │ whole-file    │  │
│  └────┬─────┘  └────┬─────┘  └───────┬───────┘  │
│       │              │               │           │
│  ┌────▼──────────────▼───────────────▼────────┐  │
│  │          Transfer Orchestrator              │  │
│  │  - Manages concurrent transfers             │  │
│  │  - Tracks chunk state                       │  │
│  │  - Handles retries with backoff             │  │
│  │  - Emits progress events                    │  │
│  └────────────────────┬───────────────────────┘  │
│                       │                          │
│  ┌────────────────────▼───────────────────────┐  │
│  │            Relay / Router                   │  │
│  │  - Routes chunks from source→backend→dest   │  │
│  │  - Buffers chunks in memory (bounded pool)  │  │
│  │  - Applies backpressure via flow control    │  │
│  └────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### 7.2 Chunking Strategy

```go
// chunker.go — conceptual API
type ChunkConfig struct {
    ChunkSizeBytes int     // default 4 MB (4_194_304)
    MinChunkSize   int     // 64 KB — don't chunk files smaller than this
    MaxChunkSize   int     // 64 MB
}

type Chunk struct {
    Index       int
    Offset      int64
    Size        int
    Data        []byte    // compressed payload
    RawSize     int       // pre-compression size
    SHA256      [32]byte  // checksum of compressed data
}
```

**Adaptive chunk sizing:** For small files (< 64 KB), send as a single chunk. For large files, default to 4 MB. The agent can negotiate chunk size based on available memory and network bandwidth (reported in heartbeat).

### 7.3 Compression Pipeline

```
File on disk
    │
    ├── Read chunk (4 MB raw)
    │
    ├── Compress (zstd level 3 default, or LZ4 for real-time)
    │   └── If compressed size > 95% of raw: send uncompressed (flag: compressed=false)
    │
    ├── SHA-256 hash of compressed chunk
    │
    └── Send via WebSocket binary frame
```

**Go packages:**
- `github.com/klauspost/compress/zstd` — zstd compression (pure Go, no CGo)
- `github.com/pierrec/lz4/v4` — LZ4 compression (pure Go)

### 7.4 Transfer Lifecycle State Machine

```
          ┌──────────┐
          │ PENDING   │ ← Transfer created in DB
          └─────┬─────┘
                │  Agent accepts
          ┌─────▼─────┐
     ┌───►│ RUNNING    │
     │    └──┬──┬──────┘
     │       │  │
     │  chunk│  │error
     │  done │  │
     │       │  ▼
     │       │ ┌──────────┐     retry < max
     │       │ │ RETRYING  │◄─────────────┐
     │       │ └─────┬─────┘              │
     │       │       │                    │
     │       │       │ retry succeeds     │ retry fails
     │       │       │                    │
     │       ▼       ▼                    ▼
     │  ┌──────────┐                ┌──────────┐
     │  │COMPLETED │                │  FAILED   │
     │  └──────────┘                └──────────┘
     │
     │  ┌──────────┐
     └──│  PAUSED   │ ← User or system pause
        └──────────┘
```

### 7.5 Resumable Transfers

Each chunk's completion is persisted in `transfer_chunks`. On resume:

1. Backend queries `transfer_chunks WHERE transfer_id = ? AND status != 'completed'`
2. Sends `resume_transfer` message with `from_chunk` = first incomplete chunk index
3. Source agent seeks to offset and resumes reading/sending from that point
4. Already-completed chunks are skipped

### 7.6 Flow Control & Backpressure

- The backend relay maintains a **bounded buffer pool** (default: 32 MB total, configurable)
- If the destination agent's WebSocket send buffer is full, the backend pauses reading from the source agent's WebSocket
- Chunk acknowledgments flow backwards: Dest → Backend → Source
- If 3 consecutive chunks time out (no ack within 30s), the transfer is paused and flagged for retry

### 7.7 Concurrency Model

```
Per Agent:  max_concurrent_transfers (configurable, default 3)
Per Backend: worker pool with configurable goroutine limit (default 100)

Transfer goroutine lifecycle:
  1. Dequeue transfer from scheduler
  2. Acquire semaphore slot (per-agent + global)
  3. Send transfer_request to source agent
  4. Relay chunks source→dest (streaming)
  5. On completion/failure: release semaphore, emit event, update DB
```

---

## 8. Event System Design

### 8.1 In-Process Event Bus

For a self-hosted single-binary deployment, an external message broker (Kafka, RabbitMQ) adds operational complexity that mid-market enterprises shouldn't need to manage. Instead:

```go
// domain/event/bus.go
type EventBus struct {
    handlers map[string][]EventHandler
    mu       sync.RWMutex
    queue    chan DomainEvent  // buffered channel, size 10000
}

type EventHandler func(ctx context.Context, event DomainEvent) error

type DomainEvent struct {
    ID            string
    Type          string          // "transfer.completed"
    AggregateType string          // "transfer"
    AggregateID   string          // "42"
    Payload       json.RawMessage
    Metadata      map[string]string
    CreatedAt     time.Time
}
```

**Subscribers:**
- `AuditLogWriter` — writes to `audit_log` table
- `WebhookDispatcher` — sends HTTP POST to registered webhooks
- `SSEBroadcaster` — pushes to connected frontend clients
- `NotificationEvaluator` — checks notification rules, triggers alerts
- `StatisticsAggregator` — updates dashboard KPIs
- `SchedulerTrigger` — handles event-driven job triggers (e.g., "when file arrives, start job X")

### 8.2 Event Types

```
# Transfer lifecycle
transfer.created
transfer.started
transfer.progress         (throttled: max 1/sec per transfer)
transfer.chunk.completed
transfer.completed
transfer.failed
transfer.retrying
transfer.paused
transfer.resumed
transfer.cancelled

# Job lifecycle
job.created
job.updated
job.deleted
job.started
job.completed
job.failed
job.enabled
job.disabled

# Agent lifecycle
agent.registered
agent.connected
agent.disconnected
agent.heartbeat           (not persisted, only live broadcast)
agent.error

# System
user.login
user.created
settings.changed
webhook.delivered
webhook.failed
```

### 8.3 Webhook Delivery

```
1. Event emitted → WebhookDispatcher receives it
2. Query webhooks WHERE events @> '{transfer.completed}' AND enabled = true
3. For each matching webhook:
   a. Build payload:
      {
        "event": "transfer.completed",
        "timestamp": "2026-02-12T14:30:00Z",
        "data": { ... transfer details ... }
      }
   b. Sign payload with HMAC-SHA256 using webhook.secret
   c. POST to webhook.url with headers:
      - X-FileFlux-Event: transfer.completed
      - X-FileFlux-Signature: sha256=<hex>
      - X-FileFlux-Delivery: <delivery_id>
   d. Log response in webhook_deliveries
   e. If failed: retry up to webhook.retry_count times with exponential backoff
```

### 8.4 Optional: External Broker Integration (Phase 2)

For enterprises needing Kafka/RabbitMQ integration, provide a **pluggable event sink** interface:

```go
type EventSink interface {
    Publish(ctx context.Context, event DomainEvent) error
    Close() error
}

// Built-in implementations:
// - InternalBus (default, in-process)
// - KafkaSink (publishes to Kafka topic)
// - AMQPSink (publishes to RabbitMQ exchange)
// - NATSSink (publishes to NATS subject)
```

---

## 9. Security Architecture

### 9.1 Authentication Flow

```
┌──────────┐                 ┌───────────┐              ┌──────────┐
│ Browser  │                 │  Backend  │              │PostgreSQL│
│          │                 │           │              │          │
│ Login ──►│  POST /auth/login           │              │          │
│          │  { email, password }─────────►              │          │
│          │                 │  bcrypt verify ──────────►│          │
│          │                 │           │◄──────────────│          │
│          │◄────────────────│  { access_token (15min),  │          │
│          │                 │    refresh_token (7d) }   │          │
│          │                 │           │              │          │
│ API call─►  GET /api/jobs  │           │              │          │
│  Header: │  Authorization: │           │              │          │
│  Bearer  │  Bearer <jwt>──►│ Validate  │              │          │
│  <jwt>   │                 │ Check exp │              │          │
│          │                 │ Extract   │              │          │
│          │                 │ user_id + │              │          │
│          │◄────────────────│ roles     │              │          │
│          │                 │           │              │          │
└──────────┘                 └───────────┘              └──────────┘
```

```
┌──────────┐                 ┌───────────┐              ┌──────────┐
│  Agent   │                 │  Backend  │              │PostgreSQL│
│          │                 │           │              │          │
│ Connect ►│  WS Upgrade     │           │              │          │
│  Header: │  Authorization: │           │              │          │
│  Bearer  │  Bearer <token>─►           │              │          │
│  <token> │                 │  Lookup   │              │          │
│          │                 │  tokens   │──────────────►│          │
│          │                 │  table    │◄──────────────│          │
│          │                 │  Verify   │              │          │
│          │◄────────────────│  expiry   │              │          │
│          │  WS Connected   │           │              │          │
└──────────┘                 └───────────┘              └──────────┘
```

### 9.2 RBAC Model

```
Permission format: "<resource>:<action>"

Resources: jobs, transfers, agents, tokens, webhooks, users, settings, audit
Actions:   read, write, delete, execute, * (all)

System Roles:
  admin     → ["*"]
  operator  → ["jobs:*", "transfers:*", "agents:read", "agents:write", "tokens:*"]
  viewer    → ["jobs:read", "transfers:read", "agents:read"]

Custom Roles: Organizations can define custom roles via the API.
```

**Middleware implementation:**

```go
// middleware/rbac.go
func RequirePermission(permission string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            user := getUserFromContext(r.Context())
            if !user.HasPermission(permission) {
                http.Error(w, "Forbidden", http.StatusForbidden)
                return
            }
            next.ServeHTTP(w, r)
        })
    }
}

// Usage in router:
jobs.Handle("", RequirePermission("jobs:read")(http.HandlerFunc(jobHandler.GetJobs))).Methods("GET")
jobs.Handle("", RequirePermission("jobs:write")(http.HandlerFunc(jobHandler.CreateJob))).Methods("POST")
jobs.Handle("/{id}/run", RequirePermission("jobs:execute")(http.HandlerFunc(jobHandler.RunJob))).Methods("POST")
```

### 9.3 Encryption

| Layer | Mechanism | Implementation |
|-------|-----------|---------------|
| In Transit (Browser ↔ Backend) | TLS 1.3 | Reverse proxy (nginx/Caddy) terminates TLS |
| In Transit (Agent ↔ Backend) | WSS (WebSocket over TLS) | Agent config: `wss://` URL |
| In Transit (Chunk data) | Already TLS-wrapped | Binary WS frames inside TLS tunnel |
| At Rest (Database) | PostgreSQL TDE or disk encryption | Enterprise deployment guide |
| At Rest (Agent temp files) | AES-256-GCM | Agent encrypts temp chunks on disk during transfer |
| Integrity | SHA-256 per chunk + whole-file | Verified by destination agent and backend |

### 9.4 Token Management

Fix the current `validateToken` stub:

```go
func (m *Manager) validateToken(tokenValue string) (int, error) {
    var agentID int
    var expiresAt *time.Time
    err := m.database.db.QueryRow(`
        SELECT agent_id, expires_at FROM tokens
        WHERE token_value = $1
    `, tokenValue).Scan(&agentID, &expiresAt)
    if err != nil {
        return 0, fmt.Errorf("invalid token: %w", err)
    }
    if expiresAt != nil && expiresAt.Before(time.Now()) {
        return 0, fmt.Errorf("token expired")
    }
    // Update last_used
    m.database.db.Exec(`UPDATE tokens SET last_used = NOW() WHERE token_value = $1`, tokenValue)
    return agentID, nil
}
```

### 9.5 API Key Authentication

For programmatic access (CI/CD pipelines, scripts), support API keys alongside JWT:

```
Header: X-API-Key: ffx_a1b2c3d4e5f6...

Backend checks:
  1. Extract key prefix (first 8 chars)
  2. Lookup by prefix in api_keys
  3. bcrypt-verify full key against key_hash
  4. Check expiry
  5. Apply key's permissions as the request's authorization scope
```

---

## 10. Deployment Architecture

### 10.1 Development (Docker Compose) — Enhanced

```yaml
# docker-compose.yml (target)
version: '3.8'

services:
  db:
    image: postgres:16          # Upgrade from 14 → 16
    environment:
      POSTGRES_USER: fileflux
      POSTGRES_PASSWORD: ${DB_PASSWORD:-fileflux-dev}
      POSTGRES_DB: fileflux
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./backend/internal/infrastructure/postgres/migrations:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"             # Expose for local dev
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U fileflux"]
      interval: 5s
      timeout: 3s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    depends_on:
      db:
        condition: service_healthy
    environment:
      - DB_HOST=db
      - DB_PORT=5432
      - DB_USER=fileflux
      - DB_PASSWORD=${DB_PASSWORD:-fileflux-dev}
      - DB_NAME=fileflux
      - DB_SSLMODE=disable
      - JWT_SECRET=${JWT_SECRET:-dev-secret-change-in-prod}
      - SERVER_PORT=3001
      - WEBSOCKET_PORT=3002
      - LOG_LEVEL=debug
    ports:
      - "3001:3001"             # REST API
      - "3002:3002"             # WebSocket
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    depends_on:
      - backend
    restart: unless-stopped

  # Source agent (simulates a data source)
  agent-source:
    build: ./agent
    environment:
      - CONNECTION_SERVER_URL=ws://backend:3002/ws/agent
      - CONNECTION_TOKEN=${AGENT_SOURCE_TOKEN:-source-token}
      - AGENT_NAME=Source-Agent
      - AGENT_TYPE=source
    volumes:
      - ./agent/uploads:/data/uploads
    depends_on:
      - backend

  # Destination agent (simulates a data target)
  agent-destination:
    build: ./agent
    environment:
      - CONNECTION_SERVER_URL=ws://backend:3002/ws/agent
      - CONNECTION_TOKEN=${AGENT_DEST_TOKEN:-dest-token}
      - AGENT_NAME=Destination-Agent
      - AGENT_TYPE=destination
    volumes:
      - ./agent/downloads:/data/downloads
    depends_on:
      - backend

volumes:
  postgres-data:
```

### 10.2 Production Architecture

```
                        ┌─────────────────┐
                        │  Load Balancer   │
                        │  (TLS termination│
                        │  Caddy / Nginx)  │
                        └───────┬─────────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
              ┌─────▼─────┐ ┌──▼──────┐ ┌──▼──────┐
              │ Backend 1 │ │Backend 2│ │Backend N│
              │ (Active)  │ │(Standby)│ │ (Scale) │
              └─────┬─────┘ └────┬────┘ └────┬────┘
                    │            │           │
                    └────────────┼───────────┘
                                 │
                    ┌────────────▼───────────┐
                    │   PostgreSQL           │
                    │   (Primary + Replica)  │
                    └────────────────────────┘
```

**Production Recommendations:**

| Concern | Recommendation |
|---------|---------------|
| TLS | Caddy (auto-HTTPS) or nginx with Let's Encrypt |
| Database | PostgreSQL 16 with streaming replication; pg_dump for backups |
| Horizontal scaling | Sticky sessions for WebSocket; shared DB for state |
| Monitoring | Prometheus metrics endpoint (`/metrics`); Grafana dashboards |
| Logging | Structured JSON logging; ship to Loki or ELK |
| Secrets | Docker secrets or Vault for JWT_SECRET, DB_PASSWORD |
| Disk | SSD for PostgreSQL; adequate temp space for agent chunk buffers |

### 10.3 Single-VM Deployment (Typical Mid-Market)

Most mid-market customers will run everything on a single VM:

```
VM (8 vCPU, 16 GB RAM, 200 GB SSD)
├── Docker Compose
│   ├── postgres:16
│   ├── fileflux-backend (single instance)
│   └── fileflux-frontend (nginx)
├── Caddy (reverse proxy, auto-TLS)
└── systemd service for auto-start

Agents run on separate machines:
├── fileflux-agent binary
├── config.yaml
└── systemd/Windows service
```

---

## 11. Technology Decisions

### 11.1 Technology Stack — Confirmed

| Component | Technology | Verdict | Justification |
|-----------|-----------|---------|---------------|
| Backend | Go 1.21+ | ✅ KEEP | Single binary, excellent concurrency, low memory, fast compilation. Ideal for file I/O-heavy workloads. MFT products (unlike web apps) benefit from Go's goroutine model. |
| HTTP Router | gorilla/mux | ✅ KEEP | Mature, well-understood. Note: gorilla/mux is archived but stable. Consider migrating to `chi` in a future release, but not urgently. |
| ORM | raw `database/sql` | ✅ KEEP | MFT workloads are CRUD-simple. GORM adds complexity and hides performance issues. Raw SQL is auditable and predictable. Remove GORM from go.mod. |
| Database | PostgreSQL 16 | ✅ KEEP | JSONB for flexible metadata, excellent concurrency, battle-tested. Upgrade from 14 → 16 for performance. |
| Frontend | Lit (TypeScript) | ✅ KEEP | Lightweight (7 KB), web-standard Web Components, fast rendering. Good fit for enterprise dashboards. No need for React/Vue overhead. |
| Frontend Build | Vite | ✅ KEEP | Fast dev server, optimized builds. |
| Agent | Go 1.21+ | ✅ KEEP | Cross-compile to Linux/Windows/macOS from single codebase. Single binary distribution. |
| WebSocket | gorilla/websocket | ✅ KEEP | Proven in production. Supports binary frames (needed for chunk transfer). |
| Compression | klauspost/compress | ➕ ADD | Pure Go zstd and s2 (LZ4-compatible). No CGo dependency. |
| Scheduling | robfig/cron/v3 | ➕ ADD | Standard Go cron library. Supports timezone-aware scheduling. |
| Migration | golang-migrate | ➕ ADD | Versioned SQL migrations. `migrate` CLI + library. |
| Config | viper | ✅ KEEP (agent) | Already in agent go.mod. Also use for backend if env-var override patterns are needed. |
| Logging | zerolog or slog | ➕ ADD | Replace `log.Printf` with structured JSON logging. Go 1.21+ has `log/slog` in stdlib — prefer that. |

### 11.2 Removed / Replaced

| Technology | Action | Reason |
|-----------|--------|--------|
| gin-gonic/gin | 🗑 REMOVE from go.mod | Unused; gorilla/mux is the active router. Dual dependencies create confusion. |
| gorm | 🗑 REMOVE from go.mod | Unused; raw SQL is the active data access pattern. GORM models in `pkg/domain/` are dead code. |
| `pkg/domain/` | 🗑 DELETE | Consolidate into `internal/domain/` with raw SQL repos. |
| `internal/database/db.go` | 🗑 DELETE | Dormant GORM-based interface. Replace with repository interfaces in `internal/domain/`. |
| `src/server.js` | 🗑 DELETE | Node.js server in a Go backend directory. Legacy artifact. |
| `backend/src/` | 🗑 DELETE | Entire directory is a Node.js leftover. |

---

## 12. Architecture Decision Records

### ADR-001: Consolidate on gorilla/mux + raw SQL

**Status:** Accepted

**Context:**
The codebase contains two competing architectures: (A) gorilla/mux + raw SQL in `internal/`, and (B) gin + GORM in `pkg/domain/` and `internal/database/`. The router (`internal/api/router.go`) uses architecture A. Architecture B is dead code.

**Decision:**
Consolidate on architecture A (gorilla/mux + `database/sql`). Remove all gin and GORM dependencies. Adopt interface patterns from architecture B (repository interfaces, context-aware methods) into architecture A's structure.

**Consequences:**
- Positive: Single coherent codebase; reduced dependency surface; predictable SQL performance
- Positive: Repository interfaces enable testing via mocks without GORM's complexity
- Negative: Manual SQL requires more boilerplate than GORM
- Risk: gorilla/mux is archived (maintenance-only). Plan migration to `go-chi/chi` in v2.

---

### ADR-002: In-Process Event Bus (No External Broker)

**Status:** Accepted

**Context:**
The concept document specifies "Event Broker (Kafka, RabbitMQ)." However, the target audience is mid-market enterprises deploying on-premise, often without dedicated DevOps teams. An external broker increases operational complexity.

**Decision:**
Use an in-process event bus (Go channels + goroutines) as the default. Persist events to `domain_events` table for durability. Provide a pluggable `EventSink` interface for enterprises that want to forward events to Kafka/NATS.

**Consequences:**
- Positive: Zero additional infrastructure; single binary deployment
- Positive: Events are persisted in PostgreSQL; no data loss on crash
- Negative: Cannot horizontally scale consumers independently (acceptable for single-node deployments)
- Risk: At very high throughput (>10K events/sec), the in-process bus may become a bottleneck. Mitigation: the `EventSink` interface allows offloading to Kafka.

---

### ADR-003: Backend as Transfer Relay (Phase 1)

**Status:** Accepted

**Context:**
File data can flow either (a) through the backend (relay), or (b) directly between agents (peer-to-peer). Direct transfer is more efficient but requires agents to have network connectivity to each other, which is often blocked by firewalls and NAT.

**Decision:**
Phase 1: All chunk data flows through the backend via WebSocket relay. The backend acts as a store-and-forward buffer (bounded at 32 MB). Phase 2: Optional direct agent-to-agent transfer when both agents report being on the same network.

**Consequences:**
- Positive: Works through any NAT/firewall; agents only need outbound connectivity to the backend
- Positive: Backend has full visibility into transfer progress for monitoring
- Negative: Backend becomes a bandwidth bottleneck for very large transfers
- Negative: Double network traversal (source→backend, backend→dest)
- Mitigation: Phase 2 direct transfer bypasses backend when possible

---

### ADR-004: Binary WebSocket Frames for Chunk Data

**Status:** Accepted

**Context:**
Chunk data can be sent as JSON (base64-encoded) or as binary WebSocket frames. JSON encoding adds ~33% overhead for binary data.

**Decision:**
Use binary WebSocket frames for chunk data with a fixed 56-byte header. Use text (JSON) frames for all control messages (heartbeat, transfer_request, etc.).

**Consequences:**
- Positive: No encoding overhead; ~33% bandwidth savings on data transfer
- Positive: Reduced CPU usage (no base64 encode/decode)
- Negative: Binary protocol requires more careful parsing; harder to debug in browser DevTools
- Mitigation: Control messages remain JSON for debuggability

---

### ADR-005: SHA-256 Integrity Verification at Chunk Level

**Status:** Accepted

**Context:**
Data integrity can be verified at file level (one hash for the entire file), chunk level (one hash per chunk), or both.

**Decision:**
Compute SHA-256 for each chunk on the source agent, include it in the chunk header, and verify on the destination agent. Additionally, compute a whole-file SHA-256 on both source and destination and compare on transfer completion.

**Consequences:**
- Positive: Corrupted chunks are detected immediately and can be retried individually
- Positive: Whole-file hash provides end-to-end integrity guarantee
- Negative: SHA-256 computation adds CPU overhead (~300 MB/s on modern hardware; not a bottleneck)

---

### ADR-006: SSE for Frontend Real-Time Updates (not WebSocket)

**Status:** Accepted

**Context:**
The frontend needs real-time updates for transfer progress, agent status, etc. Options: (a) Second WebSocket connection from browser, (b) Server-Sent Events (SSE), (c) Long polling.

**Decision:**
Use Server-Sent Events (SSE) via `GET /api/events/stream`. SSE is unidirectional (server→client), which matches the use case. The browser sends commands via REST; it receives live updates via SSE.

**Consequences:**
- Positive: Simpler than WebSocket (no upgrade handshake, no ping/pong management)
- Positive: Works through HTTP/2 multiplexing and standard reverse proxies
- Positive: Native browser `EventSource` API; automatic reconnection
- Negative: Unidirectional (server→client only). Not a problem since the browser uses REST for actions.

---

### ADR-007: Lit Web Components for Frontend

**Status:** Accepted (Reaffirmed)

**Context:**
The frontend uses Lit, a lightweight Web Components library. Some teams prefer React or Vue for their ecosystem. However, File Flux is an enterprise admin dashboard, not a consumer app.

**Decision:**
Keep Lit. The dashboard is form-heavy and table-heavy; Lit's simplicity reduces bundle size and onboarding friction. Add a minimal state management layer using Lit's reactive controllers + a custom event-based store.

**Consequences:**
- Positive: ~7 KB framework weight vs. ~40 KB (React) or ~30 KB (Vue)
- Positive: Web-standard components; interoperable with any framework
- Negative: Smaller ecosystem; fewer pre-built component libraries
- Mitigation: Build a small shared component library (data-table, status-badge, form fields)

---

### ADR-008: Versioned SQL Migrations

**Status:** Accepted

**Context:**
The current schema uses a single `schema.sql` file executed on startup. This doesn't support incremental schema changes or rollbacks.

**Decision:**
Adopt `golang-migrate/migrate` for versioned SQL migrations. Each migration is a pair of files (`NNNN_name.up.sql`, `NNNN_name.down.sql`). Migrations run automatically on backend startup.

**Consequences:**
- Positive: Safe, incremental schema evolution
- Positive: Rollback support
- Positive: Migration state tracked in `schema_migrations` table
- Negative: Team must follow migration discipline (never edit existing migrations)

---

### ADR-009: Structured Logging with `log/slog`

**Status:** Accepted

**Context:**
The entire codebase uses `log.Printf` with string formatting. This produces unstructured logs that are hard to search, filter, and aggregate.

**Decision:**
Adopt Go 1.21+'s `log/slog` package for structured JSON logging. Each log entry includes: timestamp, level, message, and contextual fields (request_id, user_id, agent_id, transfer_id).

**Consequences:**
- Positive: Machine-parsable JSON logs; compatible with Loki, ELK, CloudWatch
- Positive: Zero external dependencies (stdlib)
- Positive: Context propagation via `slog.With()` for request tracing
- Negative: Migration effort to replace ~50 `log.Printf` calls

---

### ADR-010: `robfig/cron/v3` for Job Scheduling

**Status:** Accepted

**Context:**
The `jobs` table has a `schedule` column (cron expression) but no scheduling engine. Options: (a) OS-level cron, (b) in-process scheduler, (c) external scheduler (Temporal, Airflow).

**Decision:**
Use `robfig/cron/v3` for in-process cron scheduling. The scheduler loads all enabled jobs on startup, watches for changes via the event bus, and triggers `job.started` events on schedule.

**Consequences:**
- Positive: No external dependencies; runs in the same process
- Positive: Supports cron expressions with seconds, timezone-aware
- Positive: Integrates with the event bus for triggered/reactive jobs
- Negative: Single-process scheduler — if backend restarts, jobs may miss a beat. Mitigation: On startup, check `next_run` and fire overdue jobs.

---

## 13. Migration Roadmap

### Phase 1 — Foundation (4-6 weeks)

| # | Task | Priority |
|---|------|----------|
| 1 | Delete dead code: `pkg/domain/`, `internal/database/`, `backend/src/`, gin/gorm from go.mod | P0 |
| 2 | Implement `validateToken` in WebSocket manager (fix critical auth bypass) | P0 |
| 3 | Introduce `internal/domain/` with model structs and repository interfaces | P0 |
| 4 | Implement `internal/infrastructure/postgres/` repositories (port from `internal/db/`) | P0 |
| 5 | Add versioned migrations (`golang-migrate`) | P0 |
| 6 | Replace `log.Printf` with `log/slog` structured logging | P1 |
| 7 | Implement RBAC middleware with permission checks | P1 |
| 8 | Add audit log table and event writer | P1 |

### Phase 2 — Transfer Engine (6-8 weeks)

| # | Task | Priority |
|---|------|----------|
| 9 | Implement chunker (file → chunks with configurable size) | P0 |
| 10 | Implement compressor (zstd/LZ4 via `klauspost/compress`) | P0 |
| 11 | Implement SHA-256 hasher (per-chunk + whole-file) | P0 |
| 12 | Binary WebSocket frame protocol for chunk transfer | P0 |
| 13 | Transfer relay in backend (source→backend→dest) | P0 |
| 14 | `transfer_chunks` table and resumable transfer logic | P0 |
| 15 | Backpressure / flow control via bounded buffer pool | P1 |
| 16 | Transfer lifecycle state machine (pending→running→completed/failed) | P0 |

### Phase 3 — Scheduling & Events (4 weeks)

| # | Task | Priority |
|---|------|----------|
| 17 | Integrate `robfig/cron/v3` scheduler | P0 |
| 18 | Implement in-process event bus | P0 |
| 19 | Wire event handlers: audit log, SSE broadcaster | P0 |
| 20 | Webhook configuration API and dispatcher | P1 |
| 21 | Notification rules engine | P2 |
| 22 | File pattern matching (glob) for job source paths | P1 |

### Phase 4 — Frontend & UX (4-6 weeks)

| # | Task | Priority |
|---|------|----------|
| 23 | SSE client for real-time dashboard updates | P0 |
| 24 | Transfer progress bar component (chunk-level) | P0 |
| 25 | Visual cron editor component | P1 |
| 26 | Agent file browser (via backend relay) | P1 |
| 27 | Webhook configuration UI | P1 |
| 28 | Audit log viewer | P1 |
| 29 | User/role management UI | P1 |
| 30 | Shared component library (data-table, status-badge, toast) | P1 |

### Phase 5 — Enterprise Hardening (ongoing)

| # | Task | Priority |
|---|------|----------|
| 31 | TLS guide for production (Caddy auto-HTTPS) | P1 |
| 32 | Prometheus `/metrics` endpoint | P1 |
| 33 | Agent installer (`.deb`, `.rpm`, `.msi`, Homebrew) | P2 |
| 34 | Protocol adapters: SFTP, S3 (agent-side) | P2 |
| 35 | Direct agent-to-agent transfer (Phase 2 of ADR-003) | P2 |
| 36 | External event sink (Kafka, NATS) | P3 |
| 37 | Multi-node backend with sticky WebSocket sessions | P3 |

---

*End of Architecture Design Document*
