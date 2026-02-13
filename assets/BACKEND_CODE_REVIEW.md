# FileFlux Backend — Enterprise Readiness Code Review

**Reviewer:** Go Expert (Principal-level)
**Date:** 2026-02-12
**Verdict: NOT ENTERPRISE-READY — Major structural & security issues**

---

## Executive Summary

The FileFlux backend is **fundamentally broken**. It contains **3 incompatible code paths** that cannot coexist in a single binary, a **critical authentication bypass**, an **in-memory file store** that will lose all data on restart, and **zero tests**. The codebase mixes German and English, uses deprecated APIs, and has phantom import paths that don't resolve. No single `go build` succeeds against the full source tree.

**Severity Score: 2/10** (1 = doesn't compile, 10 = production-ready)

---

## 1. Architectural Cancer: Three Incompatible Code Paths

This is the most damaging finding. The backend has **3 separate application architectures** that share a `go.mod` but are mutually exclusive:

| Entry Point | Router | ORM | Auth | Config |
|---|---|---|---|---|
| `cmd/server/main.go` | Gin | GORM | Auth0 (go-jwt-middleware/v2) | `pkg/config` (env vars) |
| `cmd/main.go` | gorilla/mux | raw `database/sql` | Auth0 (custom) | `pkg/config` + `.env` |
| `internal/api/router.go` | gorilla/mux | raw `database/sql` | custom JWT (`middleware/auth.go`) | `internal/config` (YAML) |

Additionally, `backend/src/server.js` is a **Node.js Express server** — a completely dead 4th code path.

### Impact
- No single `go build ./...` succeeds — import paths conflict
- Three different `Database` types (`internal/db.Database`, `internal/database.PostgresDB`, `*gorm.DB`)
- Three different `User` models with different fields
- Three different auth mechanisms, none fully implemented
- Impossible to reason about which code is "live"

### Recommendation: **P0 — DELETE two paths, keep one**

Pick ONE architecture. My recommendation: keep the `internal/` path (gorilla/mux + raw SQL + YAML config) as it's closest to idiomatic Go and doesn't drag in GORM/Gin overhead. Delete everything else.

**Files to DELETE immediately:**
- `backend/cmd/server/main.go` (Gin/GORM path)
- `backend/pkg/api/server.go` (Gin handlers)
- `backend/pkg/config/config.go` (duplicate config)
- `backend/pkg/domain/` (entire directory — GORM models)
- `backend/internal/database/db.go` (3rd DB abstraction)
- `backend/internal/auth/auth.go` (Auth0 go-jwt-middleware path)
- `backend/internal/auth/auth0.go` (4th auth implementation using deprecated `dgrijalva/jwt-go`)
- `backend/src/` (entire directory — Node.js dead code)

---

## 2. File-by-File Analysis

### 2.1 `backend/go.mod` — Priority: P0

```go.mod
module github.com/stefanposs/file-flux/backend
go 1.21.0
```

**Issues:**
| Issue | Severity | Detail |
|---|---|---|
| Module path mismatch | CRITICAL | Module is `github.com/stefanposs/file-flux/backend` but `internal/api/router.go` imports `fileflux/backend/internal/...` and `job_handler.go` imports `github.com/your-username/fileflux/backend/internal/...`. Three different module paths. |
| Gin + gorilla/mux both present | HIGH | Two competing routers in deps |
| GORM + raw `database/sql` both present | HIGH | Two competing DB layers |
| `github.com/dgrijalva/jwt-go` | HIGH | Deprecated, has CVEs. Use `github.com/golang-jwt/jwt/v5` |
| `gorilla/mux` in `// indirect` | MEDIUM | It's used directly in `cmd/main.go` — should be `require` not `indirect` |
| Missing deps | CRITICAL | `github.com/joho/godotenv`, `github.com/rs/cors`, `github.com/auth0/go-jwt-middleware/v2`, `github.com/gorilla/websocket`, `github.com/lib/pq`, `gopkg.in/yaml.v2` — none declared |
| Go 1.21 | LOW | Should be 1.22+ for production (rangefunc, slog improvements) |
| `stretchr/testify` declared | IRONIC | Zero tests exist |

**Fix — Cleaned `go.mod`:**
```go
module github.com/stefanposs/file-flux/backend

go 1.22.0

require (
    github.com/gorilla/mux v1.8.1
    github.com/gorilla/websocket v1.5.1
    github.com/lib/pq v1.10.9
    github.com/golang-jwt/jwt/v5 v5.2.1
    gopkg.in/yaml.v3 v3.0.1
)
```

---

### 2.2 `backend/cmd/server/main.go` — Priority: P0 DELETE

**Verdict: DELETE THIS FILE**

- Imports non-existent packages (`pkg/infrastructure/db`, `pkg/infrastructure/logger`)
- Uses Gin + zap + GORM — completely different stack from `internal/`
- German log messages mixed with English code
- Graceful shutdown timeout of 5s is too short for file transfers

---

### 2.3 `backend/internal/api/router.go` — Priority: P1

**Keep, but significant rewrite needed.**

**Issues:**
| Issue | Severity | Detail |
|---|---|---|
| Wrong import path | CRITICAL | Uses `fileflux/backend/internal/...` — doesn't match `go.mod` module path |
| References non-existent handlers | HIGH | `NewAgentHandler`, `NewTokenHandler`, `NewTransferHandler` — not in codebase |
| No context propagation | HIGH | Handlers use `http.Request` but no `context.Context` forwarding |
| CORS as middleware function | MEDIUM | No configuration — `middleware.CORS` is undefined (middleware/auth.go only has `Auth`) |
| Static file serving | MEDIUM | `http.FileServer(http.Dir("./static"))` — path traversal risk, no Content-Security-Policy |
| No rate limiting | HIGH | No request throttling on any endpoint |
| No request size limits | HIGH | No `http.MaxBytesReader` |
| No API versioning | MEDIUM | Routes start at `/api/` not `/api/v1/` |

**Rewrite example — proper router setup:**
```go
package api

import (
    "log/slog"
    "net/http"

    "github.com/gorilla/mux"
    "github.com/stefanposs/file-flux/backend/internal/handlers"
    "github.com/stefanposs/file-flux/backend/internal/middleware"
)

// NewRouter creates a new HTTP router with all API endpoints.
func NewRouter(deps *handlers.Dependencies, logger *slog.Logger) http.Handler {
    r := mux.NewRouter()

    // Global middleware
    r.Use(middleware.RequestID)
    r.Use(middleware.Logging(logger))
    r.Use(middleware.Recovery(logger))
    r.Use(middleware.CORS(middleware.CORSConfig{
        AllowedOrigins: []string{"https://app.fileflux.io"},
    }))
    r.Use(middleware.RateLimit(100)) // 100 req/s per IP

    api := r.PathPrefix("/api/v1").Subrouter()

    // Health check — unauthenticated
    api.HandleFunc("/health", handlers.HealthCheck).Methods(http.MethodGet)

    // Authenticated routes
    protected := api.NewRoute().Subrouter()
    protected.Use(middleware.Auth(deps.JWTSecret))

    // Jobs
    protected.HandleFunc("/jobs", deps.Job.List).Methods(http.MethodGet)
    protected.HandleFunc("/jobs", deps.Job.Create).Methods(http.MethodPost)
    protected.HandleFunc("/jobs/{id}", deps.Job.Get).Methods(http.MethodGet)
    protected.HandleFunc("/jobs/{id}", deps.Job.Update).Methods(http.MethodPut)
    protected.HandleFunc("/jobs/{id}", deps.Job.Delete).Methods(http.MethodDelete)

    return r
}
```

---

### 2.4 `backend/internal/handlers/job_handler.go` — Priority: P1

**Keep structure, rewrite internals.**

**Issues:**
| Issue | Severity | Detail |
|---|---|---|
| Wrong import path | CRITICAL | `github.com/your-username/fileflux/...` — placeholder never fixed |
| `getUserIDFromContext()` returns hardcoded `1` | CRITICAL | **Auth bypass** — every request acts as user 1 |
| No `context.Context` on DB calls | HIGH | All `h.db.GetJobs(userID)` calls lack context — no timeout/cancellation |
| No request body size limit | HIGH | `json.NewDecoder(r.Body).Decode()` reads unlimited input |
| Business logic in handler | MEDIUM | Subscription limit checks belong in a service layer |
| `RunJob` is a stub | HIGH | Returns success but does nothing |
| No pagination on `GetJobs` | MEDIUM | Returns ALL jobs — will OOM at scale |
| Coupled to concrete `*db.Database` | HIGH | Should accept an interface for testability |
| `json.NewEncoder(w).Encode()` ignores errors | LOW | Return value not checked |
| German error messages in HTTP responses | LOW | Client-facing strings should be English |

**Critical fix #1 — `getUserIDFromContext`:**
```go
type contextKey string

const userIDKey contextKey = "userID"

// UserIDFromContext extracts the authenticated user ID from context.
// Returns 0 and false if not present.
func UserIDFromContext(ctx context.Context) (int, bool) {
    id, ok := ctx.Value(userIDKey).(int)
    return id, ok
}

// Usage in handler:
func (h *JobHandler) GetJobs(w http.ResponseWriter, r *http.Request) {
    userID, ok := UserIDFromContext(r.Context())
    if !ok {
        http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
        return
    }
    // ...
}
```

**Critical fix #2 — Request body limit + proper error responses:**
```go
func (h *JobHandler) CreateJob(w http.ResponseWriter, r *http.Request) {
    // Limit request body to 1MB
    r.Body = http.MaxBytesReader(w, r.Body, 1<<20)

    var req CreateJobRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        respondError(w, http.StatusBadRequest, "invalid request body")
        return
    }

    if err := req.Validate(); err != nil {
        respondError(w, http.StatusBadRequest, err.Error())
        return
    }
    // ...
}

// respondJSON writes a JSON response with status code.
func respondJSON(w http.ResponseWriter, status int, data any) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    if err := json.NewEncoder(w).Encode(data); err != nil {
        // Log but don't try to write again
        slog.Error("failed to encode response", "error", err)
    }
}

// respondError writes a JSON error response.
func respondError(w http.ResponseWriter, status int, message string) {
    respondJSON(w, status, map[string]string{"error": message})
}
```

---

### 2.5 `backend/internal/handlers/file_transfer.go` — Priority: P1

**Keep, needs error handling fix.**

**Issues:**
| Issue | Severity | Detail |
|---|---|---|
| Double-write on error | HIGH | Service writes `http.Error()` then handler also might write — causes superfluous `WriteHeader` call |
| No auth on endpoints | CRITICAL | Upload/download authenticated only by query param token — no JWT |
| Uses `*services.FileTransferService` concrete type | MEDIUM | Should be interface |
| Package-level `log.Printf` | LOW | Should use structured logger |

---

### 2.6 `backend/internal/handlers/auth_handler.go` — Priority: P0

**This file is an empty stub.**

```go
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
    // Implementierung...
}
```

- `Login` does nothing
- `RefreshToken` and `GetCurrentUser` referenced in router but not defined
- Wrong import path (`github.com/your-username/fileflux/...`)

There is **no working authentication flow whatsoever**. The middleware is empty, the handler is empty, `getUserIDFromContext` returns `1`.

---

### 2.7 `backend/internal/websocket/manager.go` — Priority: P1

**Well-structured, but has critical auth bypass + resource leaks.**

**Issues:**
| Issue | Severity | Detail |
|---|---|---|
| `validateToken()` returns hardcoded `(1, nil)` | CRITICAL | **Any WebSocket connection is accepted as agent 1** |
| `CheckOrigin: func(r *http.Request) bool { return true }` | HIGH | Accepts connections from any origin — CSRF risk |
| No `context.Context` usage | HIGH | No cancellation propagation to goroutines |
| `writePump` batches messages unsafely | MEDIUM | The `n := len(c.send)` drain loop concatenates raw JSON without delimiters — receiver gets corrupted payloads |
| `readPump` sets 4096 byte read limit | MEDIUM | Too small for transfer data; should be configurable |
| No reconnection backoff | MEDIUM | Agent disconnects flood status updates |
| No max connections limit | MEDIUM | Unbounded `clients` map — DoS vector |
| Multiple TODO comments | HIGH | Transfer progress, completion, error — all unimplemented |

**Critical fix #3 — writePump message batching:**
```go
// writePump sends messages to the WebSocket connection.
func (c *Client) writePump() {
    ticker := time.NewTicker(30 * time.Second)
    defer func() {
        ticker.Stop()
        c.conn.Close()
    }()

    for {
        select {
        case message, ok := <-c.send:
            c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
            if !ok {
                c.conn.WriteMessage(websocket.CloseMessage, []byte{})
                return
            }

            // Write each message as a separate WebSocket frame
            if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
                return
            }

            // Drain queued messages — each as its own frame
            n := len(c.send)
            for i := 0; i < n; i++ {
                if err := c.conn.WriteMessage(websocket.TextMessage, <-c.send); err != nil {
                    return
                }
            }

        case <-ticker.C:
            c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
            if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
                return
            }
        }
    }
}
```

---

### 2.8 `backend/internal/websocket/protocol.go` — Priority: P2

**Good structure. Duplicate `Message` type.**

The `Message` struct is defined in both `protocol.go` and `manager.go` — same package, same name. This would cause a **compile error**.

`protocol.go` also defines `MessageType` as `string` but `manager.go` uses `Message.Type` as plain `string`. They're incompatible.

**Fix:** Delete the `Message` struct from `manager.go`, use the one in `protocol.go`.

---

### 2.9 `backend/internal/models/models.go` — Priority: P2

**Incomplete. Only defines `Agent` + error sentinels.**

The `Job` model is in `models/job.go`, `User` in `models/user.go`, `Transfer` in `models/transfer.go`. These are fine individually but:

| Issue | Severity | Detail |
|---|---|---|
| No validation methods | MEDIUM | Models are pure data bags — validation is scattered in handlers |
| `Job.UserID` not in SQL schema | HIGH | Schema has no `user_id` column on `jobs` table |
| `User.Auth0ID` not in SQL schema | HIGH | Schema `users` has `password_hash`, not `auth0_id` |
| `User.SubscriptionTier` not in schema | HIGH | Schema has no `subscription_tier` column |
| `Transfer.Compressed/TotalChunks/CompletedChunks` not in schema | HIGH | Schema doesn't match model |
| `Agent` model is duplicated | HIGH | Exists in both `internal/models/` and `pkg/domain/agents/` with different fields |

**The database schema and Go models are out of sync.** This means queries will fail at runtime.

---

### 2.10 `backend/internal/db/database.go` — Priority: P1

**Reasonable structure, missing critical features.**

**Issues:**
| Issue | Severity | Detail |
|---|---|---|
| Uses `ioutil.ReadFile` | LOW | Deprecated since Go 1.16, use `os.ReadFile` |
| `Initialize()` reads schema from relative path | HIGH | Breaks when binary is run from another directory |
| No connection pooling config | HIGH | No `SetMaxOpenConns`, `SetMaxIdleConns`, `SetConnMaxLifetime` |
| No context.Context on queries | HIGH | All methods lack context — no timeout/cancel |
| Only Agent CRUD implemented | HIGH | Comment says "weitere Methoden würden hier folgen" but `GetJobs`, `GetUser` etc. referenced in handlers don't exist |
| Error messages in German | LOW | `"fehler beim Öffnen..."` |
| No transaction support | MEDIUM | Multi-step operations can leave partial state |
| Leaks `*sql.DB` as `Database.db` | LOW | Field should be unexported (it is — good) |

**Critical fix #4 — Connection pool config + context:**
```go
func NewDatabase(cfg DatabaseConfig) (*Database, error) {
    connStr := fmt.Sprintf(
        "host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
        cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.Database, cfg.SSLMode,
    )

    db, err := sql.Open("postgres", connStr)
    if err != nil {
        return nil, fmt.Errorf("opening database: %w", err)
    }

    // Connection pool settings
    db.SetMaxOpenConns(25)
    db.SetMaxIdleConns(5)
    db.SetConnMaxLifetime(5 * time.Minute)
    db.SetConnMaxIdleTime(1 * time.Minute)

    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    if err := db.PingContext(ctx); err != nil {
        return nil, fmt.Errorf("pinging database: %w", err)
    }

    return &Database{db: db}, nil
}

// GetAgent retrieves an agent by ID.
func (d *Database) GetAgent(ctx context.Context, id int) (*models.Agent, error) {
    var agent models.Agent
    err := d.db.QueryRowContext(ctx, `
        SELECT id, name, type, status, ip_address, system, version,
               last_seen, description, created_at
        FROM agents WHERE id = $1
    `, id).Scan(
        &agent.ID, &agent.Name, &agent.Type, &agent.Status,
        &agent.IPAddress, &agent.System, &agent.Version,
        &agent.LastSeen, &agent.Description, &agent.CreatedAt,
    )
    if errors.Is(err, sql.ErrNoRows) {
        return nil, fmt.Errorf("agent %d: %w", id, ErrNotFound)
    }
    if err != nil {
        return nil, fmt.Errorf("querying agent %d: %w", id, err)
    }
    return &agent, nil
}
```

---

### 2.11 `backend/internal/db/schema.sql` — Priority: P1

**Issues:**
| Issue | Severity | Detail |
|---|---|---|
| No `user_id` on `jobs` or `agents` tables | CRITICAL | Multi-tenancy is impossible — no data isolation |
| Hardcoded admin password hash | CRITICAL | `$2a$10$N9qo8uLO...` — known bcrypt hash, probably "password" |
| No indexes beyond PKs | HIGH | No index on `jobs.status`, `transfers.status`, `tokens.agent_id` |
| `SERIAL` instead of `UUID` | MEDIUM | Integer PKs leak cardinality and are guessable |
| No `updated_at` columns | MEDIUM | Can't track when records changed |
| No migration framework | HIGH | Raw DDL — no up/down migrations, no version tracking |
| No `subscription_tier` on users | HIGH | Model references it, schema doesn't have it |
| No soft deletes | MEDIUM | `DELETE` is permanent — no audit trail |

---

### 2.12 `backend/internal/middleware/auth.go` — Priority: P0

**This file is an empty skeleton:**
```go
func Auth(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // JWT-Token-Validierung...
    })
}
```

**There is no authentication.** The function wraps `next` and passes through unconditionally (the comment is the entire implementation). Every "protected" route is actually public.

**Critical fix #5 — Real JWT middleware:**
```go
package middleware

import (
    "context"
    "net/http"
    "strings"

    "github.com/golang-jwt/jwt/v5"
)

type contextKey string

const UserIDKey contextKey = "userID"

// Auth returns middleware that validates JWT bearer tokens.
func Auth(secret string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            authHeader := r.Header.Get("Authorization")
            if authHeader == "" {
                http.Error(w, `{"error":"missing authorization header"}`, http.StatusUnauthorized)
                return
            }

            parts := strings.SplitN(authHeader, " ", 2)
            if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
                http.Error(w, `{"error":"invalid authorization format"}`, http.StatusUnauthorized)
                return
            }

            token, err := jwt.Parse(parts[1], func(t *jwt.Token) (any, error) {
                if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
                    return nil, jwt.ErrSignatureInvalid
                }
                return []byte(secret), nil
            })
            if err != nil || !token.Valid {
                http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
                return
            }

            claims, ok := token.Claims.(jwt.MapClaims)
            if !ok {
                http.Error(w, `{"error":"invalid claims"}`, http.StatusUnauthorized)
                return
            }

            userID, ok := claims["sub"].(float64)
            if !ok {
                http.Error(w, `{"error":"invalid subject claim"}`, http.StatusUnauthorized)
                return
            }

            ctx := context.WithValue(r.Context(), UserIDKey, int(userID))
            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }
}
```

---

### 2.13 `backend/internal/services/file_transfer_service.go` — Priority: P0

**Fundamentally broken for production use.**

**Issues:**
| Issue | Severity | Detail |
|---|---|---|
| **In-memory storage** (`var fileStorage = make(map[string][]byte)`) | CRITICAL | All files lost on process restart. Global mutable state. |
| 10 MB upload limit (`10 << 20`) | HIGH | Useless for a file transfer product |
| Token passed as query parameter | HIGH | Tokens visible in logs, browser history, referrer headers |
| `io.ReadAll(file)` loads entire file into memory | CRITICAL | 1 GB file = 1 GB RAM per upload |
| No streaming | CRITICAL | File must fully upload before download can start |
| No file metadata | HIGH | Filename, content-type, size are discarded |
| Global `var` with mutex | HIGH | Not testable, not injectable, breaks concurrent tests |
| Delete-on-download | MEDIUM | One failed download and the file is gone forever |
| No upload progress tracking | MEDIUM | No way to know transfer state |
| Wrong import path | HIGH | `github.com/stefanposs/file-flux/backend/pkg/config` — different config than internal/ |

**This service is a prototype and must be completely rewritten with:**
- Disk or object storage (S3/MinIO) backend
- Streaming with `io.Copy` — never load full files into memory
- Chunked transfer support
- Resumable uploads
- Content-addressed storage for deduplication

---

## 3. Dead Code Inventory

| Path | Type | Action |
|---|---|---|
| `backend/src/server.js` | Node.js Express server | DELETE |
| `backend/src/utils/setupDb.js` | Node.js DB setup | DELETE |
| `backend/pkg/api/server.go` | Gin-based server (code path 1) | DELETE |
| `backend/pkg/config/config.go` | Duplicate config (env-only) | DELETE |
| `backend/pkg/domain/agents/` | GORM agent models | DELETE |
| `backend/pkg/domain/jobs/` | GORM job models | DELETE |
| `backend/cmd/server/main.go` | Gin entry point | DELETE |
| `backend/internal/database/db.go` | 3rd database abstraction | DELETE |
| `backend/internal/auth/auth.go` | Auth0 SDK middleware (unused) | DELETE |
| `backend/internal/auth/auth0.go` | Manual Auth0 validation (deprecated jwt lib) | DELETE |
| `backend/internal/payment/stripe.go` | Referenced only from `cmd/main.go` | EVALUATE — keep if Stripe is planned |

**Dead code constitutes ~60% of the backend Go source.**

---

## 4. Dependency Analysis

### Currently Declared (go.mod)
| Dependency | Used By | Verdict |
|---|---|---|
| `github.com/gin-gonic/gin` | `pkg/api/server.go` only | DELETE — dead code path |
| `gorm.io/gorm` + `gorm.io/driver/postgres` | `pkg/domain/` only | DELETE — dead code path |
| `go.uber.org/zap` | `cmd/server/main.go` + `pkg/` | DELETE — use `log/slog` (stdlib) |
| `github.com/stretchr/testify` | Nothing (zero tests) | KEEP — will need for actual tests |
| `github.com/google/uuid` | `pkg/domain/` models | KEEP if switching to UUID PKs |
| `github.com/gorilla/mux` | `internal/api/router.go`, `cmd/main.go` | KEEP (move to direct) |

### Missing from go.mod (but imported)
| Package | Required By |
|---|---|
| `github.com/gorilla/websocket` | `internal/websocket/manager.go` |
| `github.com/lib/pq` | `internal/db/database.go` |
| `gopkg.in/yaml.v2` | `internal/config/config.go` |
| `github.com/joho/godotenv` | `cmd/main.go` |
| `github.com/rs/cors` | `cmd/main.go` |
| `github.com/auth0/go-jwt-middleware/v2` | `internal/auth/auth.go` |
| `github.com/dgrijalva/jwt-go` | `internal/auth/auth0.go` (DEPRECATED — CVE-2020-26160) |

---

## 5. Top 5 Critical Fixes (with code)

Already provided inline above:

1. **Fix #1** (§2.4) — `getUserIDFromContext` auth bypass → proper context extraction
2. **Fix #2** (§2.4) — Request body limits + standardized JSON error responses
3. **Fix #3** (§2.7) — WebSocket writePump message corruption
4. **Fix #4** (§2.10) — Database connection pool + context propagation
5. **Fix #5** (§2.12) — Real JWT auth middleware (replaces empty stub)

---

## 6. Priority Matrix

### P0 — Ship-blocking (do these first)
| # | Issue | File(s) |
|---|---|---|
| 1 | Delete 2 of 3 code paths + all dead code | Multiple |
| 2 | Fix all import paths to match `go.mod` module | All files |
| 3 | Implement real auth middleware | `middleware/auth.go` |
| 4 | Fix `getUserIDFromContext` hardcoded return | `handlers/job_handler.go` |
| 5 | Fix `validateToken` hardcoded return | `websocket/manager.go` |
| 6 | Implement `auth_handler.go` Login/Refresh | `handlers/auth_handler.go` |
| 7 | Replace in-memory file storage | `services/file_transfer_service.go` |
| 8 | Remove hardcoded admin password from schema | `db/schema.sql` |
| 9 | Sync models with database schema | `models/*.go` + `schema.sql` |

### P1 — Required for beta
| # | Issue | File(s) |
|---|---|---|
| 10 | Add `context.Context` to all DB methods | `db/database.go` |
| 11 | Configure DB connection pool | `db/database.go` |
| 12 | Add pagination to list endpoints | `handlers/job_handler.go` |
| 13 | Add request body size limits | All handlers |
| 14 | Implement WebSocket transfer progress/complete/error | `websocket/manager.go` |
| 15 | Add proper CORS configuration | `middleware/` |
| 16 | Add rate limiting | `middleware/` |
| 17 | Add multi-tenancy (`user_id` FK) to schema | `schema.sql` |
| 18 | Add database indexes | `schema.sql` |
| 19 | Introduce migration framework (golang-migrate) | New |
| 20 | Add structured logging with `log/slog` | All files |
| 21 | Fix WebSocket origin checking | `websocket/manager.go` |

### P2 — Production hardening
| # | Issue | File(s) |
|---|---|---|
| 22 | Write tests (target 80% coverage) | New `*_test.go` files |
| 23 | Add health check endpoint | `router.go` |
| 24 | Add graceful shutdown with drain | `cmd/main.go` |
| 25 | Add OpenTelemetry tracing | New |
| 26 | Add Prometheus metrics | New |
| 27 | Switch to UUID primary keys | Schema + models |
| 28 | Add input validation library | Handlers |
| 29 | Standardize language (all English) | All files |
| 30 | Add Makefile targets for lint, test, build | `Makefile` |

---

## 7. Recommended Target Architecture

After cleanup, the backend should look like:

```
backend/
├── cmd/
│   └── server/
│       └── main.go              # Single entry point
├── internal/
│   ├── api/
│   │   └── router.go            # Route registration
│   ├── config/
│   │   └── config.go            # YAML + env config
│   ├── db/
│   │   ├── db.go                # *sql.DB wrapper with context
│   │   ├── migrations/          # golang-migrate files
│   │   ├── agent.go             # Agent queries
│   │   ├── job.go               # Job queries
│   │   ├── transfer.go          # Transfer queries
│   │   └── user.go              # User queries
│   ├── domain/
│   │   ├── errors.go            # Sentinel errors
│   │   ├── agent.go             # Agent model + validation
│   │   ├── job.go               # Job model + validation
│   │   ├── transfer.go          # Transfer model + validation
│   │   └── user.go              # User model + validation
│   ├── handlers/
│   │   ├── response.go          # respondJSON, respondError helpers
│   │   ├── auth.go              # Auth handler
│   │   ├── job.go               # Job handler
│   │   ├── agent.go             # Agent handler
│   │   └── transfer.go          # Transfer handler
│   ├── middleware/
│   │   ├── auth.go              # JWT validation
│   │   ├── cors.go              # CORS
│   │   ├── logging.go           # Request logging
│   │   ├── ratelimit.go         # Rate limiting
│   │   └── recovery.go          # Panic recovery
│   ├── service/
│   │   ├── job.go               # Job business logic
│   │   └── transfer.go          # File transfer (disk/S3)
│   └── websocket/
│       ├── manager.go           # Connection manager
│       └── protocol.go          # Message types
├── go.mod
├── go.sum
└── Makefile
```

---

## 8. Conclusion

This codebase is in **prototype/exploration phase**, not enterprise-ready. The most generous interpretation is that three developers each started building the backend independently and nobody merged their work. The result is a codebase that:

1. **Cannot compile** (`go build ./...` fails due to import path conflicts)
2. **Has zero authentication** (every "protected" endpoint is public)
3. **Stores files in RAM** (data loss guaranteed)
4. **Has zero tests** (no confidence in any behavior)
5. **Contains ~60% dead code** (3 competing architectures + Node.js remnants)

**Estimated effort to reach MVP:** 3-4 weeks for a senior Go developer.
**Estimated effort to reach enterprise-ready:** 8-12 weeks including tests, observability, and security hardening.

The positive: the WebSocket protocol design is solid, the domain models are reasonable, and the `internal/` package structure follows Go conventions. There's a viable product architecture buried under the dead code — it just needs disciplined execution to extract and finish it.
