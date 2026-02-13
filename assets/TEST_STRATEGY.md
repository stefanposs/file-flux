# File Flux — Comprehensive Test Strategy

**Version:** 1.0
**Date:** 2026-02-12
**Status:** Proposed
**Applies to:** Backend (Go), Agent (Go), Frontend (TypeScript/Lit)

---

## Table of Contents

1. [Current State & Rationale](#1-current-state--rationale)
2. [Test Pyramid](#2-test-pyramid)
3. [Go Testing Approach (Backend + Agent)](#3-go-testing-approach-backend--agent)
4. [Frontend Testing Approach](#4-frontend-testing-approach)
5. [Integration Test Approach](#5-integration-test-approach)
6. [E2E Test Approach](#6-e2e-test-approach)
7. [Performance Testing](#7-performance-testing)
8. [Test File Structure](#8-test-file-structure)
9. [CI Integration (GitHub Actions)](#9-ci-integration-github-actions)
10. [Critical Test Scenarios — Priority List](#10-critical-test-scenarios--priority-list)
11. [Effort Estimate](#11-effort-estimate)
12. [Appendix: Example Tests](#appendix-example-tests)

---

## 1. Current State & Rationale

### 1.1 Current State

| Area | Tests | Coverage |
|------|-------|----------|
| Backend (Go) | **0** test files | 0% |
| Agent (Go) | **0** test files | 0% |
| Frontend (TS/Lit) | **0** test files, no test runner configured | 0% |

The codebase has **zero automated tests** today. `testify` is already a dependency in the backend `go.mod`, but no test files exist. The frontend has no test runner, no test framework, and no test DevDependencies.

### 1.2 Key Risks Driving This Strategy

| Risk | Severity | Test Mitigation |
|------|----------|-----------------|
| Token validation is hardcoded `return 1, nil` | 🔴 Critical | Unit test token validation; integration test JWT flow |
| Transfer engine uses in-memory buffer, 10 MB limit | 🔴 Critical | Integration test chunked transfer; performance test large files |
| WebSocket manager has no message validation | 🟡 Major | Unit test message dispatch; integration test WS protocol |
| Dual architecture (gorilla/mux + gin/gorm) | 🟡 Major | Tests pin the chosen stack, prevent regression |
| No retry/error handling in transfer flow | 🟠 Moderate | Unit test retry policies; integration test failure recovery |

### 1.3 Coverage Targets

| Component | Unit | Integration | E2E | Overall Target |
|-----------|------|-------------|-----|----------------|
| Backend business logic | 85% | — | — | **80%+** |
| Backend handlers/middleware | 75% | 70% | — | **80%+** |
| Backend DB repositories | — | 80% | — | **80%+** |
| Agent core (chunking, hashing, compression) | 90% | — | — | **80%+** |
| Agent WebSocket client | 70% | 80% | — | **80%+** |
| Frontend components | 70% | — | — | **70%+** |
| Frontend state/routing | 80% | — | — | **70%+** |
| Full system (E2E) | — | — | Critical paths | — |

---

## 2. Test Pyramid

```
            ╱╲
           ╱E2E╲             ~5%   │ 8–12 scenarios
          ╱──────╲                  │ Playwright, Docker Compose
         ╱Contract╲           ~5%  │ WebSocket protocol contract
        ╱────────────╲              │ between Backend ↔ Agent
       ╱ Integration   ╲     ~25%  │ DB repos, WS flows,
      ╱──────────────────╲         │ transfer pipeline
     ╱    Unit Tests       ╲  ~65% │ Handlers, services, models,
    ╱────────────────────────╲     │ chunking, hashing, compression
```

### Distribution by Component

| Layer | Backend | Agent | Frontend | Total Est. |
|-------|---------|-------|----------|------------|
| Unit | ~120 tests | ~60 tests | ~80 tests | ~260 |
| Integration | ~40 tests | ~15 tests | ~10 tests | ~65 |
| Contract | ~10 tests | ~10 tests | — | ~20 |
| E2E | — | — | ~10 scenarios | ~10 |
| **Total** | **~170** | **~85** | **~100** | **~355** |

---

## 3. Go Testing Approach (Backend + Agent)

### 3.1 Frameworks & Libraries

| Purpose | Tool | Rationale |
|---------|------|-----------|
| Test runner | `go test` (stdlib) | Native, fast, CI-friendly |
| Assertions | `github.com/stretchr/testify` (already in go.mod) | `assert` + `require` + `suite` |
| Mocks | `github.com/stretchr/testify/mock` | Interface-based mocking |
| Mock generation | `github.com/vektra/mockery/v2` | Auto-generate mocks from interfaces |
| HTTP testing | `net/http/httptest` (stdlib) | In-process HTTP server for handler tests |
| WebSocket testing | `github.com/gorilla/websocket` + `httptest` | Test WS upgrade + message exchange |
| DB integration | `github.com/testcontainers/testcontainers-go` | PostgreSQL in Docker for repo tests |
| Coverage | `go test -coverprofile` + `go tool cover` | HTML reports, CI enforcement |
| Benchmarks | `testing.B` (stdlib) | Transfer throughput, hashing perf |

### 3.2 Mocking Strategy — Interfaces First

The codebase currently has **concrete struct dependencies** (handlers take `*db.Database` directly). Tests require introducing interfaces at domain boundaries.

**Step 1: Define repository interfaces**

```go
// backend/internal/domain/agent/repository.go
type AgentRepository interface {
    GetAll(ctx context.Context) ([]Agent, error)
    GetByID(ctx context.Context, id int) (*Agent, error)
    Create(ctx context.Context, agent *Agent) error
    Update(ctx context.Context, agent *Agent) error
    Delete(ctx context.Context, id int) error
    UpdateStatus(ctx context.Context, id int, status string) error
}
```

**Step 2: Generate mocks**

```bash
# Install mockery
go install github.com/vektra/mockery/v2@latest

# Generate mocks for all interfaces in domain/
mockery --dir=internal/domain --all --output=internal/mocks --outpkg=mocks
```

**Step 3: Use mocks in handler tests**

```go
func TestGetAgents_ReturnsJSON(t *testing.T) {
    mockRepo := mocks.NewAgentRepository(t)
    mockRepo.EXPECT().GetAll(mock.Anything).Return([]agent.Agent{
        {ID: 1, Name: "agent-1", Status: "online"},
    }, nil)

    handler := handlers.NewAgentHandler(mockRepo, zap.NewNop().Sugar())
    req := httptest.NewRequest(http.MethodGet, "/api/agents", nil)
    rec := httptest.NewRecorder()

    handler.GetAgents(rec, req)

    assert.Equal(t, http.StatusOK, rec.Code)
    // ...
}
```

### 3.3 Table-Driven Tests

Use Go's idiomatic table-driven pattern for all tests with multiple input/output combinations.

```go
func TestValidateToken(t *testing.T) {
    tests := []struct {
        name      string
        token     string
        wantID    int
        wantErr   bool
        errMsg    string
    }{
        {
            name:    "valid token returns agent ID",
            token:   "valid-token-abc",
            wantID:  42,
            wantErr: false,
        },
        {
            name:    "expired token returns error",
            token:   "expired-token",
            wantID:  0,
            wantErr: true,
            errMsg:  "token expired",
        },
        {
            name:    "empty token returns error",
            token:   "",
            wantID:  0,
            wantErr: true,
            errMsg:  "token required",
        },
        {
            name:    "revoked token returns error",
            token:   "revoked-token",
            wantID:  0,
            wantErr: true,
            errMsg:  "token revoked",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Arrange
            mgr := setupManagerWithTokens(t)

            // Act
            id, err := mgr.validateToken(tt.token)

            // Assert
            if tt.wantErr {
                require.Error(t, err)
                assert.Contains(t, err.Error(), tt.errMsg)
            } else {
                require.NoError(t, err)
                assert.Equal(t, tt.wantID, id)
            }
        })
    }
}
```

### 3.4 Test Helpers & Fixtures

```go
// backend/internal/testutil/helpers.go
package testutil

// AuthenticatedRequest creates an http.Request with a valid JWT in the Authorization header.
func AuthenticatedRequest(t *testing.T, method, path string, body io.Reader, userID int, role string) *http.Request {
    t.Helper()
    req := httptest.NewRequest(method, path, body)
    token := GenerateTestJWT(t, userID, role)
    req.Header.Set("Authorization", "Bearer "+token)
    return req
}

// GenerateTestJWT creates a valid JWT for test purposes.
func GenerateTestJWT(t *testing.T, userID int, role string) string {
    t.Helper()
    // ... sign with test secret
}

// JSONBody marshals v to a *bytes.Reader for use as request body.
func JSONBody(t *testing.T, v interface{}) *bytes.Reader {
    t.Helper()
    data, err := json.Marshal(v)
    require.NoError(t, err)
    return bytes.NewReader(data)
}
```

### 3.5 Build Tags for Test Separation

```go
//go:build integration
// +build integration

package postgres_test

// Integration tests that require a real PostgreSQL
```

```go
//go:build e2e
// +build e2e

package e2e_test

// End-to-end tests that require the full stack
```

**Run commands:**

```bash
# Unit tests only (default, no tags)
go test ./...

# Integration tests
go test -tags=integration ./...

# All tests
go test -tags="integration e2e" ./...
```

---

## 4. Frontend Testing Approach

### 4.1 Frameworks & Libraries

| Purpose | Tool | Rationale |
|---------|------|-----------|
| Test runner | **Vitest** | Vite-native, fast, ESM-first, already using Vite |
| DOM environment | **happy-dom** or **jsdom** | Lightweight DOM for Web Component tests |
| WC testing | **@open-wc/testing** | Lit-specific test helpers (`fixture`, `html`) |
| Assertions | Vitest built-in (`expect`) | Chai-compatible, zero config |
| Coverage | **v8** (via Vitest) | Native V8 coverage, fast |
| E2E | **Playwright** | Cross-browser, reliable for WC |

### 4.2 Installation

```bash
cd frontend
npm install -D vitest @open-wc/testing @open-wc/testing-helpers happy-dom
```

Add to `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test"
  }
}
```

Add `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },
  },
});
```

### 4.3 Web Component Testing Pattern

```typescript
// src/components/dashboard/dashboard.test.ts
import { fixture, html, expect } from '@open-wc/testing';
import './dashboard';
import type { Dashboard } from './dashboard';

describe('ff-dashboard', () => {
  it('renders loading spinner initially', async () => {
    const el = await fixture<Dashboard>(html`<ff-dashboard></ff-dashboard>`);
    const spinner = el.shadowRoot!.querySelector('.loading-spinner');
    expect(spinner).to.exist;
  });

  it('renders stats cards after data loads', async () => {
    const el = await fixture<Dashboard>(html`<ff-dashboard></ff-dashboard>`);
    // Simulate data load
    (el as any).isLoading = false;
    (el as any).stats = {
      activeJobs: 5,
      completedTransfers: 100,
      failedTransfers: 2,
      onlineAgents: 3,
      totalAgents: 5,
      transferVolume: 1024000,
      recentTransfers: [],
      pendingTransfers: [],
    };
    await el.updateComplete;

    const cards = el.shadowRoot!.querySelectorAll('.stat-card');
    expect(cards.length).to.be.greaterThan(0);
  });

  it('dispatches refresh event on button click', async () => {
    const el = await fixture<Dashboard>(html`<ff-dashboard></ff-dashboard>`);
    (el as any).isLoading = false;
    await el.updateComplete;

    let refreshed = false;
    el.addEventListener('refresh', () => { refreshed = true; });

    const btn = el.shadowRoot!.querySelector('.refresh-button') as HTMLButtonElement;
    btn?.click();
    expect(refreshed).to.be.true;
  });
});
```

### 4.4 State Management Testing

```typescript
// src/utils/demo-mode.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { initDemoMode, getDemoJobs, getDemoAgents, getDemoTransfers } from './demo-mode';

describe('Demo Mode', () => {
  beforeEach(() => {
    initDemoMode();
  });

  it('returns non-empty job list', () => {
    const jobs = getDemoJobs();
    expect(jobs.length).toBeGreaterThan(0);
  });

  it('returns agents with valid status values', () => {
    const agents = getDemoAgents();
    agents.forEach(a => {
      expect(['online', 'offline', 'error']).toContain(a.status);
    });
  });
});
```

### 4.5 Router Testing

```typescript
describe('App Router', () => {
  it('navigates to /jobs and renders job-list', async () => {
    window.history.pushState({}, '', '/jobs');
    const el = await fixture(html`<file-flux-app></file-flux-app>`);
    // Simulate authenticated state
    (el as any).isAuthenticated = true;
    (el as any).isLoading = false;
    await el.updateComplete;

    const jobList = el.shadowRoot!.querySelector('ff-job-list');
    expect(jobList).to.exist;
  });
});
```

---

## 5. Integration Test Approach

### 5.1 Database Integration (testcontainers-go)

```go
//go:build integration

package postgres_test

import (
    "context"
    "testing"

    "github.com/stretchr/testify/suite"
    "github.com/testcontainers/testcontainers-go"
    "github.com/testcontainers/testcontainers-go/modules/postgres"
    "github.com/testcontainers/testcontainers-go/wait"
)

type DBSuite struct {
    suite.Suite
    container *postgres.PostgresContainer
    db        *db.Database
}

func (s *DBSuite) SetupSuite() {
    ctx := context.Background()
    container, err := postgres.Run(ctx,
        "postgres:14",
        postgres.WithDatabase("fileflux_test"),
        postgres.WithUsername("test"),
        postgres.WithPassword("test"),
        testcontainers.WithWaitStrategy(
            wait.ForLog("database system is ready to accept connections").
                WithOccurrence(2),
        ),
    )
    s.Require().NoError(err)
    s.container = container

    connStr, err := container.ConnectionString(ctx, "sslmode=disable")
    s.Require().NoError(err)

    s.db, err = db.NewDatabaseFromConnStr(connStr)
    s.Require().NoError(err)
    s.Require().NoError(s.db.Initialize())
}

func (s *DBSuite) TearDownSuite() {
    s.container.Terminate(context.Background())
}

func (s *DBSuite) SetupTest() {
    // Truncate all tables between tests for isolation
    _, err := s.db.Exec("TRUNCATE agents, jobs, transfers, tokens, users RESTART IDENTITY CASCADE")
    s.Require().NoError(err)
}

func (s *DBSuite) TestCreateAndGetAgent() {
    agent := models.Agent{Name: "test-agent", Type: "server", Status: "offline"}
    err := s.db.CreateAgent(&agent)
    s.Require().NoError(err)
    s.Assert().Greater(agent.ID, 0)

    fetched, err := s.db.GetAgent(agent.ID)
    s.Require().NoError(err)
    s.Assert().Equal("test-agent", fetched.Name)
}

func (s *DBSuite) TestGetAgents_Empty() {
    agents, err := s.db.GetAgents()
    s.Require().NoError(err)
    s.Assert().Empty(agents)
}

func TestDBSuite(t *testing.T) {
    suite.Run(t, new(DBSuite))
}
```

### 5.2 WebSocket Integration Testing

```go
//go:build integration

package websocket_test

import (
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "strings"
    "testing"
    "time"

    ws "github.com/gorilla/websocket"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func TestWebSocketHandshake(t *testing.T) {
    // Arrange — start a test server with the WS manager
    manager := setupTestManager(t)
    server := httptest.NewServer(manager.Handler())
    defer server.Close()

    wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws/agent"

    // Act — connect with valid token
    header := http.Header{}
    header.Set("Authorization", "Bearer valid-test-token")
    conn, resp, err := ws.DefaultDialer.Dial(wsURL, header)

    // Assert
    require.NoError(t, err)
    assert.Equal(t, http.StatusSwitchingProtocols, resp.StatusCode)
    defer conn.Close()
}

func TestWebSocketHeartbeat(t *testing.T) {
    manager, conn := setupConnectedAgent(t)
    defer conn.Close()

    // Send heartbeat
    msg := websocket.Message{
        Type: "heartbeat",
        Data: json.RawMessage(`{"agent_id":1,"timestamp":"2026-02-12T00:00:00Z"}`),
    }
    data, _ := json.Marshal(msg)
    err := conn.WriteMessage(ws.TextMessage, data)
    require.NoError(t, err)

    // Verify agent status updated
    time.Sleep(100 * time.Millisecond)
    assert.True(t, manager.IsAgentOnline(1))
}

func TestWebSocketRejectsInvalidToken(t *testing.T) {
    manager := setupTestManager(t)
    server := httptest.NewServer(manager.Handler())
    defer server.Close()

    wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws/agent"
    header := http.Header{}
    header.Set("Authorization", "Bearer invalid-token")

    _, resp, err := ws.DefaultDialer.Dial(wsURL, header)
    assert.Error(t, err)
    assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}
```

### 5.3 Transfer Pipeline Integration (Agent ↔ Backend)

```go
//go:build integration

func TestTransferPipeline_SmallFile(t *testing.T) {
    // Arrange
    backend := startTestBackend(t)        // httptest server with real DB
    agent := startTestAgent(t, backend.URL) // connects via WS
    defer backend.Close()

    // Create a temp file (1 KB)
    srcFile := createTempFile(t, 1024)

    // Act — trigger a transfer job
    jobID := createTransferJob(t, backend.URL, srcFile, "/tmp/dest/")

    // Wait for transfer completion (with timeout)
    waitForTransferStatus(t, backend.URL, jobID, "completed", 10*time.Second)

    // Assert — verify file arrived at destination
    destFile := filepath.Join("/tmp/dest/", filepath.Base(srcFile))
    assert.FileExists(t, destFile)
    assertFilesEqual(t, srcFile, destFile)
}
```

### 5.4 Contract Tests (Backend ↔ Agent WebSocket Protocol)

The WebSocket protocol defined in `backend/internal/websocket/protocol.go` is a shared contract. Both sides must agree on message shapes.

```go
// Shared contract test data
var protocolTestCases = []struct {
    name     string
    msgType  string
    payload  string
    valid    bool
}{
    {"valid heartbeat", "heartbeat", `{"agent_id":1,"timestamp":"2026-02-12T00:00:00Z"}`, true},
    {"valid transfer_progress", "transfer_progress", `{"transfer_id":"abc","progress":0.5}`, true},
    {"unknown message type", "unknown_type", `{}`, false},
    {"missing transfer_id in progress", "transfer_progress", `{"progress":0.5}`, false},
}
```

Test both the **producer** (agent) and **consumer** (backend) serialize/deserialize identically.

---

## 6. E2E Test Approach

### 6.1 Tool: Playwright

| Criterion | Choice | Notes |
|-----------|--------|-------|
| Browser automation | **Playwright** | Fast, reliable, cross-browser, first-class Shadow DOM support (critical for Lit) |
| Runner | `@playwright/test` | Built-in test runner with parallel execution |
| Environment | Docker Compose | Spin up full stack: PostgreSQL + Backend + Frontend + Agent |

### 6.2 Setup

```bash
cd frontend
npm install -D @playwright/test
npx playwright install --with-deps chromium
```

`playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'docker compose -f ../docker-compose.yml up --build --wait',
    url: 'http://localhost:3000',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
```

### 6.3 Critical E2E Scenarios

| # | Scenario | Priority | Steps |
|---|----------|----------|-------|
| 1 | **Login → Dashboard** | P0 | Enter credentials → see dashboard with stats |
| 2 | **Create Agent Token** | P0 | Navigate to Tokens → Create → Copy token → Verify in list |
| 3 | **Agent Connects** | P0 | Start agent with token → verify "online" status on Agents page |
| 4 | **Create & Run Job** | P0 | Create job with source/dest → Run → Verify transfer starts |
| 5 | **Transfer Completes** | P0 | Upload file → Verify progress → Confirm "completed" status |
| 6 | **Transfer Error Handling** | P1 | Trigger invalid path → Verify error state + error message |
| 7 | **Job Scheduling (Cron)** | P1 | Create scheduled job → Verify next run time displayed |
| 8 | **Cancel Transfer** | P1 | Start transfer → Cancel → Verify "cancelled" status |
| 9 | **Agent Disconnection** | P2 | Kill agent → Verify "offline" status within heartbeat interval |
| 10 | **RBAC: Non-admin restricted** | P2 | Login as `user` role → Verify certain actions blocked |

### 6.4 E2E Test Example

```typescript
// frontend/e2e/login.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('successful login shows dashboard', async ({ page }) => {
    await page.goto('/');

    // Login form (inside shadow DOM)
    const app = page.locator('file-flux-app');
    await app.locator('input[type="email"]').fill('admin@fileflux.local');
    await app.locator('input[type="password"]').fill('admin');
    await app.locator('button[type="submit"]').click();

    // Dashboard loads
    await expect(app.locator('ff-dashboard')).toBeVisible({ timeout: 10_000 });
    await expect(app.locator('.dashboard-title')).toContainText('Dashboard');
  });

  test('invalid credentials show error', async ({ page }) => {
    await page.goto('/');
    const app = page.locator('file-flux-app');
    await app.locator('input[type="email"]').fill('wrong@user.com');
    await app.locator('input[type="password"]').fill('wrong');
    await app.locator('button[type="submit"]').click();

    await expect(app.locator('.login-error')).toBeVisible();
  });
});
```

---

## 7. Performance Testing

### 7.1 Go Benchmarks (Built-in)

```go
// agent/internal/transfer/chunker_bench_test.go
func BenchmarkChunkFile_1MB(b *testing.B) {
    data := make([]byte, 1<<20) // 1 MB
    rand.Read(data)
    file := createTempFileFromBytes(b, data)

    b.ResetTimer()
    b.SetBytes(int64(len(data)))
    for i := 0; i < b.N; i++ {
        chunks, _ := ChunkFile(file, 64*1024) // 64 KB chunks
        _ = chunks
    }
}

func BenchmarkSHA256Hash_10MB(b *testing.B) {
    data := make([]byte, 10<<20)
    rand.Read(data)
    b.ResetTimer()
    b.SetBytes(int64(len(data)))
    for i := 0; i < b.N; i++ {
        _ = sha256.Sum256(data)
    }
}

func BenchmarkCompressZstd_1MB(b *testing.B) {
    data := make([]byte, 1<<20)
    rand.Read(data)
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        CompressZstd(data)
    }
}
```

### 7.2 Throughput Targets

| Metric | Target | How to Test |
|--------|--------|-------------|
| Single file transfer (LAN, 100 MB) | < 5s | Integration bench with local loopback |
| Chunking throughput | > 500 MB/s | `BenchmarkChunkFile` |
| SHA-256 throughput | > 400 MB/s | `BenchmarkSHA256Hash` |
| Zstd compression ratio (text) | > 3:1 | Benchmark with sample data |
| Concurrent WS connections | 100+ agents | Load test with `k6` or custom Go harness |
| API response time (p99) | < 200ms | `go test -bench` on handler tests |

### 7.3 Load Testing (Concurrent Connections)

```go
func TestConcurrentAgentConnections(t *testing.T) {
    if testing.Short() {
        t.Skip("skipping load test in short mode")
    }

    manager := setupTestManager(t)
    server := httptest.NewServer(manager.Handler())
    defer server.Close()

    const numAgents = 100
    var wg sync.WaitGroup
    errors := make(chan error, numAgents)

    for i := 0; i < numAgents; i++ {
        wg.Add(1)
        go func(agentNum int) {
            defer wg.Done()
            conn, _, err := connectAgent(server.URL, agentNum)
            if err != nil {
                errors <- err
                return
            }
            defer conn.Close()
            // Send heartbeat
            sendHeartbeat(conn, agentNum)
        }(i)
    }

    wg.Wait()
    close(errors)

    for err := range errors {
        t.Errorf("agent connection failed: %v", err)
    }
}
```

---

## 8. Test File Structure

### 8.1 Backend

```
backend/
├── internal/
│   ├── api/
│   │   ├── router.go
│   │   └── router_test.go              ← Route registration tests
│   ├── handlers/
│   │   ├── auth_handler.go
│   │   ├── auth_handler_test.go        ← Unit (mocked DB)
│   │   ├── job_handler.go
│   │   ├── job_handler_test.go
│   │   ├── file_transfer.go
│   │   └── file_transfer_test.go
│   ├── middleware/
│   │   ├── auth.go
│   │   └── auth_test.go                ← JWT parsing, RBAC
│   ├── db/
│   │   ├── database.go
│   │   └── database_integration_test.go ← //go:build integration
│   ├── models/
│   │   ├── models.go
│   │   └── models_test.go              ← Validation, constructors
│   ├── websocket/
│   │   ├── manager.go
│   │   ├── manager_test.go             ← Unit (message dispatch)
│   │   ├── manager_integration_test.go ← //go:build integration
│   │   ├── protocol.go
│   │   └── protocol_test.go            ← Serialization contract
│   ├── mocks/                          ← Auto-generated by mockery
│   │   ├── mock_AgentRepository.go
│   │   ├── mock_JobRepository.go
│   │   └── ...
│   └── testutil/                       ← Shared test helpers
│       ├── helpers.go
│       ├── fixtures.go
│       └── containers.go               ← testcontainers setup
```

### 8.2 Agent

```
agent/
├── internal/
│   ├── api/
│   │   ├── api_client.go
│   │   └── api_client_test.go          ← HTTP round-trip tests (httptest)
│   ├── config/
│   │   ├── config.go
│   │   └── config_test.go              ← YAML parsing, defaults
│   ├── models/
│   │   ├── file_transfer.go
│   │   └── file_transfer_test.go
│   ├── system/
│   │   ├── sysinfo.go
│   │   └── sysinfo_test.go
│   └── transfer/                       ← New package for transfer logic
│       ├── chunker.go
│       ├── chunker_test.go             ← Table-driven chunk tests
│       ├── chunker_bench_test.go       ← Benchmarks
│       ├── hasher.go
│       ├── hasher_test.go
│       ├── compressor.go
│       └── compressor_test.go
├── cmd/
│   └── agent/
│       ├── main.go
│       └── main_test.go                ← CLI flag parsing
```

### 8.3 Frontend

```
frontend/
├── src/
│   ├── app.ts
│   ├── app.test.ts                     ← Router, auth flow
│   ├── demo-mode.ts
│   ├── demo-mode.test.ts               ← Data fixtures
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── dashboard.ts
│   │   │   └── dashboard.test.ts       ← Rendering, stats display
│   │   ├── jobs/
│   │   │   ├── job-list.ts
│   │   │   ├── job-list.test.ts
│   │   │   ├── job-detail.ts
│   │   │   └── job-detail.test.ts
│   │   ├── agents/
│   │   │   ├── agent-list.ts
│   │   │   └── agent-list.test.ts
│   │   ├── transfers/
│   │   │   ├── transfer-list.ts
│   │   │   └── transfer-list.test.ts
│   │   ├── tokens/
│   │   │   ├── token-list.ts
│   │   │   └── token-list.test.ts
│   │   └── shared/
│   │       ├── header.ts
│   │       └── header.test.ts
│   └── utils/
│       ├── color-picker.ts
│       └── color-picker.test.ts
├── e2e/                                ← Playwright E2E tests
│   ├── login.spec.ts
│   ├── agent-management.spec.ts
│   ├── job-crud.spec.ts
│   ├── transfer-flow.spec.ts
│   └── fixtures/
│       └── test-data.ts
```

### 8.4 Naming Conventions

| Language | Convention | Example |
|----------|-----------|---------|
| Go unit test | `*_test.go` (same package) | `auth_handler_test.go` |
| Go integration | `*_integration_test.go` + `//go:build integration` | `database_integration_test.go` |
| Go benchmark | `*_bench_test.go` | `chunker_bench_test.go` |
| Go test function | `Test<Function>_<Scenario>` | `TestCreateJob_MissingName` |
| Go benchmark func | `Benchmark<What>_<Size>` | `BenchmarkChunkFile_1MB` |
| Frontend unit | `*.test.ts` (co-located) | `dashboard.test.ts` |
| Frontend E2E | `*.spec.ts` (in `e2e/`) | `login.spec.ts` |

---

## 9. CI Integration (GitHub Actions)

### 9.1 Workflow Structure

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

concurrency:
  group: tests-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # ──────────────────────────────────
  # Backend Unit Tests (fast, no deps)
  # ──────────────────────────────────
  backend-unit:
    name: Backend Unit Tests
    runs-on: ubuntu-latest
    timeout-minutes: 10
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.21'
          cache-dependency-path: backend/go.sum

      - name: Run unit tests
        run: go test -race -short -coverprofile=coverage.out ./...

      - name: Check coverage threshold
        run: |
          COVERAGE=$(go tool cover -func=coverage.out | grep total | awk '{print $3}' | sed 's/%//')
          echo "Coverage: ${COVERAGE}%"
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "::error::Coverage ${COVERAGE}% is below 80% threshold"
            exit 1
          fi

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: backend-coverage
          path: backend/coverage.out

  # ──────────────────────────────────
  # Backend Integration Tests (needs Docker)
  # ──────────────────────────────────
  backend-integration:
    name: Backend Integration Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.21'
          cache-dependency-path: backend/go.sum

      - name: Run integration tests
        run: go test -race -tags=integration -coverprofile=coverage-integration.out ./...

  # ──────────────────────────────────
  # Agent Unit Tests
  # ──────────────────────────────────
  agent-unit:
    name: Agent Unit Tests
    runs-on: ubuntu-latest
    timeout-minutes: 10
    defaults:
      run:
        working-directory: agent
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.21'
          cache-dependency-path: agent/go.sum

      - name: Run unit tests
        run: go test -race -short -coverprofile=coverage.out ./...

      - name: Check coverage threshold
        run: |
          COVERAGE=$(go tool cover -func=coverage.out | grep total | awk '{print $3}' | sed 's/%//')
          echo "Coverage: ${COVERAGE}%"
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "::error::Coverage ${COVERAGE}% is below 80% threshold"
            exit 1
          fi

  # ──────────────────────────────────
  # Frontend Unit Tests
  # ──────────────────────────────────
  frontend-unit:
    name: Frontend Unit Tests
    runs-on: ubuntu-latest
    timeout-minutes: 10
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - run: npm ci
      - name: Run tests with coverage
        run: npx vitest run --coverage

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: frontend-coverage
          path: frontend/coverage/

  # ──────────────────────────────────
  # E2E Tests (full stack in Docker)
  # ──────────────────────────────────
  e2e:
    name: E2E Tests
    runs-on: ubuntu-latest
    timeout-minutes: 20
    needs: [backend-unit, agent-unit, frontend-unit]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Playwright
        working-directory: frontend
        run: |
          npm ci
          npx playwright install --with-deps chromium

      - name: Start services
        run: docker compose up -d --build --wait
        timeout-minutes: 5

      - name: Wait for healthy backend
        run: |
          for i in $(seq 1 30); do
            curl -sf http://localhost:3001/api/health && break
            sleep 2
          done

      - name: Run E2E tests
        working-directory: frontend
        run: npx playwright test

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: frontend/playwright-report/

      - name: Tear down
        if: always()
        run: docker compose down -v

  # ──────────────────────────────────
  # Static Analysis (lint + type check)
  # ──────────────────────────────────
  lint:
    name: Lint & Static Analysis
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-go@v5
        with:
          go-version: '1.21'

      - name: golangci-lint (backend)
        uses: golangci/golangci-lint-action@v4
        with:
          working-directory: backend
          version: latest

      - name: golangci-lint (agent)
        uses: golangci/golangci-lint-action@v4
        with:
          working-directory: agent
          version: latest

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: TypeScript type check
        working-directory: frontend
        run: |
          npm ci
          npx tsc --noEmit
```

### 9.2 Quality Gate Summary

```
PR Merge Requirements:
  ✅ backend-unit        → must pass, coverage ≥ 80%
  ✅ agent-unit           → must pass, coverage ≥ 80%
  ✅ frontend-unit        → must pass, coverage ≥ 70%
  ✅ lint                 → must pass (golangci-lint + tsc)
  ✅ backend-integration  → must pass
  ✅ e2e                  → must pass (critical paths)
```

### 9.3 Pipeline Timing Budget

| Job | Target | Max |
|-----|--------|-----|
| backend-unit | 60s | 120s |
| agent-unit | 30s | 60s |
| frontend-unit | 30s | 60s |
| backend-integration | 120s | 300s |
| e2e | 180s | 600s |
| lint | 60s | 120s |
| **Total (parallel)** | **~4 min** | **~10 min** |

---

## 10. Critical Test Scenarios — Priority List

### P0 — Must Have Before Any Release

| # | Component | Test | Type | Why |
|---|-----------|------|------|-----|
| 1 | Backend | Token validation (DB lookup, not hardcoded) | Unit + Integration | **Currently broken** — returns `1, nil` always |
| 2 | Backend | JWT middleware validates/rejects tokens correctly | Unit | Auth is the security boundary |
| 3 | Backend | CRUD handlers return correct status codes + JSON | Unit | API contract for frontend |
| 4 | Backend | WebSocket handshake accepts valid token, rejects invalid | Integration | Agent connectivity |
| 5 | Backend | WebSocket heartbeat updates agent status | Integration | Agent health monitoring |
| 6 | Backend | Database repository CRUD (agents, jobs, transfers) | Integration | Data integrity |
| 7 | Agent | Config YAML loading (defaults, overrides, env vars) | Unit | Deployment flexibility |
| 8 | Agent | API client upload/download (with httptest mock server) | Unit | File transfer correctness |
| 9 | Frontend | App component renders login when unauthenticated | Unit | Entry point |
| 10 | Frontend | Dashboard renders stats after data load | Unit | Core UI |
| 11 | E2E | Login → Dashboard → Create Job → Verify | E2E | Critical path |

### P1 — Must Have Before Production

| # | Component | Test | Type | Why |
|---|-----------|------|------|-----|
| 12 | Backend | Transfer progress updates via WebSocket | Integration | Real-time monitoring |
| 13 | Backend | Job CRUD with ownership validation | Unit | Multi-tenancy |
| 14 | Backend | Subscription limit enforcement | Unit | Billing correctness |
| 15 | Agent | File chunking produces correct chunk count + sizes | Unit | Transfer engine core |
| 16 | Agent | SHA-256 hash per chunk + whole file | Unit | Integrity verification |
| 17 | Agent | Chunk reassembly produces original file | Unit | Transfer completeness |
| 18 | Agent | Compression (zstd) compress/decompress round-trip | Unit | Data fidelity |
| 19 | Frontend | Job list renders, filters, paginates | Unit | Usability |
| 20 | Frontend | Transfer detail shows progress bar | Unit | Monitoring UX |
| 21 | E2E | Agent connects → shows online → disconnects → shows offline | E2E | Agent lifecycle |
| 22 | E2E | Transfer completes end-to-end (file arrives at dest) | E2E | Core value proposition |

### P2 — Before GA

| # | Component | Test | Type | Why |
|---|-----------|------|------|-----|
| 23 | Backend | Webhook delivery on transfer events | Integration | Notification system |
| 24 | Backend | Retry policy for failed transfers | Unit | Reliability |
| 25 | Backend | Cron scheduler triggers jobs on schedule | Integration | Automation |
| 26 | Backend | Audit log records all mutations | Integration | Compliance |
| 27 | Backend | RBAC restricts non-admin users | Unit | Security |
| 28 | Agent | File watcher detects new files | Integration | Auto-trigger capability |
| 29 | Agent | Service installation (systemd/launchd) | Manual/Script | Deployment |
| 30 | Frontend | Token create/revoke flow | Unit | Security management |
| 31 | Performance | 100 concurrent WS connections | Load | Scalability |
| 32 | Performance | 1 GB file transfer throughput | Bench | Performance baseline |

---

## 11. Effort Estimate

### 11.1 By Component

| Component | Scope | Tests | Effort | Dependency |
|-----------|-------|-------|--------|------------|
| **Test infrastructure setup** | CI pipeline, testcontainers, mocks, fixtures, vitest config | — | **3 days** | None |
| **Backend unit tests** | Handlers (5), middleware (3), models, WebSocket protocol | ~80 | **5 days** | Interfaces must be introduced first |
| **Backend integration tests** | DB repos (5 entities × CRUD), WebSocket flow, transfer pipeline | ~40 | **4 days** | testcontainers setup |
| **Agent unit tests** | Config, API client, chunking, hashing, compression | ~60 | **4 days** | Transfer package must be built |
| **Agent integration tests** | WS client ↔ test server, file round-trip | ~15 | **2 days** | Backend WS tests |
| **Frontend unit tests** | 10 components + app router + demo mode + utils | ~80 | **5 days** | Vitest + open-wc setup |
| **E2E tests** | 10 scenarios (Playwright) | ~10 | **3 days** | Full Docker stack working |
| **Contract tests** | WS protocol compatibility (backend ↔ agent) | ~20 | **1 day** | Protocol stabilized |
| **Performance benchmarks** | Chunking, hashing, compression, concurrent WS | ~10 | **2 days** | Transfer engine built |
| **Total** | | **~355** | **~29 days** | |

### 11.2 Recommended Phasing

```
Phase 1 (Week 1–2): Foundation                         ██████████████
  ├─ Test infrastructure (CI, mocking, testcontainers)  ███
  ├─ Backend P0 unit tests (#1–#6)                      █████
  ├─ Agent P0 unit tests (#7–#8)                        ██
  └─ Frontend setup + P0 tests (#9–#10)                 ████

Phase 2 (Week 3–4): Core Coverage                      ██████████████
  ├─ Backend P1 tests (#12–#14)                         ████
  ├─ Agent P1 tests (#15–#18)                           ████
  ├─ Frontend P1 tests (#19–#20)                        ███
  └─ E2E critical paths (#11, #21–#22)                  ███

Phase 3 (Week 5–6): Hardening                          ██████████████
  ├─ Backend P2 tests (#23–#27)                         █████
  ├─ Agent P2 tests (#28–#29)                           ██
  ├─ Frontend P2 tests (#30)                            █
  ├─ Contract tests                                     █
  ├─ Performance benchmarks (#31–#32)                   ██
  └─ Coverage gap analysis + fill                       ███
```

### 11.3 Prerequisites (Must Be Done Before Tests)

| Prerequisite | Blocks | Effort |
|---|---|---|
| Introduce repository interfaces in backend (replace `*db.Database` → interfaces in handlers) | All backend unit tests | 1–2 days |
| Create `transfer` package in agent (chunking, hashing, compression) | Agent transfer tests | Part of feature work |
| Add `go test` dependencies: `testcontainers-go`, `mockery` | Integration + mock tests | 1 hour |
| Add frontend DevDependencies: `vitest`, `@open-wc/testing`, `happy-dom`, `playwright` | All frontend tests | 1 hour |
| Add health check endpoint (`GET /api/health`) to backend | E2E smoke check | 30 min |

---

## Appendix: Example Tests

### A.1 Backend — Auth Middleware Unit Test

```go
package middleware_test

import (
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/stretchr/testify/assert"
    "fileflux/backend/internal/middleware"
    "fileflux/backend/internal/testutil"
)

func TestAuthMiddleware(t *testing.T) {
    tests := []struct {
        name       string
        authHeader string
        wantStatus int
    }{
        {"no header → 401", "", http.StatusUnauthorized},
        {"invalid token → 401", "Bearer invalid", http.StatusUnauthorized},
        {"valid token → 200", "Bearer " + testutil.ValidTestJWT, http.StatusOK},
        {"expired token → 401", "Bearer " + testutil.ExpiredTestJWT, http.StatusUnauthorized},
        {"malformed header → 401", "NotBearer token", http.StatusUnauthorized},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
                w.WriteHeader(http.StatusOK)
            })

            req := httptest.NewRequest("GET", "/api/agents", nil)
            if tt.authHeader != "" {
                req.Header.Set("Authorization", tt.authHeader)
            }
            rec := httptest.NewRecorder()

            middleware.Auth(inner).ServeHTTP(rec, req)
            assert.Equal(t, tt.wantStatus, rec.Code)
        })
    }
}
```

### A.2 Agent — Config Loading Unit Test

```go
package config_test

import (
    "os"
    "path/filepath"
    "testing"

    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
    "fileflux/agent/internal/config"
)

func TestLoadConfig(t *testing.T) {
    tests := []struct {
        name       string
        yaml       string
        envVars    map[string]string
        wantServer string
        wantToken  string
        wantErr    bool
    }{
        {
            name: "loads from YAML",
            yaml: `
connection:
  server_url: ws://localhost:3002/ws/agent
  token: yaml-token
`,
            wantServer: "ws://localhost:3002/ws/agent",
            wantToken:  "yaml-token",
        },
        {
            name: "env vars override YAML",
            yaml: `
connection:
  server_url: ws://localhost:3002/ws/agent
  token: yaml-token
`,
            envVars: map[string]string{
                "CONNECTION_TOKEN": "env-token",
            },
            wantServer: "ws://localhost:3002/ws/agent",
            wantToken:  "env-token",
        },
        {
            name:    "missing required fields returns error",
            yaml:    `agent_name: test`,
            wantErr: true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Write temp config
            dir := t.TempDir()
            cfgPath := filepath.Join(dir, "config.yaml")
            require.NoError(t, os.WriteFile(cfgPath, []byte(tt.yaml), 0644))

            // Set env vars
            for k, v := range tt.envVars {
                t.Setenv(k, v)
            }

            // Act
            cfg, err := config.Load(cfgPath)

            // Assert
            if tt.wantErr {
                assert.Error(t, err)
                return
            }
            require.NoError(t, err)
            assert.Equal(t, tt.wantServer, cfg.Connection.ServerURL)
            assert.Equal(t, tt.wantToken, cfg.Connection.Token)
        })
    }
}
```

### A.3 Agent — File Chunking Unit Test

```go
package transfer_test

import (
    "crypto/rand"
    "os"
    "path/filepath"
    "testing"

    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
    "fileflux/agent/internal/transfer"
)

func TestChunkFile(t *testing.T) {
    tests := []struct {
        name       string
        fileSize   int
        chunkSize  int
        wantChunks int
    }{
        {"exact multiple", 1024, 256, 4},
        {"with remainder", 1000, 256, 4},       // 3 full + 1 partial
        {"single chunk", 100, 256, 1},
        {"empty file", 0, 256, 0},
        {"chunk equals file", 256, 256, 1},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Arrange
            file := createTempFile(t, tt.fileSize)

            // Act
            chunks, err := transfer.ChunkFile(file, tt.chunkSize)

            // Assert
            require.NoError(t, err)
            assert.Len(t, chunks, tt.wantChunks)

            // Verify all bytes accounted for
            totalBytes := 0
            for _, c := range chunks {
                totalBytes += len(c.Data)
            }
            assert.Equal(t, tt.fileSize, totalBytes)
        })
    }
}

func TestReassembleChunks(t *testing.T) {
    // Arrange — create file, chunk it
    original := make([]byte, 1500)
    rand.Read(original)
    tmpFile := filepath.Join(t.TempDir(), "original.bin")
    require.NoError(t, os.WriteFile(tmpFile, original, 0644))

    chunks, err := transfer.ChunkFile(tmpFile, 256)
    require.NoError(t, err)

    // Act — reassemble
    destFile := filepath.Join(t.TempDir(), "reassembled.bin")
    err = transfer.ReassembleChunks(chunks, destFile)
    require.NoError(t, err)

    // Assert — files are identical
    reassembled, err := os.ReadFile(destFile)
    require.NoError(t, err)
    assert.Equal(t, original, reassembled)
}
```

### A.4 Frontend — Job List Component Test

```typescript
// src/components/jobs/job-list.test.ts
import { fixture, html, expect } from '@open-wc/testing';
import './job-list';

describe('ff-job-list', () => {
  const mockJobs = [
    { id: 1, name: 'Backup DB', status: 'active', schedule: '0 2 * * *', lastRun: '2026-02-11T02:00:00Z' },
    { id: 2, name: 'Sync Logs', status: 'paused', schedule: null, lastRun: null },
  ];

  it('renders a row per job', async () => {
    const el = await fixture(html`<ff-job-list .jobs=${mockJobs}></ff-job-list>`);
    const rows = el.shadowRoot!.querySelectorAll('tr[data-job-id]');
    expect(rows.length).to.equal(2);
  });

  it('shows empty state when no jobs', async () => {
    const el = await fixture(html`<ff-job-list .jobs=${[]}></ff-job-list>`);
    const empty = el.shadowRoot!.querySelector('.empty-state');
    expect(empty).to.exist;
  });

  it('run button dispatches run-job event', async () => {
    const el = await fixture(html`<ff-job-list .jobs=${mockJobs}></ff-job-list>`);
    let eventDetail: any = null;
    el.addEventListener('run-job', ((e: CustomEvent) => {
      eventDetail = e.detail;
    }) as EventListener);

    const runBtn = el.shadowRoot!.querySelector('[data-action="run"]') as HTMLButtonElement;
    runBtn?.click();

    expect(eventDetail).to.not.be.null;
    expect(eventDetail.jobId).to.equal(1);
  });
});
```

### A.5 Backend — WebSocket Protocol Contract Test

```go
package websocket_test

import (
    "encoding/json"
    "testing"

    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
    ws "fileflux/backend/internal/websocket"
)

func TestProtocolSerialization(t *testing.T) {
    tests := []struct {
        name    string
        msg     ws.Message
        wantJSON string
    }{
        {
            name: "heartbeat message",
            msg: ws.Message{
                Type: ws.MessageTypeHeartbeat,
                Data: json.RawMessage(`{"agent_id":1,"timestamp":"2026-02-12T00:00:00Z"}`),
            },
            wantJSON: `{"type":"heartbeat","data":{"agent_id":1,"timestamp":"2026-02-12T00:00:00Z"}}`,
        },
        {
            name: "transfer_request message",
            msg: ws.Message{
                Type: ws.MessageTypeTransferRequest,
                Data: json.RawMessage(`{"transfer":{"id":"t-1","job_id":"j-1","source_path":"/src","destination_path":"/dst","compressed":true,"chunk_size":65536,"transfer_type":"upload"}}`),
            },
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Serialize
            data, err := json.Marshal(tt.msg)
            require.NoError(t, err)

            // Deserialize
            var decoded ws.Message
            err = json.Unmarshal(data, &decoded)
            require.NoError(t, err)

            assert.Equal(t, tt.msg.Type, decoded.Type)

            if tt.wantJSON != "" {
                assert.JSONEq(t, tt.wantJSON, string(data))
            }
        })
    }
}
```

---

## Summary

| Dimension | Decision |
|-----------|----------|
| **Go test framework** | stdlib `testing` + `testify` (assert/require/suite/mock) |
| **Go mock generation** | `mockery` from interfaces |
| **Go DB integration** | `testcontainers-go` (PostgreSQL 14) |
| **Go test separation** | Build tags: `//go:build integration`, `//go:build e2e` |
| **Frontend test runner** | Vitest (happy-dom) |
| **Frontend WC testing** | `@open-wc/testing` |
| **E2E tool** | Playwright (Chromium) |
| **CI platform** | GitHub Actions (5 parallel jobs) |
| **Coverage enforcement** | 80% backend, 70% frontend — enforced in CI |
| **Estimated total effort** | ~29 engineering days (~355 tests) |
| **First milestone** | P0 tests (11 critical scenarios) in ~2 weeks |
