# ==============================================================================
# File Flux Frontend — Multi-stage Dockerfile
# ==============================================================================

# ── Stage 1: Dependencies ──────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts

# ── Stage 2: Build ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG API_URL=/api
ENV VITE_API_URL=${API_URL}

RUN npm run build

# ── Stage 3: Runtime ───────────────────────────────────────────────────────
FROM nginx:1.25-alpine

# Remove default config
RUN rm -rf /etc/nginx/conf.d/default.conf /usr/share/nginx/html/*

# Security: run as non-root
RUN addgroup -S fileflux && adduser -S -G fileflux fileflux && \
    chown -R fileflux:fileflux /var/cache/nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown fileflux:fileflux /var/run/nginx.pid

# Copy built assets & config
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f -s http://localhost:80/ > /dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
