#!/usr/bin/env bash
# ============================================================================
# FileFlux Demo 3: WebSocket → HTTP Long-Polling Fallback
# ============================================================================
# Shows: Automatic transport switch when WebSocket is unavailable
# Duration: ~2 minutes
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/common.sh"

echo ""
echo -e "${BOLD}${CYAN}"
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║    FileFlux — Demo 3: Transport Fallback (Enterprise)    ║"
echo "  ║          WebSocket  ──→  HTTP Long-Polling               ║"
echo "  ╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo "  In many enterprise environments, firewalls or proxies"
echo "  block WebSocket connections. FileFlux detects this automatically"
echo "  and switches to HTTP Long-Polling as a fallback."
echo ""

pause

# ── 1. Preparation ─────────────────────────────────────────────

check_health
login

# ── 2. Explain Scenario ──────────────────────────────────────

step "Enterprise Scenario"

echo ""
echo -e "  ${BOLD}Network Topology:${NC}"
echo ""
echo "    ┌──────────────┐     WebSocket ✘     ┌──────────────┐"
echo "    │   Location A  │ ─ ─ ─ ─ ─ ✘ ─ ─ ─ │  FileFlux    │"
echo "    │  (behind proxy)│                    │  Server      │"
echo "    │               │ ════ HTTPS ════════ │              │"
echo "    └──────────────┘    Long-Polling ✔    └──────────────┘"
echo ""
echo -e "  ${YELLOW}Problem:${NC}  Corporate proxy blocks WebSocket upgrade"
echo -e "  ${GREEN}Solution:${NC} Agent automatically switches to HTTP Long-Polling"
echo ""

pause

# ── 3. Register Agent with Auto-Transport ────────────────────

step "Register agent with transport auto-detection"

PROXY_AGENT_ID=$(create_agent "Frankfurt-Proxy" "client" "Agent behind corporate proxy — no WebSocket")
PROXY_TOKEN=$(create_token "$PROXY_AGENT_ID" "proxy-token")

echo ""
info "Agent configuration for proxy environment:"
echo ""
echo -e "  ${BOLD}config.yaml:${NC}"
echo -e "    ${CYAN}connection:${NC}"
echo -e "      ${CYAN}server_url:${NC} ws://fileflux.example.com:3002/ws/agent"
echo -e "      ${CYAN}server_http_url:${NC} https://fileflux.example.com"
echo -e "      ${CYAN}transport_mode:${NC} ${BOLD}auto${NC}    ${GREEN}<─ key setting${NC}"
echo -e "      ${CYAN}poll_timeout:${NC} 30"
echo -e "      ${CYAN}ws_probe_interval:${NC} 300"
echo ""
echo -e "  ${BOLD}Behavior with ${CYAN}transport_mode: auto${NC}${BOLD}:${NC}"
echo "    1. Agent attempts WebSocket connection (3 retries)"
echo "    2. WebSocket failed → switch to HTTP Long-Polling"
echo "    3. Polling registration via POST /api/agent/connect"
echo "    4. Agent polls via GET /api/agent/poll (30s hold)"
echo "    5. Every 5 min: probe if WebSocket is available → auto-upgrade"
echo ""

pause

# ── 4. Simulate Polling Connection ─────────────────────────

step "Simulate HTTP Long-Polling connection"

info "Simulating agent registration via polling..."
echo ""

# Polling Connect
CONNECT_RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PROXY_TOKEN" \
  -d '{
    "system_info": {
      "hostname": "frankfurt-srv-01",
      "os_name": "linux",
      "os_version": "Ubuntu 22.04",
      "ip_address": "10.0.50.23",
      "num_cpu": 8,
      "total_mem_mb": 16384,
      "version": "1.2.0",
      "transport_mode": "polling"
    },
    "transport": "polling"
  }' \
  "$API_URL/api/agent/connect")

echo -e "  ${BOLD}POST /api/agent/connect${NC}"
echo "$CONNECT_RESPONSE" | jq .

success "Agent registered via polling!"

pause

# ── 5. Show Long-Poll Request ───────────────────────────────

step "Demonstrate long-poll request"

info "Agent sends long-poll request (holds 5s open)..."
echo -e "  ${BOLD}GET /api/agent/poll?timeout=5${NC}"
echo ""

POLL_RESPONSE=$(curl -s -w "\n--- HTTP Status: %{http_code} | Duration: %{time_total}s ---" \
  -H "Authorization: Bearer $PROXY_TOKEN" \
  "$API_URL/api/agent/poll?timeout=5")

echo "$POLL_RESPONSE"
echo ""

info "With timeout=30, the server holds the connection up to 30s"
info "As soon as a message is available, it responds immediately"

pause

# ── 6. Check Agent Status ────────────────────────────────────

