#!/usr/bin/env bash
# =============================================================================
# VMS Self-Hosted Deployment — Master Script
# Target: Ubuntu 22.04
# Layout: /opt/Ramky_Applications/DEV/VMS/{backend,frontend,middleware,supabase,logs}
#
# Usage:
#   sudo PUBLIC_BASE_URL=http://<public-host-or-ip>[:port] \
#        bash scripts/deploy-vms-server.sh [flags]
#
#   (or pass HOST_IP=<ip> to build PUBLIC_BASE_URL=http://<ip>)
#
# Flags:
#   --skip-docker       skip apt/docker/node/nginx install
#   --skip-build        don't rebuild frontend (reuse existing dist/)
#   --skip-migrations   don't apply SQL migrations
#   --skip-functions    don't sync edge functions
#   --skip-nginx        don't touch nginx config
#   --skip-middleware   don't (re)install middleware service
#   --reset-secrets     regenerate backend/.env.secrets (DANGEROUS)
#
# Re-runs are safe. Secrets generated once and persisted.
# =============================================================================

set -Eeuo pipefail

# ---------- Config (override via env) ----------
# Require either PUBLIC_BASE_URL (preferred — the public URL vendors actually
# browse to, including port) or HOST_IP. Do NOT hardcode an internal LAN IP
# here — that's what baked the wrong SITE_URL into GoTrue.
if [[ -z "${PUBLIC_BASE_URL:-}" && -z "${HOST_IP:-}" ]]; then
  echo "ERROR: set PUBLIC_BASE_URL=http://<public-host>[:port] (preferred)" >&2
  echo "       or HOST_IP=<ip> before running this script." >&2
  echo "       Example: sudo PUBLIC_BASE_URL=http://206.1.23.95:9009 bash $0" >&2
  exit 1
fi
export HOST_IP="${HOST_IP:-}"
export PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-http://${HOST_IP}}"
export APP_ROOT="${APP_ROOT:-/opt/Ramky_Applications/DEV/VMS}"
export NGINX_CONF_PATH="${NGINX_CONF_PATH:-/opt/Ramky_Applications/nginx/ramky-vms.conf}"
export BACKEND_DIR="${APP_ROOT}/backend"
export FRONTEND_DIR="${APP_ROOT}/frontend"
export MIDDLEWARE_DIR="${APP_ROOT}/middleware"
export SUPABASE_SRC_DIR="${APP_ROOT}/supabase"
export LOGS_DIR="${APP_ROOT}/logs"
export SOURCE_DIR="${SOURCE_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
export LOG_FILE="${LOGS_DIR}/deploy.log"

export STUDIO_PORT="${STUDIO_PORT:-3000}"
export KONG_HTTP_PORT="${KONG_HTTP_PORT:-8000}"
export KONG_HTTPS_PORT="${KONG_HTTPS_PORT:-8443}"
export POSTGRES_PORT="${POSTGRES_PORT:-5432}"
export POOLER_DB_PORT="${POOLER_DB_PORT:-5433}"
export POOLER_PROXY_PORT_TRANSACTION="${POOLER_PROXY_PORT_TRANSACTION:-6543}"
export MIDDLEWARE_PORT="${MIDDLEWARE_PORT:-3002}"

# ---------- Flags ----------
SKIP_DOCKER=0; SKIP_BUILD=0; SKIP_MIGRATIONS=0
SKIP_FUNCTIONS=0; SKIP_NGINX=0; SKIP_MIDDLEWARE=0; RESET_SECRETS=0
for arg in "$@"; do
  case "$arg" in
    --skip-docker)      SKIP_DOCKER=1 ;;
    --skip-build)       SKIP_BUILD=1 ;;
    --skip-migrations)  SKIP_MIGRATIONS=1 ;;
    --skip-functions)   SKIP_FUNCTIONS=1 ;;
    --skip-nginx)       SKIP_NGINX=1 ;;
    --skip-middleware)  SKIP_MIDDLEWARE=1 ;;
    --reset-secrets)    RESET_SECRETS=1 ;;
    *) echo "Unknown flag: $arg"; exit 2 ;;
  esac
done
export SKIP_DOCKER SKIP_BUILD SKIP_MIGRATIONS SKIP_FUNCTIONS SKIP_NGINX SKIP_MIDDLEWARE RESET_SECRETS

LIB_DIR="${SOURCE_DIR}/scripts/lib"
TEMPLATES_DIR="${SOURCE_DIR}/scripts/templates"
export LIB_DIR TEMPLATES_DIR

# ---------- Trap ----------
on_err() {
  local code=$?
  echo ""
  echo "!!! deploy failed at line $1 (exit $code)"
  echo "Last 40 log lines:"
  [[ -f "$LOG_FILE" ]] && tail -n 40 "$LOG_FILE" || true
  exit $code
}
trap 'on_err $LINENO' ERR

# ---------- Helpers shared with lib scripts ----------
log() { echo -e "\n=== $* ==="; }
export -f log

# ---------- Run steps ----------
# 00 sets up logging (tee) so the rest gets captured automatically
source "${LIB_DIR}/00-preflight.sh"
[[ $SKIP_DOCKER -eq 1 ]]    || source "${LIB_DIR}/10-packages.sh"
source "${LIB_DIR}/20-supabase.sh"
[[ $SKIP_MIGRATIONS -eq 1 ]] || source "${LIB_DIR}/30-migrations.sh"
[[ $SKIP_FUNCTIONS -eq 1 ]]  || source "${LIB_DIR}/40-functions.sh"
[[ $SKIP_MIDDLEWARE -eq 1 ]] || source "${LIB_DIR}/50-middleware.sh"
[[ $SKIP_BUILD -eq 1 ]]      || source "${LIB_DIR}/60-frontend.sh"
[[ $SKIP_NGINX -eq 1 ]]      || source "${LIB_DIR}/70-nginx.sh"
source "${LIB_DIR}/80-firewall.sh"
source "${LIB_DIR}/90-summary.sh"
