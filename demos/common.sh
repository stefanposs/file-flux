#!/usr/bin/env bash
# ============================================================================
# FileFlux Demo — Common Helper Functions
# ============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

API_URL="${API_URL:-http://localhost:3001}"
WS_URL="${WS_URL:-ws://localhost:3002/ws/agent}"
ADMIN_EMAIL="admin@fileflux.de"
ADMIN_PASSWORD="admin123"
JWT_TOKEN=""

# --- Output Helpers ---

step() {
  echo "" >&2
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}" >&2
  echo -e "${BOLD}${CYAN}▸ $1${NC}" >&2
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}" >&2
}

info()    { echo -e "  ${BLUE}ℹ${NC}  $1" >&2; }
success() { echo -e "  ${GREEN}✔${NC}  $1" >&2; }
warn()    { echo -e "  ${YELLOW}⚠${NC}  $1" >&2; }
error()   { echo -e "  ${RED}✘${NC}  $1" >&2; }

pause() {
  if [ -t 0 ]; then
    echo "" >&2
    echo -e "  ${YELLOW}⏸  Press ENTER to continue...${NC}" >&2
    read -r
  else
    sleep 1
  fi
}

# --- API-Helpers ---

api_get() {
  curl -s -H "Authorization: Bearer $JWT_TOKEN" "$API_URL$1"
}

api_post() {
  curl -s -X POST -H "Content-Type: application/json" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -d "$2" "$API_URL$1"
}

api_delete() {
  curl -s -X DELETE -H "Authorization: Bearer $JWT_TOKEN" "$API_URL$1"
}

api_put() {
  curl -s -X PUT -H "Content-Type: application/json" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -d "$2" "$API_URL$1"
}

# --- Login ---

login() {
  step "Login as Admin"

  local response
  response=$(curl -s -X POST -H "Content-Type: application/json" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
    "$API_URL/api/auth/login")

  JWT_TOKEN=$(echo "$response" | jq -r '.token')

  if [ "$JWT_TOKEN" = "null" ] || [ -z "$JWT_TOKEN" ]; then
    error "Login failed!"
    echo "$response" | jq . >&2
    exit 1
  fi

  local user_name
  user_name=$(echo "$response" | jq -r '.user.name')
  success "Logged in as ${BOLD}$user_name${NC}"
}

# --- Create Agent ---

create_agent() {
  local name="$1"
  local type="${2:-client}"
  local desc="${3:-Demo Agent}"

  info "Creating agent: ${BOLD}$name${NC} (type: $type)"

  local response
  response=$(api_post "/api/agents" \
    "{\"name\":\"$name\",\"type\":\"$type\",\"description\":\"$desc\"}")

  local agent_id
  agent_id=$(echo "$response" | jq -r '.id')

  if [ "$agent_id" = "null" ] || [ -z "$agent_id" ]; then
    error "Agent creation failed!"
    echo "$response" | jq . >&2
    exit 1
  fi

  success "Agent created: ID=${BOLD}$agent_id${NC}"
  echo "$agent_id"
}

# --- Create Token ---

create_token() {
  local agent_id="$1"
  local name="${2:-demo-token}"

  info "Creating token for agent $agent_id"

  local response
  response=$(api_post "/api/tokens" \
    "{\"agent_id\":$agent_id,\"name\":\"$name\",\"expires_in\":86400}")

  local token_value
  token_value=$(echo "$response" | jq -r '.value')

  if [ "$token_value" = "null" ] || [ -z "$token_value" ]; then
    error "Token creation failed!"
    echo "$response" | jq . >&2
    exit 1
  fi

  success "Token created: ${BOLD}${token_value:0:12}...${NC}"
  echo "$token_value"
}

# --- Create Job ---

create_job() {
  local name="$1"
  local source_agent_id="$2"
  local dest_agent_id="$3"
  local source_path="$4"
  local dest_path="$5"
  local schedule="${6:-}"

  local schedule_json="null"
  if [ -n "$schedule" ]; then
    schedule_json="\"$schedule\""
  fi

  info "Creating job: ${BOLD}$name${NC}"

  local response
  response=$(api_post "/api/jobs" \
    "{\"name\":\"$name\",\"type\":\"push\",\"source_path\":\"$source_path\",\"destination_path\":\"$dest_path\",\"source_agent_id\":$source_agent_id,\"destination_agent_id\":$dest_agent_id,\"schedule\":$schedule_json}")

  local job_id
  job_id=$(echo "$response" | jq -r '.id')

  if [ "$job_id" = "null" ] || [ -z "$job_id" ]; then
    error "Job creation failed!"
    echo "$response" | jq . >&2
    exit 1
  fi

  success "Job created: ID=${BOLD}$job_id${NC}"
  echo "$job_id"
}

# --- Watch Transfer Status ---

watch_transfer() {
  local job_id="$1"
  local timeout="${2:-60}"
  local start_time=$SECONDS

  info "Watching transfers for job $job_id..."

  while true; do
    local elapsed=$(( SECONDS - start_time ))
    if [ $elapsed -gt $timeout ]; then
      warn "Timeout after ${timeout}s"
      break
    fi

    local transfers
    transfers=$(api_get "/api/transfers")

    local latest
    latest=$(echo "$transfers" | jq -r "[.[] | select(.job_id == $job_id)] | sort_by(.created_at) | last")

    if [ "$latest" = "null" ]; then
      info "Waiting for transfer..."
      sleep 2
      continue
    fi

    local status progress
    status=$(echo "$latest" | jq -r '.status')
    progress=$(echo "$latest" | jq -r '.progress // 0')

    case "$status" in
      pending)
        echo -ne "\r  ⏳  Status: ${YELLOW}pending${NC}                    " >&2
        ;;
      running)
        echo -ne "\r  🔄  Status: ${BLUE}running${NC} — Progress: ${BOLD}${progress}%${NC}    " >&2
        ;;
      completed)
        echo "" >&2
        success "Transfer ${GREEN}completed${NC}! (${progress}%)"
        break
        ;;
      failed)
        echo "" >&2
        local err_msg
        err_msg=$(echo "$latest" | jq -r '.error // "unknown"')
        error "Transfer failed: $err_msg"
        break
        ;;
    esac

    sleep 2
  done
}

# --- Health Check ---

check_health() {
  step "Health Check"

  local response
  response=$(curl -s "$API_URL/health" 2>/dev/null || echo '{"status":"error"}')
  local status
  status=$(echo "$response" | jq -r '.status' 2>/dev/null || echo "error")

  if [ "$status" = "ok" ] || [ "$status" = "healthy" ]; then
    success "Backend is ${GREEN}online${NC}"
  else
    error "Backend is not reachable! Start with: ${BOLD}just dev${NC}"
    exit 1
  fi
}

# --- List Agents ---

show_agents() {
  info "Registered agents:"
  local data
  data=$(api_get "/api/agents")
  if echo "$data" | jq -e 'length > 0' >/dev/null 2>&1; then
    echo "$data" | jq -r '.[] | "    ├─ \(.id): \(.name) [\(.type)] — Status: \(.status)"' >&2
  else
    info "(no agents found)"
  fi
}

# --- List Transfers ---

show_transfers() {
  info "Current transfers:"
  local data
  data=$(api_get "/api/transfers")
  if echo "$data" | jq -e 'length > 0' >/dev/null 2>&1; then
    echo "$data" | jq -r '.[] | "    ├─ #\(.id): \(.status) (\(.progress // 0)%) — \(.source_path) → \(.destination_path)"' >&2
  else
    info "(no transfers found)"
  fi
}
