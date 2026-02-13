#!/usr/bin/env bash
# ============================================================================
# FileFlux Demo 2: Geplanter Transfer (Cron-Job)
# ============================================================================
# Zeigt: Automatisierte Transfers per Cron-Schedule
# Dauer: ~3 Minuten
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/common.sh"

echo ""
echo -e "${BOLD}${CYAN}"
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║      FileFlux — Demo 2: Automatisierter Transfer        ║"
echo "  ║                  Cron-basiertes Scheduling               ║"
echo "  ╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo "  Zeigt wie FileFlux Transfers automatisiert per Cron-Schedule"
echo "  ausführt — ideal für tägliche Backups und Sync-Jobs."
echo ""

pause

# ── 1. Vorbereitung ─────────────────────────────────────────────

check_health
login

# ── 2. Agents erstellen ─────────────────────────────────────────

step "Infrastruktur aufsetzen"

PROD_ID=$(create_agent "Produktion-Server" "server" "Produktions-Datenbank-Server")
BACKUP_ID=$(create_agent "Backup-NAS" "server" "Backup-Storage im Rechenzentrum")

TOKEN_PROD=$(create_token "$PROD_ID" "prod-token")
TOKEN_BACKUP=$(create_token "$BACKUP_ID" "backup-token")

echo ""
info "Infrastruktur:"
echo -e "    ├─ ${BOLD}Produktion-Server${NC} (ID: $PROD_ID) — Quelle"
echo -e "    └─ ${BOLD}Backup-NAS${NC}        (ID: $BACKUP_ID) — Ziel"

pause

# ── 3. Tägliches Backup konfigurieren ──────────────────────────

step "Tägliches Datenbank-Backup konfigurieren"

info "Schedule: Jeden Tag um 02:00 Uhr (${BOLD}0 2 * * *${NC})"
echo ""

BACKUP_JOB_ID=$(create_job \
  "Tägliches DB-Backup" \
  "$PROD_ID" \
  "$BACKUP_ID" \
  "/data/backups/db-dump.sql.gz" \
  "/data/archive/daily/db-dump.sql.gz" \
  "0 2 * * *")

echo ""
info "Job-Konfiguration:"
api_get "/api/jobs/$BACKUP_JOB_ID" | jq '{
  id, name, type, status, schedule,
  source_path, destination_path,
  source_agent_id, destination_agent_id
}'

pause

# ── 4. Stündlichen Sync konfigurieren ──────────────────────────

step "Stündlichen Log-Sync konfigurieren"

info "Schedule: Jede Stunde (${BOLD}0 * * * *${NC})"
echo ""

LOG_JOB_ID=$(create_job \
  "Stündlicher Log-Sync" \
  "$PROD_ID" \
  "$BACKUP_ID" \
  "/data/logs/application.log" \
  "/data/archive/logs/application.log" \
  "0 * * * *")

echo ""
info "Job-Konfiguration:"
api_get "/api/jobs/$LOG_JOB_ID" | jq '{
  id, name, schedule, source_path, destination_path
}'

pause

# ── 5. Alle Jobs anzeigen ──────────────────────────────────────

step "Alle konfigurierten Jobs"

api_get "/api/jobs" | jq -r '.[] | "  ├─ [\(.id)] \(.name) — Schedule: \(.schedule // "manuell") — Status: \(.status)"'

pause

# ── 6. Manuellen Test-Run ausführen ────────────────────────────

step "Test-Run: Backup-Job manuell auslösen"
info "In Produktion läuft dieser Job automatisch um 02:00 Uhr"
info "Für den Test lösen wir ihn jetzt manuell aus..."

api_post "/api/jobs/$BACKUP_JOB_ID/run" "{}" | jq .

success "Backup-Job gestartet!"

watch_transfer "$BACKUP_JOB_ID" 30

# ── 7. Transfer-Historie ───────────────────────────────────────

step "Transfer-Historie"
show_transfers

echo ""
echo -e "${BOLD}${GREEN}"
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║                    Demo abgeschlossen!                   ║"
echo "  ╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
info "Typische Cron-Schedules:"
echo "    ├─ ${BOLD}0 2 * * *${NC}     — Täglich um 02:00"
echo "    ├─ ${BOLD}0 * * * *${NC}     — Stündlich"
echo "    ├─ ${BOLD}*/15 * * * *${NC}  — Alle 15 Minuten"
echo "    ├─ ${BOLD}0 22 * * 1-5${NC}  — Werktags um 22:00"
echo "    └─ ${BOLD}0 3 * * 0${NC}     — Sonntags um 03:00"
echo ""
info "Nächste Demo: ${BOLD}./03-polling-fallback.sh${NC}"
echo ""
