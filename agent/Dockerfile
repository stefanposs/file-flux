# ==============================================================================
# File Flux Agent — Multi-stage Dockerfile
# ==============================================================================

# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache git ca-certificates tzdata

WORKDIR /build

COPY go.mod go.sum* ./
RUN go mod download

COPY . .

ARG VERSION=dev
ARG GIT_COMMIT=unknown
ARG BUILD_TIME=unknown
ARG TARGETOS=linux
ARG TARGETARCH=amd64

RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build \
    -ldflags="-s -w \
      -X main.Version=${VERSION} \
      -X main.GitCommit=${GIT_COMMIT} \
      -X main.BuildTime=${BUILD_TIME}" \
    -o /fileflux-agent ./cmd/agent

# ── Stage 2: Runtime ───────────────────────────────────────────────────────
FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata wget && \
    addgroup -S fileflux && \
    adduser -S -G fileflux -h /app fileflux && \
    mkdir -p /data /tmp/fileflux && \
    chown -R fileflux:fileflux /data /tmp/fileflux

WORKDIR /app

COPY --from=builder /fileflux-agent .
COPY config.yaml ./

RUN chown -R fileflux:fileflux /app

USER fileflux

VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --spider -q http://localhost:8080/health || exit 1

ENTRYPOINT ["./fileflux-agent"]
