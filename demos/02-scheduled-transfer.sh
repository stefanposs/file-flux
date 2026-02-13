#!/usr/bin/env bash
# ============================================================================
# FileFlux Demo 2: Scheduled Transfer (Cron Job)
# ============================================================================
# Shows: Automated transfers via cron schedule
# Duration: ~3 minutes
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/common.sh"

echo ""
echo -e "${BOLD}${CYAN}"
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║      FileFlux — Demo 2: Automated Transfer             ║"
echo "  ║                  Cron-based Scheduling                   ║"
echo "  ╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo "  Shows how FileFlux automates transfers via cron schedule"
echo "  — ideal for daily backups and sync jobs."
echo ""

pause

# ── 1. Preparation ─────────────────────────────────────────────

check_health
login

# ── 2. Create Agents ─────────────────────────────────────────

step "Set up infrastructure"

PROD_ID=$(create_agent "Production-Server" "server" "Production database server")
BACKUP_ID=$(create_agent "Backup-NAS" "server" "Backup storage in data center")

TOKEN_PROD=$(create_token "$PROD_ID" "prod-token")
TOKEN_BACKUP=$(create_token "$BACKUP_ID" "backup-token")

echo ""
info "Infrastructure:"
echo -e "    ├─ ${BOLD}Production-Server${NC} (ID: $PROD_ID) — source"
echo -e "    └─ ${BOLD}Backup-NAS${NC}        (ID: $BACKUP_ID) — target"

pause

# ── 3. Configure Daily Backup ────────────────────────────────

step "Configure daily database backup"

info "Schedule: Every day at 02:00 AM (${BOLD}0 2 * * *${NC})"
echo ""

BACKUP_JOB_ID=$(create_job \
  "Daily DB Backup" \
  "$PROD_ID" \
  "$BACKUP_ID" \
  "/data/backups/db-dump.sql.gz" \
  "/data/archive/daily/db-dump.sql.gz" \
  "0 2 * * *")

echo ""
info "Job configuration:"
api_get "/api/jobs/$BACKUP_JOB_ID" | jq '{
  id, name, type, status, schedule,
  source_path, destination_path,
  source_agent_id, destination_agent_id
}'

pause

# ── 4. Configure Hourly Sync ────────────────────────────────

step "Configure hourly log sync"

info "Schedule: Every hour (${BOLD}0 * * * *${NC})"
echo ""

LOG_JOB_ID=$(create_job \
  "Hourly Log Sync" \
  "$PROD_ID" \
  "$BACKUP_ID" \
  "/data/logs/application.log" \
  "/data/archive/logs/application.log" \
  "0 * * * *")

echo ""
info "Job configuration:"
api_get "/api/jobs/$LOG_JOB_ID" | jq '{
  id, name, schedule, source_path, destination_path
}'

pause

# ── 5. Show All Jobs ─────────────────────────────────────────

step "All configured jobs"

api_get "/api/jobs" | jq -r '.[] | "  ├─ [\(.id)] \(.name) — Schedule: \(.schedule // "manual") — Status: \(.status)"'

pause

# ── 6. Run Manual Test ───────────────────────────────────────

step "Test run: Trigger backup job manually"
info "In production, this job runs automatically at 02:00 AM"
info "For the test, we trigger it manually now..."

api_post "/api/jobs/$BACKUP_JOB_ID/run" "{}" | jq .

success "Backup job started!"

watch_transfer "$BACKUP_JOB_ID" 30

# ── 7. Transfer History ──────────────────────────────────────

step "Transfer history"
show_transfers

echo ""
echo -e "${BOLD}${GREEN}"
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║                     Demo completed!                     ║"
echo "  ╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
info "Common cron schedules:"
echo "    ├─ ${BOLD}0 2 * * *${NC}     — Daily at 02:00"
echo "    ├─ ${BOLD}0 * * * *${NC}     — Hourly"
echo "    ├─ ${BOLD}*/15 * * * *${NC}  — Every 15 minutes"
echo "    ├─ ${BOLD}0 22 * * 1-5${NC}  — Weekdays at 22:00"
echo "    └─ ${BOLD}0 3 * * 0${NC}     — Sundays at 03:00"
echo ""
info "Next demo: ${BOLD}./03-polling-fallback.sh${NC}"
echo ""