step "Agent status in dashboard"

info "Agent overview:"
api_get "/api/agents" | jq '.[] | {
  id, name, status, transport_mode,
  last_poll_at, system, ip_address
}'

pause

# ── 7. Start Transfer via Polling ──────────────────────────

step "Transfer via polling agent"

# Create second agent (normal WS agent)
HQ_AGENT_ID=$(create_agent "HQ-Server" "server" "Headquarters — WebSocket connection")
HQ_TOKEN=$(create_token "$HQ_AGENT_ID" "hq-token")

JOB_ID=$(create_job \
  "Frankfurt → HQ Report-Sync" \
  "$PROXY_AGENT_ID" \
  "$HQ_AGENT_ID" \
  "/data/reports/daily-report.pdf" \
  "/data/incoming/frankfurt/daily-report.pdf")

echo ""
info "Transfer job created:"
echo -e "    ├─ Source: ${BOLD}Frankfurt-Proxy${NC} (polling)"
echo -e "    ├─ Target: ${BOLD}HQ-Server${NC} (WebSocket)"
echo -e "    └─ File:   daily-report.pdf"

pause

info "Triggering job..."
api_post "/api/jobs/$JOB_ID/run" "{}" | jq .

success "Transfer started — command will be delivered via polling queue!"

echo ""
info "The transfer command has been enqueued in the message queue."
info "It will be delivered on the Frankfurt agent's next poll."

# ── 8. Send Message (Agent → Server via Polling) ───────────────

step "Agent sends status via HTTP (instead of WebSocket)"

info "Simulating heartbeat via POST /api/agent/messages..."

HEARTBEAT_RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PROXY_TOKEN" \
  -d "{
    \"type\": \"heartbeat\",
    \"data\": {\"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}
  }" \
  "$API_URL/api/agent/messages")

echo -e "  ${BOLD}POST /api/agent/messages${NC}"
echo "$HEARTBEAT_RESPONSE" | jq .
success "Heartbeat via HTTP successful!"

pause

# ── 9. Comparison ───────────────────────────────────────────

step "Transport Comparison"

echo ""
echo -e "  ${BOLD}┌─────────────────┬──────────────────┬──────────────────┐${NC}"
echo -e "  ${BOLD}│                 │   WebSocket       │   Long-Polling   │${NC}"
echo -e "  ${BOLD}├─────────────────┼──────────────────┼──────────────────┤${NC}"
echo -e "  │ Latency         │ ${GREEN}~10ms${NC}            │ ${YELLOW}~100-500ms${NC}       │"
echo -e "  │ Firewall        │ ${RED}May be blocked${NC}   │ ${GREEN}Always open${NC}      │"
echo -e "  │ Proxy support   │ ${RED}Problematic${NC}      │ ${GREEN}Standard HTTPS${NC}   │"
echo -e "  │ Bidirectional   │ ${GREEN}Yes${NC}              │ ${YELLOW}Emulated${NC}         │"
echo -e "  │ Auto-reconnect  │ ${GREEN}Yes${NC}              │ ${GREEN}Yes${NC}              │"
echo -e "  │ Upgrade probe   │ —                │ ${GREEN}Every 5 min${NC}      │"
echo -e "  ${BOLD}└─────────────────┴──────────────────┴──────────────────┘${NC}"
echo ""

pause

# ── 10. Summary ─────────────────────────────────────────────────

echo ""
echo -e "${BOLD}${GREEN}"
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║                     Demo completed!                     ║"
echo "  ╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
info "Key takeaways for enterprise customers:"
echo "    ├─ ${BOLD}transport_mode: auto${NC} — no manual configuration needed"
echo "    ├─ Agent automatically detects if WebSocket is available"
echo "    ├─ Fallback to HTTP Long-Polling is transparent"
echo "    ├─ No loss of functionality — all features available"
echo "    └─ Automatic upgrade when WebSocket becomes available again"
echo ""
info "Agent startup commands:"
echo ""
echo -e "    ${BOLD}# Mode: Automatic (recommended)${NC}"
echo "    CONNECTION_TOKEN=<token> ./fileflux-agent"
echo ""
echo -e "    ${BOLD}# Mode: Polling only (e.g. with known WS block)${NC}"
echo "    CONNECTION_TOKEN=<token> CONNECTION_TRANSPORT_MODE=polling ./fileflux-agent"
echo ""
echo -e "    ${BOLD}# Docker variant${NC}"
echo "    docker run -e CONNECTION_TOKEN=<token> \\"
echo "               -e CONNECTION_HTTP_URL=https://fileflux.example.com \\"
echo "               -e CONNECTION_TRANSPORT_MODE=auto \\"
echo "               fileflux/agent:latest"
echo ""
