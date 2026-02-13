#!/usr/bin/env bash
# ============================================================================
# FileFlux Demo 3: WebSocket → HTTP Long-Polling Fallback
# ============================================================================
# Zeigt: Automatischer Transport-Wechsel wenn WebSocket nicht verfügbar ist
# Dauer: ~2 Minuten
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/common.sh"

echo ""
echo -e "${BOLD}${CYAN}"
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║    FileFlux — Demo 3: Transport-Fallback (Enterprise)    ║"
echo "  ║          WebSocket  ──→  HTTP Long-Polling               ║"
echo "  ╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo "  In vielen Unternehmensumgebungen blockieren Firewalls oder"
echo "  Proxies WebSocket-Verbindungen. FileFlux erkennt das automatisch"
echo "  und wechselt auf HTTP Long-Polling als Fallback."
echo ""

pause

# ── 1. Vorbereitung ─────────────────────────────────────────────

check_health
login

# ── 2. Szenario erklären ────────────────────────────────────────

step "Enterprise-Szenario"

echo ""
echo -e "  ${BOLD}Netzwerk-Topologie:${NC}"
echo ""
echo "    ┌──────────────┐     WebSocket ✘     ┌──────────────┐"
echo "    │   Standort A  │ ─ ─ ─ ─ ─ ✘ ─ ─ ─ │  FileFlux    │"
echo "    │  (hinter Proxy)│                    │  Server      │"
echo "    │               │ ════ HTTPS ════════ │              │"
echo "    └──────────────┘    Long-Polling ✔    └──────────────┘"
echo ""
echo -e "  ${YELLOW}Problem:${NC}  Corporate Proxy blockiert WebSocket-Upgrade"
echo -e "  ${GREEN}Lösung:${NC}   Agent wechselt automatisch auf HTTP Long-Polling"
echo ""

pause

# ── 3. Agent mit Auto-Transport registrieren ────────────────────

step "Agent mit Transport-Auto-Detection registrieren"

PROXY_AGENT_ID=$(create_agent "Frankfurt-Proxy" "client" "Agent hinter Corporate Proxy — kein WebSocket")
PROXY_TOKEN=$(create_token "$PROXY_AGENT_ID" "proxy-token")

echo ""
info "Agent-Konfiguration für Proxy-Umgebung:"
echo ""
echo -e "  ${BOLD}config.yaml:${NC}"
echo -e "    ${CYAN}connection:${NC}"
echo -e "      ${CYAN}server_url:${NC} ws://fileflux.example.com:3002/ws/agent"
echo -e "      ${CYAN}server_http_url:${NC} https://fileflux.example.com"
echo -e "      ${CYAN}transport_mode:${NC} ${BOLD}auto${NC}    ${GREEN}← Schlüssel-Einstellung${NC}"
echo -e "      ${CYAN}poll_timeout:${NC} 30"
echo -e "      ${CYAN}ws_probe_interval:${NC} 300"
echo ""
echo -e "  ${BOLD}Ablauf bei ${CYAN}transport_mode: auto${NC}${BOLD}:${NC}"
echo "    1. Agent versucht WebSocket-Verbindung (3 Versuche)"
echo "    2. WebSocket fehlgeschlagen → Wechsel auf HTTP Long-Polling"
echo "    3. Polling-Registrierung via POST /api/agent/connect"
echo "    4. Agent pollt via GET /api/agent/poll (30s Hold)"
echo "    5. Alle 5 Min: Probe ob WebSocket wieder geht → Auto-Upgrade"
echo ""

pause

# ── 4. Polling-Verbindung simulieren ───────────────────────────

step "HTTP Long-Polling Verbindung simulieren"

info "Simuliere Agent-Registrierung via Polling..."
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

success "Agent via Polling registriert!"

pause

# ── 5. Long-Poll Request zeigen ─────────────────────────────────

step "Long-Poll Request demonstrieren"

info "Agent sendet Long-Poll Request (hält 5s offen)..."
echo -e "  ${BOLD}GET /api/agent/poll?timeout=5${NC}"
echo ""

POLL_RESPONSE=$(curl -s -w "\n--- HTTP Status: %{http_code} | Dauer: %{time_total}s ---" \
  -H "Authorization: Bearer $PROXY_TOKEN" \
  "$API_URL/api/agent/poll?timeout=5")

echo "$POLL_RESPONSE"
echo ""

info "Bei timeout=30 hält der Server die Verbindung bis zu 30s offen"
info "Sobald eine Nachricht vorliegt, wird sofort geantwortet"

pause

# ── 6. Agent-Status prüfen ──────────────────────────────────────

step "Agent-Status im Dashboard"

