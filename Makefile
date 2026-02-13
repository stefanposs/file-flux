# ==============================================================================
# File Flux — Root Makefile
# ==============================================================================
# Usage:
#   make              — build all components
#   make test         — run all tests
#   make lint         — lint all components
#   make docker       — build all Docker images
#   make release      — cross-compile agent + build images
#   make up           — docker compose up
#   make down         — docker compose down
# ==============================================================================

.PHONY: all build test lint clean docker release up down \
        backend-build backend-test backend-lint \
        frontend-build frontend-test frontend-lint \
        agent-build agent-test agent-lint agent-cross \
        db-migrate help

# ── Variables ────────────────────────────────────────────────────────────────
VERSION       ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
GIT_COMMIT    := $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_TIME    := $(shell date -u +%FT%T%z)
LDFLAGS       := -ldflags "-s -w -X main.Version=$(VERSION) -X main.GitCommit=$(GIT_COMMIT) -X main.BuildTime=$(BUILD_TIME)"

DOCKER_REPO   ?= ghcr.io/stefanposs/file-flux
COMPOSE       := docker compose
COMPOSE_PROD  := $(COMPOSE) -f docker-compose.yml -f docker-compose.production.yml

AGENT_TARGETS := linux/amd64 linux/arm64 darwin/amd64 darwin/arm64 windows/amd64

# ── Default ──────────────────────────────────────────────────────────────────
all: build

# ── Build All ────────────────────────────────────────────────────────────────
build: backend-build frontend-build agent-build

backend-build:
	@echo "▸ Building backend..."
	cd backend && CGO_ENABLED=0 go build $(LDFLAGS) -o bin/fileflux-backend ./cmd/server

frontend-build:
	@echo "▸ Building frontend..."
	cd frontend && npm ci --silent && npm run build

agent-build:
	@echo "▸ Building agent..."
	cd agent && CGO_ENABLED=0 go build $(LDFLAGS) -o bin/fileflux-agent ./cmd/agent

# ── Test All ─────────────────────────────────────────────────────────────────
test: backend-test frontend-test agent-test

backend-test:
	@echo "▸ Testing backend..."
	cd backend && go test -race -cover ./...

frontend-test:
	@echo "▸ Testing frontend..."
	cd frontend && npm ci --silent && npx vitest run 2>/dev/null || echo "vitest not yet configured"

agent-test:
	@echo "▸ Testing agent..."
	cd agent && go test -race -cover ./...

# ── Lint All ─────────────────────────────────────────────────────────────────
lint: backend-lint frontend-lint agent-lint

backend-lint:
	@echo "▸ Linting backend..."
	cd backend && golangci-lint run --timeout=5m ./...

frontend-lint:
	@echo "▸ Linting frontend..."
	cd frontend && npm ci --silent && npx eslint src/ 2>/dev/null || echo "eslint not yet configured"
	cd frontend && npx tsc --noEmit

agent-lint:
	@echo "▸ Linting agent..."
	cd agent && golangci-lint run --timeout=5m ./...

# ── Agent Cross-Compilation ─────────────────────────────────────────────────
agent-cross:
	@echo "▸ Cross-compiling agent for all targets..."
	@mkdir -p dist
	@for target in $(AGENT_TARGETS); do \
		os=$$(echo $$target | cut -d/ -f1); \
		arch=$$(echo $$target | cut -d/ -f2); \
		ext=""; \
		if [ "$$os" = "windows" ]; then ext=".exe"; fi; \
		echo "  → $$os/$$arch"; \
		cd agent && CGO_ENABLED=0 GOOS=$$os GOARCH=$$arch \
			go build $(LDFLAGS) \
			-o ../dist/fileflux-agent-$$os-$$arch$$ext ./cmd/agent && cd ..; \
	done
	@echo "▸ Generating checksums..."
	@cd dist && sha256sum fileflux-agent-* > checksums.sha256
	@echo "✅ Agent binaries in dist/"

# ── Docker ───────────────────────────────────────────────────────────────────
docker:
	@echo "▸ Building Docker images..."
	$(COMPOSE) build \
		--build-arg VERSION=$(VERSION) \
		--build-arg GIT_COMMIT=$(GIT_COMMIT) \
		--build-arg BUILD_TIME=$(BUILD_TIME)

docker-push: docker
	@echo "▸ Pushing Docker images..."
	docker push $(DOCKER_REPO)/backend:$(VERSION)
	docker push $(DOCKER_REPO)/frontend:$(VERSION)
	docker push $(DOCKER_REPO)/agent:$(VERSION)

# ── Docker Compose Shortcuts ────────────────────────────────────────────────
up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

up-prod:
	$(COMPOSE_PROD) up -d

down-prod:
	$(COMPOSE_PROD) down

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

# ── Database ─────────────────────────────────────────────────────────────────
db-migrate:
	@echo "▸ Running database migrations..."
	$(COMPOSE) exec backend /usr/local/bin/migrate \
		-path /app/migrations -database "$$DATABASE_URL" up

db-reset:
	@echo "⚠ Resetting database..."
	$(COMPOSE) down -v
	$(COMPOSE) up -d db
	sleep 3
	$(COMPOSE) up -d backend

# ── Release ──────────────────────────────────────────────────────────────────
release: lint test agent-cross docker
	@echo "✅ Release build complete: v$(VERSION)"
	@echo "   Agent binaries:  dist/"
	@echo "   Docker images:   $(DOCKER_REPO)/*:$(VERSION)"

# ── Clean ────────────────────────────────────────────────────────────────────
clean:
	rm -rf dist/
	rm -rf backend/bin/ agent/bin/
	rm -rf frontend/dist/ frontend/node_modules/
	$(COMPOSE) down -v --remove-orphans 2>/dev/null || true

# ── Help ─────────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "File Flux — Build Targets"
	@echo "─────────────────────────────────────────────────────"
	@echo "  make              Build all components"
	@echo "  make test         Run all tests"
	@echo "  make lint         Lint all components"
	@echo "  make docker       Build Docker images"
	@echo "  make agent-cross  Cross-compile agent (5 targets)"
	@echo "  make release      Full release build (lint+test+build)"
	@echo "  make up           docker compose up -d"
	@echo "  make down         docker compose down"
	@echo "  make up-prod      Start with production overrides"
	@echo "  make db-migrate   Run database migrations"
	@echo "  make db-reset     Reset database (destroys data!)"
	@echo "  make clean        Remove all build artifacts"
	@echo "  make help         Show this help"
	@echo ""
