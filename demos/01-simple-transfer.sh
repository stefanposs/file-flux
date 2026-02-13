#!/usr/bin/env bash
# ============================================================================
# FileFlux Demo 1: Simple File Transfer (Agent A → Agent B)
# ============================================================================
# Shows: Agent registration, token creation, job setup, transfer execution
# Duration: ~2 minutes
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/common.sh"

echo ""
echo -e "${BOLD}${CYAN}"
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║         FileFlux — Demo 1: Simple File Transfer        ║"
echo "  ║                   Agent A  ──→  Agent B                  ║"
echo "  ╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo "  This demo shows a complete file transfer between"
echo "  two agents via the FileFlux platform."
echo ""

pause

# ── 1. Health Check ──────────────────────────────────────────────

check_health

# ── 2. Login ─────────────────────────────────────────────────────

login

# ── 3. Show Agents ───────────────────────────────────────────────

step "Check existing agents"
show_agents

# ── 4. Create Demo Agents ────────────────────────────────────────

step "Create demo agents"

AGENT_A_ID=$(create_agent "Berlin-Office" "client" "Berlin location — source agent")
AGENT_B_ID=$(create_agent "Munich-Office" "client" "Munich location — destination agent")

echo ""
info "Overview:"
echo -e "    ├─ Agent A (source):  ${BOLD}Berlin-Office${NC}  (ID: $AGENT_A_ID)"
echo -e "    └─ Agent B (target):  ${BOLD}Munich-Office${NC}  (ID: $AGENT_B_ID)"

pause

# ── 5. Create Tokens ─────────────────────────────────────────

step "Create agent tokens"
info "Each agent requires an authentication token"

TOKEN_A=$(create_token "$AGENT_A_ID" "berlin-token")
TOKEN_B=$(create_token "$AGENT_B_ID" "munich-token")

echo ""
info "Tokens can now be used in the agent configurations"
echo -e "    ├─ Berlin:  ${BOLD}CONNECTION_TOKEN=$TOKEN_A${NC}"
echo -e "    └─ Munich:  ${BOLD}CONNECTION_TOKEN=$TOKEN_B${NC}"

pause

# ── 6. Create Job ────────────────────────────────────────────

step "Create transfer job"
info "A job defines source, destination, and an optional schedule"

JOB_ID=$(create_job \
  "Berlin → Munich Backup" \
  "$AGENT_A_ID" \
  "$AGENT_B_ID" \
  "/data/reports/quartal-q4.pdf" \
  "/data/backup/berlin/quartal-q4.pdf")

echo ""
info "Job details:"
api_get "/api/jobs/$JOB_ID" | jq '{
  id, name, type, status,
  source_path, destination_path,
  source_agent_id, destination_agent_id
}'

pause

# ── 7. Start Transfer ────────────────────────────────────────

step "Trigger transfer manually"
info "In production, transfers run automatically via schedule"
info "For this demo, we trigger it manually..."

RUN_RESPONSE=$(api_post "/api/jobs/$JOB_ID/run" "{}")
echo ""
echo "$RUN_RESPONSE" | jq .

success "Transfer has been started!"

# ── 8. Watch Transfer ───────────────────────────────────────

step "Monitor transfer progress"
info "The source agent uploads the file, the destination agent downloads it"
info "(In the demo this may show 'pending' since no real agents are running)"

watch_transfer "$JOB_ID" 30

# ── 9. Show Result ───────────────────────────────────────────

step "Result"
show_transfers

echo ""
echo -e "${BOLD}${GREEN}"
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║                     Demo completed!                     ║"
echo "  ╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
info "Next steps:"
echo "    ├─ Open frontend: http://localhost:3000"
echo "    ├─ Start agent:   CONNECTION_TOKEN=<token> ./fileflux-agent"
echo "    └─ Next demo:     ./02-scheduled-transfer.sh"
echo ""
