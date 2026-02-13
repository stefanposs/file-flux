#!/usr/bin/env bash
# ============================================================================
# FileFlux Demo 1: Einfacher File-Transfer (Agent A → Agent B)
# ============================================================================
# Zeigt: Agent-Registrierung, Token-Erstellung, Job-Anlage, Transfer-Ausführung
# Dauer: ~2 Minuten
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/common.sh"

echo ""
echo -e "${BOLD}${CYAN}"
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║         FileFlux — Demo 1: Einfacher File-Transfer      ║"
echo "  ║                   Agent A  ──→  Agent B                  ║"
echo "  ╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo "  Dieser Demo zeigt einen kompletten File-Transfer zwischen"
echo "  zwei Agents über die FileFlux-Plattform."
echo ""

pause

# ── 1. Health Check ──────────────────────────────────────────────

check_health

# ── 2. Login ─────────────────────────────────────────────────────

login

# ── 3. Agents anzeigen ───────────────────────────────────────────

step "Vorhandene Agents prüfen"
show_agents

# ── 4. Demo-Agents erstellen ────────────────────────────────────

step "Demo-Agents erstellen"

AGENT_A_ID=$(create_agent "Berlin-Office" "client" "Standort Berlin — Quell-Agent")
AGENT_B_ID=$(create_agent "München-Office" "client" "Standort München — Ziel-Agent")

echo ""
info "Übersicht:"
echo -e "    ├─ Agent A (Quelle):  ${BOLD}Berlin-Office${NC}  (ID: $AGENT_A_ID)"
echo -e "    └─ Agent B (Ziel):    ${BOLD}München-Office${NC} (ID: $AGENT_B_ID)"

pause

# ── 5. Tokens erstellen ─────────────────────────────────────────

step "Agent-Tokens erstellen"
info "Jeder Agent benötigt einen Authentifizierungs-Token"

TOKEN_A=$(create_token "$AGENT_A_ID" "berlin-token")
TOKEN_B=$(create_token "$AGENT_B_ID" "muenchen-token")

echo ""
info "Tokens können nun in den Agent-Konfigurationen hinterlegt werden"
echo -e "    ├─ Berlin:  ${BOLD}CONNECTION_TOKEN=$TOKEN_A${NC}"
echo -e "    └─ München: ${BOLD}CONNECTION_TOKEN=$TOKEN_B${NC}"

pause

# ── 6. Job erstellen ────────────────────────────────────────────

step "Transfer-Job erstellen"
info "Job definiert Quelle, Ziel und optionalen Schedule"

JOB_ID=$(create_job \
  "Berlin → München Backup" \
  "$AGENT_A_ID" \
  "$AGENT_B_ID" \
  "/data/reports/quartal-q4.pdf" \
  "/data/backup/berlin/quartal-q4.pdf")

echo ""
info "Job-Details:"
api_get "/api/jobs/$JOB_ID" | jq '{
  id, name, type, status,
  source_path, destination_path,
  source_agent_id, destination_agent_id
}'

pause

# ── 7. Transfer starten ─────────────────────────────────────────

step "Transfer manuell auslösen"
info "In Produktion laufen Transfers automatisch per Schedule"
info "Für die Demo lösen wir manuell aus..."

RUN_RESPONSE=$(api_post "/api/jobs/$JOB_ID/run" "{}")
echo ""
echo "$RUN_RESPONSE" | jq .

success "Transfer wurde gestartet!"

# ── 8. Transfer überwachen ──────────────────────────────────────

step "Transfer-Fortschritt überwachen"
info "Der Agent lädt die Datei hoch, der Ziel-Agent lädt sie herunter"
info "(In der Demo ggf. 'pending' da keine echten Agents laufen)"

watch_transfer "$JOB_ID" 30

# ── 9. Ergebnis anzeigen ────────────────────────────────────────

step "Ergebnis"
show_transfers

echo ""
echo -e "${BOLD}${GREEN}"
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║                    Demo abgeschlossen!                   ║"
echo "  ╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
info "Nächste Schritte:"
echo "    ├─ Frontend öffnen: http://localhost:3000"
echo "    ├─ Agent starten:   CONNECTION_TOKEN=<token> ./fileflux-agent"
echo "    └─ Weitere Demo:    ./02-scheduled-transfer.sh"
echo ""
