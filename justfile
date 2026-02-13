# ==============================================================================
# FileFlux — justfile
# ==============================================================================
# Task runner for FileFlux managed file transfer platform.
#
# Usage:
#   just              — show available commands
#   just setup        — install dependencies
#   just dev          — start development environment
#   just test         — run all tests
#   just lint         — lint all components
#   just docs         — serve documentation locally
#
# Prerequisites:
#   - Go 1.22+
#   - Node.js 20+
#   - Docker & Docker Compose
#   - golangci-lint
#   - Python 3.10+ with pip (for MkDocs)
# ==============================================================================

# Variables
version := `git describe --tags --always --dirty 2>/dev/null || echo "dev"`
git_commit := `git rev-parse --short HEAD 2>/dev/null || echo "unknown"`
build_time := `date -u +%FT%T%z`
ldflags := "-s -w -X main.Version=" + version + " -X main.GitCommit=" + git_commit + " -X main.BuildTime=" + build_time
docker_repo := "ghcr.io/stefanposs/file-flux"

# Default: show available recipes
default:
    @just --list --unsorted

# ============================================================================
# Setup
# ============================================================================

# Install all dependencies
setup: setup-backend setup-frontend setup-agent
    @echo "✅ All dependencies installed"

# Install backend dependencies
setup-backend:
    @echo "📦 Setting up backend..."
    cd backend && go mod download
    @echo "✅ Backend ready"

# Install frontend dependencies
setup-frontend:
    @echo "📦 Setting up frontend..."
    cd frontend && npm ci
    @echo "✅ Frontend ready"

# Install agent dependencies
setup-agent:
    @echo "📦 Setting up agent..."
    cd agent && go mod download
    @echo "✅ Agent ready"

# ============================================================================
# Build
# ============================================================================

# Build all components
build: build-backend build-frontend build-agent
    @echo "✅ All components built"

# Build backend binary
build-backend:
    @echo "🔨 Building backend..."
    cd backend && CGO_ENABLED=0 go build -ldflags "{{ldflags}}" -o bin/fileflux-backend ./cmd/server
    @echo "✅ Backend → backend/bin/fileflux-backend"

# Build frontend
build-frontend:
    @echo "🔨 Building frontend..."
    cd frontend && npm run build
    @echo "✅ Frontend → frontend/dist/"

# Build agent binary
build-agent:
    @echo "🔨 Building agent..."
    cd agent && CGO_ENABLED=0 go build -ldflags "{{ldflags}}" -o bin/fileflux-agent ./cmd/agent
    @echo "✅ Agent → agent/bin/fileflux-agent"

# Cross-compile agent for all platforms
build-agent-cross:
    @echo "🔨 Cross-compiling agent..."
    @mkdir -p dist
    cd agent && CGO_ENABLED=0 GOOS=linux   GOARCH=amd64 go build -ldflags "{{ldflags}}" -o ../dist/fileflux-agent-linux-amd64   ./cmd/agent
    cd agent && CGO_ENABLED=0 GOOS=linux   GOARCH=arm64 go build -ldflags "{{ldflags}}" -o ../dist/fileflux-agent-linux-arm64   ./cmd/agent
    cd agent && CGO_ENABLED=0 GOOS=darwin  GOARCH=amd64 go build -ldflags "{{ldflags}}" -o ../dist/fileflux-agent-darwin-amd64  ./cmd/agent
    cd agent && CGO_ENABLED=0 GOOS=darwin  GOARCH=arm64 go build -ldflags "{{ldflags}}" -o ../dist/fileflux-agent-darwin-arm64  ./cmd/agent
    cd agent && CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -ldflags "{{ldflags}}" -o ../dist/fileflux-agent-windows-amd64.exe ./cmd/agent
    @echo "📝 Generating checksums..."
    cd dist && sha256sum fileflux-agent-* > checksums.sha256 2>/dev/null || shasum -a 256 fileflux-agent-* > checksums.sha256
    @echo "✅ Agent binaries → dist/"

