---
title: "ADRs"
weight: 4
---
# Architecture Decision Records

## ADR Index

| # | Decision | Status | Date |
|---|----------|--------|------|
| ADR-001 | [Consolidate on gorilla/mux](#adr-001) | Accepted | 2024-01 |
| ADR-002 | [In-process event bus](#adr-002) | Accepted | 2024-01 |
| ADR-003 | [Backend relay for file chunks](#adr-003) | Accepted | 2024-01 |
| ADR-004 | [Binary WebSocket frames](#adr-004) | Accepted | 2024-01 |
| ADR-005 | [SHA-256 checksums](#adr-005) | Accepted | 2024-01 |
| ADR-006 | [SSE for frontend updates](#adr-006) | Accepted | 2024-01 |
| ADR-007 | [Keep Lit Web Components](#adr-007) | Accepted | 2024-01 |
| ADR-008 | [golang-migrate for migrations](#adr-008) | Accepted | 2024-01 |
| ADR-009 | [log/slog for logging](#adr-009) | Accepted | 2024-01 |
| ADR-010 | [robfig/cron for scheduling](#adr-010) | Accepted | 2024-01 |

---

## ADR-001: Consolidate on gorilla/mux {#adr-001}

**Context:** The codebase has 3 incompatible HTTP router implementations (gorilla/mux, gin, gorilla/mux+Auth0).

**Decision:** Consolidate on `gorilla/mux` and delete gin/GORM code paths.

**Rationale:** gorilla/mux is already the most complete path, lightweight, and doesn't pull in unnecessary ORM dependencies.

**Consequences:** Delete `pkg/api/`, `pkg/config/`, `pkg/domain/`, `internal/auth/auth0.go`, `internal/database/`.

---

## ADR-002: In-process event bus {#adr-002}

**Context:** Need internal pub/sub for decoupling (e.g., transfer progress → SSE broadcast).

**Decision:** Use a simple in-process event bus (Go channels) for v1. Plan upgrade path to NATS for multi-instance.

**Rationale:** Keeps deployment simple (single binary), avoids infrastructure dependency for MVP.

---

## ADR-003: Backend relay for file chunks {#adr-003}

**Context:** How should file data flow between agents?

**Decision:** All file data flows through the backend. Agents never connect directly to each other.

**Rationale:** Simplifies network requirements (agents only need outbound to backend), enables audit logging, centralized access control.

**Trade-off:** Backend becomes a throughput bottleneck. Mitigated by chunking and future horizontal scaling.

---

## ADR-004: Binary WebSocket frames {#adr-004}

**Context:** How to transfer file chunks over WebSocket?

**Decision:** Use binary WebSocket frames with a structured header (transfer ID, chunk index, size).

**Rationale:** Binary frames avoid Base64 encoding overhead (~33% savings), enable streaming.

---

## ADR-005: SHA-256 checksums {#adr-005}

**Context:** How to verify transfer integrity?

**Decision:** SHA-256 checksum computed incrementally during read/write, verified at transfer completion.

**Rationale:** Industry standard, hardware-accelerated on modern CPUs, sufficient collision resistance.

---

## ADR-006: SSE for frontend updates {#adr-006}

**Context:** How to push real-time updates to the web frontend?

**Decision:** Server-Sent Events (SSE) over HTTP/1.1.

**Rationale:** Simpler than WebSocket for unidirectional updates, works through proxies, auto-reconnects.

---

## ADR-007: Keep Lit Web Components {#adr-007}

**Context:** Should we switch to React/Vue/Angular?

**Decision:** Keep Lit Web Components.

**Rationale:** Tiny bundle (~16KB), standards-based, no framework lock-in, existing code is functional.

---

## ADR-008: golang-migrate for migrations {#adr-008}

**Context:** How to manage database schema changes?

**Decision:** Use `golang-migrate` with SQL files.

**Rationale:** Lightweight, supports PostgreSQL, CLI for manual operations, embeddable in Go binary.

---

## ADR-009: log/slog for logging {#adr-009}

**Context:** Which logging library?

**Decision:** Use Go's standard `log/slog` (structured logging).

**Rationale:** No external dependency, structured JSON output, performant, standard library since Go 1.21.

---

## ADR-010: robfig/cron for scheduling {#adr-010}

**Context:** How to implement cron-based job scheduling?

**Decision:** Use `robfig/cron/v3`.

**Rationale:** Mature library, supports standard cron syntax, timezone-aware, widely used in Go ecosystem.
