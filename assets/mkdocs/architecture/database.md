---
title: "Database"
weight: 5
---
# Database Schema

FileFlux uses PostgreSQL 14+ with schema migrations managed by `golang-migrate`.

## Entity Relationship Diagram

```mermaid
erDiagram
    users ||--o{ tokens : creates
    users ||--o{ jobs : creates
    agents ||--o{ tokens : "registered via"
    jobs ||--o{ transfers : triggers
    agents ||--o{ transfers : "source/dest"

    users {
        bigserial id PK
        varchar email UK
        varchar password_hash
        varchar role
        timestamp created_at
        timestamp updated_at
    }

    agents {
        bigserial id PK
        varchar name
        varchar type
        varchar status
        inet ip_address
        jsonb system_info
        varchar version
        timestamp last_seen
        timestamp created_at
    }

    tokens {
        bigserial id PK
        varchar token_hash UK
        varchar name
        bigint created_by FK
        bigint agent_id FK
        varchar status
        timestamp expires_at
        timestamp created_at
    }

    jobs {
        bigserial id PK
        varchar name
        varchar type
        varchar status
        bigint source_agent_id FK
        varchar source_path
        bigint dest_agent_id FK
        varchar dest_path
        varchar schedule
        varchar file_pattern
        text description
        bigint created_by FK
        timestamp last_run_at
        timestamp created_at
        timestamp updated_at
    }

    transfers {
        bigserial id PK
        bigint job_id FK
        varchar filename
        bigint size
        varchar status
        bigint source_agent_id FK
        bigint dest_agent_id FK
        varchar checksum
        real progress
        timestamp started_at
        timestamp completed_at
        text error
    }
```

## Migrations

Migrations are stored in `backend/migrations/` and applied automatically on startup:

```bash
# Apply all pending migrations
just db-migrate

# Reset database (destroys data!)
just db-reset
```

## Indexes

Key indexes for query performance:

- `transfers(job_id)` — Fast lookup by job
- `transfers(status)` — Filter by status
- `agents(status)` — Active agent queries
- `tokens(token_hash)` — Token validation
- `jobs(source_agent_id, dest_agent_id)` — Agent relationship queries
