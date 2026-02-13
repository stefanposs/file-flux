---
title: "Database"
weight: 5
---
# Database Schema

FileFlux uses PostgreSQL 16 with auto-migration from `backend/internal/db/schema.sql`.

## Entity Relationship Diagram

```mermaid
erDiagram
    users ||--o{ tokens : creates
    users ||--o{ jobs : creates
    agents ||--o{ tokens : "registered via"
    jobs ||--o{ transfers : triggers
    agents ||--o{ transfers : "source/dest"
    transfers ||--o{ transfer_chunks : contains

    users {
        serial id PK
        varchar email UK
        varchar name
        varchar password_hash
        varchar role
        timestamp last_login
        timestamp created_at
    }

    agents {
        serial id PK
        varchar name
        varchar type
        varchar status
        varchar ip_address
        varchar system
        varchar version
        varchar description
        varchar transport_mode
        timestamp last_seen
        timestamp last_poll_at
        timestamp created_at
    }

    tokens {
        serial id PK
        varchar token_value UK
        varchar name
        int agent_id FK
        varchar description
        timestamp expires_at
        timestamp last_used
        timestamp created_at
    }

    jobs {
        serial id PK
        varchar name
        varchar type
        varchar status
        int source_agent_id FK
        varchar source_path
        int destination_agent_id FK
        varchar destination_path
        varchar schedule
        text description
        int user_id FK
        timestamp last_run
        timestamp created_at
    }

    transfers {
        serial id PK
        int job_id FK
        varchar filename
        bigint size
        varchar status
        int source_agent_id FK
        int destination_agent_id FK
        varchar source_path
        varchar destination_path
        varchar checksum
        real progress
        text error
        varchar file_hash
        varchar compression
        int chunk_size
        int total_chunks
        int completed_chunks
        bigint bytes_transferred
        int retry_count
        int max_retries
        timestamp start_time
        timestamp end_time
        timestamp created_at
    }

    transfer_chunks {
        serial id PK
        int transfer_id FK
        int chunk_index
        varchar chunk_hash
        int size_compressed
        int size_original
        varchar status
        timestamp received_at
    }

    agent_message_queue {
        serial id PK
        int agent_id FK
        varchar message_type
        jsonb payload
        varchar status
        timestamp created_at
        timestamp processed_at
    }
```

## Migrations

Schema is defined in `backend/internal/db/schema.sql` and applied automatically on startup via `pgDB.Migrate()`. All DDL statements use `IF NOT EXISTS` / `IF NOT EXISTS` for idempotent re-runs.

```bash
# Reset database (destroys data!)
just db-reset
```

## Indexes

Key indexes for query performance:

- `transfers(job_id)` — Fast lookup by job
- `transfers(status)` — Filter by status
- `agents(status)` — Active agent queries
- `tokens(token_value)` — Token validation
- `jobs(source_agent_id, destination_agent_id)` — Agent relationship queries
- `transfer_chunks(transfer_id)` — Chunk lookup by transfer
- `agent_message_queue(agent_id, status)` — Pending message lookup
