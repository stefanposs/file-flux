# ==============================================================================
# File Flux Backend — Multi-stage Dockerfile
# ==============================================================================

# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache git ca-certificates tzdata

WORKDIR /build

# Cache dependency downloads
COPY go.mod go.sum* ./
RUN go mod download

# Copy source & build
COPY . .

ARG VERSION=dev
ARG GIT_COMMIT=unknown
ARG BUILD_TIME=unknown

RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w \
      -X main.Version=${VERSION} \
      -X main.GitCommit=${GIT_COMMIT} \
      -X main.BuildTime=${BUILD_TIME}" \
    -o /fileflux-backend ./cmd/server

# ── Stage 2: Migrate (optional — ships golang-migrate CLI) ─────────────────
FROM migrate/migrate:v4.17.0 AS migrate

# ── Stage 3: Runtime ───────────────────────────────────────────────────────
FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata wget && \
    addgroup -S fileflux && \
    adduser -S -G fileflux -h /app fileflux

WORKDIR /app

# Copy binary
COPY --from=builder /fileflux-backend .

# Copy migrate CLI (used by entrypoint for auto-migration)
COPY --from=migrate /usr/local/bin/migrate /usr/local/bin/migrate

# Copy migrations & config
COPY internal/db/schema.sql ./migrations/
COPY config.yaml ./

RUN chown -R fileflux:fileflux /app

USER fileflux

EXPOSE 3001 3002

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --spider -q http://localhost:3001/health || exit 1

ENTRYPOINT ["./fileflux-backend"]