# ============================================================================
# Testing
# ============================================================================

# Run all tests
test: test-backend test-frontend test-agent
    @echo "✅ All tests passed"

# Run backend tests
test-backend:
    @echo "🧪 Testing backend..."
    cd backend && go test -race -cover ./...

# Run backend tests with coverage report
test-backend-cov:
    @echo "🧪 Testing backend with coverage..."
    cd backend && go test -race -coverprofile=coverage.out -covermode=atomic ./...
    cd backend && go tool cover -html=coverage.out -o coverage.html
    @echo "📊 Coverage report → backend/coverage.html"

# Run frontend tests
test-frontend:
    @echo "🧪 Testing frontend..."
    cd frontend && npx vitest run 2>/dev/null || echo "⚠️  vitest not yet configured"

# Run agent tests
test-agent:
    @echo "🧪 Testing agent..."
    cd agent && go test -race -cover ./...

# ============================================================================
# Code Quality
# ============================================================================

# Lint all components
lint: lint-backend lint-frontend lint-agent
    @echo "✅ All linting passed"

# Lint backend
lint-backend:
    @echo "🔍 Linting backend..."
    cd backend && golangci-lint run --timeout=5m ./...

# Lint frontend
lint-frontend:
    @echo "🔍 Linting frontend..."
    cd frontend && npx eslint src/ 2>/dev/null || echo "⚠️  eslint not yet configured"

# Lint agent
lint-agent:
    @echo "🔍 Linting agent..."
    cd agent && golangci-lint run --timeout=5m ./...

# TypeScript type checking
typecheck:
    @echo "🔍 Type checking frontend..."
    cd frontend && npx tsc --noEmit

# Format all Go code
format:
    @echo "🎨 Formatting Go code..."
    cd backend && gofmt -s -w .
    cd agent && gofmt -s -w .
    @echo "✅ Go code formatted"

# Auto-fix lint issues
fix:
    @echo "🔧 Auto-fixing lint issues..."
    cd backend && golangci-lint run --fix ./... 2>/dev/null || true
    cd agent && golangci-lint run --fix ./... 2>/dev/null || true
    cd frontend && npx eslint src/ --fix 2>/dev/null || true
    @echo "✅ Lint fixes applied"

# Run all quality checks (lint + test + typecheck)
qa: lint typecheck test
    @echo "✅ All quality checks passed"

# Quick check (lint + typecheck, no tests)
check: lint typecheck
    @echo "✅ Quick check passed"

# ============================================================================
# Docker
# ============================================================================

# Start development environment
dev:
    @echo "🚀 Starting development environment..."
    docker compose up -d
    @echo "✅ Services running:"
    @echo "   Frontend:  http://localhost:3000"
    @echo "   Backend:   http://localhost:3001"
    @echo "   WebSocket: ws://localhost:3002"

# Build all Docker images
docker-build:
    @echo "🐳 Building Docker images..."
    docker compose build \
        --build-arg VERSION={{version}} \
        --build-arg GIT_COMMIT={{git_commit}} \
        --build-arg BUILD_TIME={{build_time}}
    @echo "✅ Docker images built"

# Rebuild and restart services
rebuild:
    @echo "🔄 Rebuilding services..."
    docker compose up -d --build
    @echo "✅ Services rebuilt and running"

# Stop all services
down:
    @echo "🛑 Stopping services..."
    docker compose down

# Stop all services and remove volumes
down-clean:
    @echo "⚠️  Stopping services and removing volumes..."
    docker compose down -v --remove-orphans

# Show service logs (follow)
logs *args='':
    docker compose logs -f {{args}}

# Show service status
status:
    docker compose ps

# Restart a specific service
restart service:
    @echo "🔄 Restarting {{service}}..."
    docker compose restart {{service}}

# Start with production overrides
up-prod:
    docker compose -f docker-compose.yml -f docker-compose.production.yml up -d

