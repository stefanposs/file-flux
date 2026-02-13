---
title: "System Overview"
weight: 1
---
# System Overview

FileFlux follows a hub-and-spoke architecture where the backend acts as the central coordinator.

## High-Level Architecture

```mermaid
graph TB
    subgraph "Endpoints"
        A1[Agent 1<br/>Linux Server]
        A2[Agent 2<br/>Windows Desktop]
        A3[Agent N<br/>macOS Workstation]
    end

    subgraph "FileFlux Platform"
        FE[Frontend<br/>Lit + Vite]
        BE[Backend<br/>Go + gorilla/mux]
        DB[(PostgreSQL)]
        BE -->|SQL| DB
        FE -->|REST| BE
    end

    A1 -->|WebSocket| BE
    A2 -->|WebSocket| BE
    A3 -->|WebSocket| BE

    U[User / Admin] -->|Browser| FE
```

## Component Responsibilities

| Component | Technology | Responsibility |
|-----------|-----------|----------------|
| **Backend** | Go, gorilla/mux | API server, WebSocket hub, job scheduling, transfer coordination |
| **Frontend** | Lit, TypeScript, Vite | Web UI for management and monitoring |
| **Agent** | Go, flag (stdlib) | Endpoint process for file operations |
| **Database** | PostgreSQL 16 | Persistent storage for all state |

## Communication Patterns

| Path | Protocol | Purpose |
|------|----------|---------|
| Frontend → Backend | REST (HTTP/1.1) | CRUD operations, authentication |
| Backend → Frontend | REST (Polling) | Transfer updates, agent status |
| Agent → Backend | WebSocket | Command & control, heartbeat |
| Agent ↔ Backend | WebSocket (binary) | File chunk transfer (zstd/LZ4 compressed) |
| Agent → Backend | HTTP Long-Polling | Fallback transport for restricted networks |

## Data Flow: File Transfer

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant SourceAgent
    participant DestAgent

    User->>Frontend: Click "Run Job"
    Frontend->>Backend: POST /api/jobs/:id/run
    Backend->>Backend: Create transfer records
    Backend->>SourceAgent: WS: transfer_request
    SourceAgent->>SourceAgent: Read file, split chunks
    loop For each chunk
        SourceAgent->>Backend: WS: binary frame (57-byte header + compressed data)
        Backend->>DestAgent: WS: binary frame
        DestAgent->>Backend: WS: chunk_ack
    end
    DestAgent->>Backend: WS: transfer_complete + SHA-256
    Backend->>Frontend: Transfer status available via REST
    Frontend->>User: Show success ✅
```

## Design Principles

1. **Backend as relay** — All file data flows through the backend. Agents never communicate directly.
2. **Stateless agents** — Agents hold no persistent state. All state lives in PostgreSQL.
3. **Binary WebSocket** — File chunks are sent as binary frames for efficiency.
4. **Event-driven** — Internal event bus decouples components within the backend.
5. **Interface-based** — All external dependencies are behind Go interfaces for testability.