info "Agent-Übersicht:"
api_get "/api/agents" | jq '.[] | {
  id, name, status, transport_mode,
  last_poll_at, system, ip_address
}'

pause

# ── 7. Transfer via Polling starten ────────────────────────────

step "Transfer über Polling-Agent"

# Zweiten Agent erstellen (normaler WS-Agent)
HQ_AGENT_ID=$(create_agent "HQ-Server" "server" "Hauptquartier — WebSocket-Verbindung")
HQ_TOKEN=$(create_token "$HQ_AGENT_ID" "hq-token")

JOB_ID=$(create_job \
  "Frankfurt → HQ Report-Sync" \
  "$PROXY_AGENT_ID" \
  "$HQ_AGENT_ID" \
  "/data/reports/daily-report.pdf" \
  "/data/incoming/frankfurt/daily-report.pdf")

echo ""
info "Transfer-Job erstellt:"
echo -e "    ├─ Quelle: ${BOLD}Frankfurt-Proxy${NC} (Polling)"
echo -e "    ├─ Ziel:   ${BOLD}HQ-Server${NC} (WebSocket)"
echo -e "    └─ Datei:  daily-report.pdf"

pause

info "Job auslösen..."
api_post "/api/jobs/$JOB_ID/run" "{}" | jq .

success "Transfer gestartet — Befehl wird via Polling-Queue zugestellt!"

echo ""
info "Der Transfer-Befehl wurde in die Message-Queue eingereiht."
info "Beim nächsten Poll des Frankfurt-Agents wird er zugestellt."

# ── 8. Message senden (Agent → Server via Polling) ─────────────

step "Agent sendet Status via HTTP (statt WebSocket)"

info "Simuliere Heartbeat via POST /api/agent/messages..."

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
success "Heartbeat via HTTP erfolgreich!"

pause

# ── 9. Vergleich ────────────────────────────────────────────────

step "Transport-Vergleich"

echo ""
echo -e "  ${BOLD}┌─────────────────┬──────────────────┬──────────────────┐${NC}"
echo -e "  ${BOLD}│                 │   WebSocket       │   Long-Polling   │${NC}"
echo -e "  ${BOLD}├─────────────────┼──────────────────┼──────────────────┤${NC}"
echo -e "  │ Latenz          │ ${GREEN}~10ms${NC}            │ ${YELLOW}~100-500ms${NC}       │"
echo -e "  │ Firewall        │ ${RED}Kann blockiert${NC}   │ ${GREEN}Immer offen${NC}      │"
echo -e "  │ Proxy-Support   │ ${RED}Problematisch${NC}    │ ${GREEN}Standard HTTPS${NC}   │"
echo -e "  │ Bidirektional   │ ${GREEN}Ja${NC}               │ ${YELLOW}Emuliert${NC}         │"
echo -e "  │ Auto-Reconnect  │ ${GREEN}Ja${NC}               │ ${GREEN}Ja${NC}               │"
echo -e "  │ Upgrade-Probe   │ —                │ ${GREEN}Alle 5 Min${NC}       │"
echo -e "  ${BOLD}└─────────────────┴──────────────────┴──────────────────┘${NC}"
echo ""

pause

# ── 10. Zusammenfassung ─────────────────────────────────────────

echo ""
echo -e "${BOLD}${GREEN}"
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║                    Demo abgeschlossen!                   ║"
echo "  ╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
info "Key Takeaways für Enterprise-Kunden:"
echo "    ├─ ${BOLD}transport_mode: auto${NC} — kein manuelles Konfigurieren nötig"
echo "    ├─ Agent erkennt automatisch ob WebSocket möglich ist"
echo "    ├─ Fallback auf HTTP Long-Polling ist transparent"
echo "    ├─ Kein Funktionsverlust — alle Features verfügbar"
echo "    └─ Automatisches Upgrade wenn WebSocket wieder verfügbar"
echo ""
info "Agent-Startup-Kommandos:"
echo ""
echo -e "    ${BOLD}# Modus: Automatisch (empfohlen)${NC}"
echo "    CONNECTION_TOKEN=<token> ./fileflux-agent"
echo ""
echo -e "    ${BOLD}# Modus: Nur Polling (z.B. bei bekanntem WS-Block)${NC}"
echo "    CONNECTION_TOKEN=<token> CONNECTION_TRANSPORT_MODE=polling ./fileflux-agent"
echo ""
echo -e "    ${BOLD}# Docker-Variante${NC}"
echo "    docker run -e CONNECTION_TOKEN=<token> \\"
echo "               -e CONNECTION_HTTP_URL=https://fileflux.example.com \\"
echo "               -e CONNECTION_TRANSPORT_MODE=auto \\"
echo "               fileflux/agent:latest"
echo ""