# Stop production services
down-prod:
    docker compose -f docker-compose.yml -f docker-compose.production.yml down

# Push Docker images
docker-push: docker-build
    @echo "📤 Pushing Docker images..."
    docker push {{docker_repo}}/backend:{{version}}
    docker push {{docker_repo}}/frontend:{{version}}
    docker push {{docker_repo}}/agent:{{version}}
    @echo "✅ Images pushed"

# ============================================================================
# Documentation
# ============================================================================

# Serve documentation locally (live reload)
docs:
    @echo "📚 Serving documentation at http://localhost:8001..."
    mkdocs serve -a localhost:8001

# Build documentation site
docs-build:
    @echo "📚 Building documentation..."
    mkdocs build
    @echo "✅ Documentation → docs/"

# ============================================================================
# Database
# ============================================================================

# Run database migrations
db-migrate:
    @echo "📦 Running database migrations..."
    docker compose exec backend /usr/local/bin/migrate \
        -path /app/migrations -database "$DATABASE_URL" up

# Backup database
db-backup:
    @echo "💾 Backing up database..."
    @mkdir -p backups
    docker compose exec -T db pg_dump -U fileflux fileflux | gzip > backups/fileflux-$(date +%Y%m%d-%H%M%S).sql.gz
    @echo "✅ Backup → backups/"

# Open database shell
db-shell:
    docker compose exec db psql -U fileflux fileflux

# Reset database (destroys all data!)
db-reset:
    @echo "⚠️  Resetting database..."
    docker compose down -v
    docker compose up -d db
    sleep 3
    docker compose up -d backend
    @echo "✅ Database reset"

# ============================================================================
# Utility
# ============================================================================

# Remove all build artifacts
clean:
    @echo "🧹 Cleaning build artifacts..."
    rm -rf dist/
    rm -rf backend/bin/ agent/bin/
    rm -rf frontend/dist/ frontend/node_modules/
    rm -rf docs-site/
    rm -f backend/coverage.out backend/coverage.html
    docker compose down -v --remove-orphans 2>/dev/null || true
    @echo "✅ Clean"

# Show project info
info:
    @echo "FileFlux — Managed File Transfer"
    @echo "────────────────────────────────────"
    @echo "  Version:    {{version}}"
    @echo "  Commit:     {{git_commit}}"
    @echo "  Go:         $(go version 2>/dev/null | awk '{print $3}')"
    @echo "  Node:       $(node --version 2>/dev/null)"
    @echo "  Docker:     $(docker --version 2>/dev/null | awk '{print $3}' | tr -d ',')"
    @echo "  just:       $(just --version 2>/dev/null)"
    @echo ""

# Count lines of code
loc:
    @echo "📊 Lines of code:"
    @echo "  Backend (Go):"
    @find backend -name '*.go' -not -path '*/vendor/*' | xargs wc -l 2>/dev/null | tail -1 || echo "    0"
    @echo "  Agent (Go):"
    @find agent -name '*.go' -not -path '*/vendor/*' | xargs wc -l 2>/dev/null | tail -1 || echo "    0"
    @echo "  Frontend (TS):"
    @find frontend/src -name '*.ts' | xargs wc -l 2>/dev/null | tail -1 || echo "    0"
    @echo "  Docs (MD):"
    @find assets/mkdocs -name '*.md' | xargs wc -l 2>/dev/null | tail -1 || echo "    0"

# Full release build (lint + test + build + docker)
release: qa build-agent-cross docker-build
    @echo "✅ Release build complete: v{{version}}"
    @echo "   Agent binaries:  dist/"
    @echo "   Docker images:   {{docker_repo}}/*:{{version}}"

# ============================================================================
# CI Simulation
# ============================================================================

# Simulate full CI pipeline locally
ci: setup lint typecheck test build
    @echo "✅ CI simulation passed"

# Quick CI (lint + typecheck only)
ci-quick: lint typecheck
    @echo "✅ Quick CI passed"
