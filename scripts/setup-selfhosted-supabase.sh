#!/usr/bin/env bash
# =============================================================================
# Self-Hosted Supabase Bootstrap
# Target: Ubuntu 22.04 server at 10.200.1.7
# Install path: /opt/Ramky_Applications/DEV/supabase
#
# Usage:
#   sudo bash setup-selfhosted-supabase.sh
#
# Re-runs are safe:
#   - Docker install skipped if already present
#   - Supabase stack clone skipped if already present
#   - Secrets generated once and persisted in .env.secrets (chmod 600)
#   - .env rewritten from .env.secrets every run
# =============================================================================

set -Eeuo pipefail

# ---------- Config ----------
HOST_IP="${HOST_IP:-10.200.1.7}"
INSTALL_DIR="${INSTALL_DIR:-/opt/Ramky_Applications/DEV/supabase}"
STUDIO_PORT="${STUDIO_PORT:-3000}"
KONG_HTTP_PORT="${KONG_HTTP_PORT:-8000}"
KONG_HTTPS_PORT="${KONG_HTTPS_PORT:-8443}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
LOG_FILE="/var/log/supabase-bootstrap.log"

# ---------- Logging ----------
mkdir -p "$(dirname "$LOG_FILE")"
exec > >(tee -a "$LOG_FILE") 2>&1

on_err() {
  local exit_code=$?
  echo ""
  echo "!!! FAILED at line $1 (exit $exit_code)"
  echo "Last 30 log lines:"
  tail -n 30 "$LOG_FILE" || true
  exit $exit_code
}
trap 'on_err $LINENO' ERR

log() { echo -e "\n=== $* ==="; }

# ---------- 1. Preflight ----------
log "Preflight"
if [[ $EUID -ne 0 ]]; then
  echo "Must run as root (use sudo)."
  exit 1
fi
if ! grep -qi ubuntu /etc/os-release; then
  echo "This script targets Ubuntu. /etc/os-release does not look like Ubuntu."
  exit 1
fi
mkdir -p "$INSTALL_DIR"
echo "Install dir: $INSTALL_DIR"
echo "Host IP:     $HOST_IP"
echo "Log file:    $LOG_FILE"

# ---------- 2. Install base + Docker ----------
log "Installing base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl gnupg jq openssl git ufw python3 rsync lsb-release

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  echo "Docker + compose already installed: $(docker --version)"
else
  log "Installing Docker Engine + Compose plugin"
  install -m 0755 -d /etc/apt/keyrings
  if [[ ! -f /etc/apt/keyrings/docker.gpg ]]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
      | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
  fi
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
fi
docker --version
docker compose version

# ---------- 3. Clone Supabase docker stack ----------
log "Preparing Supabase stack at $INSTALL_DIR"
if [[ -f "$INSTALL_DIR/docker-compose.yml" ]]; then
  echo "Existing docker-compose.yml found — skipping clone."
else
  echo "Cloning supabase/supabase (shallow)..."
  rm -rf /tmp/supabase-src
  git clone --depth 1 https://github.com/supabase/supabase /tmp/supabase-src
  rsync -a /tmp/supabase-src/docker/ "$INSTALL_DIR/"
  rm -rf /tmp/supabase-src
  echo "Stack files copied."
fi

cd "$INSTALL_DIR"
if [[ ! -f .env.example ]]; then
  echo ".env.example missing in $INSTALL_DIR. Aborting."
  exit 1
fi

# Ensure volume dirs exist (Supabase upstream ships these but be safe).
mkdir -p volumes/db/data volumes/storage volumes/functions volumes/logs

# ---------- 4. Secrets ----------
SECRETS_FILE="$INSTALL_DIR/.env.secrets"

mint_jwt() {
  # mint_jwt <role> <jwt_secret>
  local role="$1" secret="$2"
  python3 - "$role" "$secret" <<'PY'
import sys, hmac, hashlib, base64, json, time
role, secret = sys.argv[1], sys.argv[2]
def b64url(b): return base64.urlsafe_b64encode(b).rstrip(b'=').decode()
header  = b64url(json.dumps({"alg":"HS256","typ":"JWT"}, separators=(",",":")).encode())
now = int(time.time())
payload = b64url(json.dumps({
  "role": role,
  "iss": "supabase",
  "iat": now,
  "exp": now + 60*60*24*365*10,
}, separators=(",",":")).encode())
signing_input = f"{header}.{payload}".encode()
sig = b64url(hmac.new(secret.encode(), signing_input, hashlib.sha256).digest())
print(f"{header}.{payload}.{sig}")
PY
}

rand_hex()    { openssl rand -hex "${1:-32}"; }
rand_b64()    { openssl rand -base64 "${1:-32}" | tr -d '\n=+/' | cut -c1-"${2:-32}"; }

if [[ -f "$SECRETS_FILE" ]]; then
  log "Reusing existing $SECRETS_FILE"
  # shellcheck disable=SC1090
  source "$SECRETS_FILE"
else
  log "Generating fresh secrets -> $SECRETS_FILE"
  POSTGRES_PASSWORD="$(rand_b64 48 32)"
  JWT_SECRET="$(rand_hex 32)"          # 64 hex chars
  DASHBOARD_USERNAME="supabase"
  DASHBOARD_PASSWORD="$(rand_b64 48 24)"
  SECRET_KEY_BASE="$(rand_hex 32)"
  VAULT_ENC_KEY="$(rand_b64 48 32)"
  LOGFLARE_PUBLIC_ACCESS_TOKEN="$(rand_hex 32)"
  LOGFLARE_PRIVATE_ACCESS_TOKEN="$(rand_hex 32)"
  POOLER_TENANT_ID="${POOLER_TENANT_ID:-1000}"

  ANON_KEY="$(mint_jwt anon "$JWT_SECRET")"
  SERVICE_ROLE_KEY="$(mint_jwt service_role "$JWT_SECRET")"

  umask 077
  cat > "$SECRETS_FILE" <<EOF
# Generated by setup-selfhosted-supabase.sh on $(date -Iseconds)
# Keep this file secret. Used to regenerate .env on every run.
POSTGRES_PASSWORD='$POSTGRES_PASSWORD'
JWT_SECRET='$JWT_SECRET'
ANON_KEY='$ANON_KEY'
SERVICE_ROLE_KEY='$SERVICE_ROLE_KEY'
DASHBOARD_USERNAME='$DASHBOARD_USERNAME'
DASHBOARD_PASSWORD='$DASHBOARD_PASSWORD'
SECRET_KEY_BASE='$SECRET_KEY_BASE'
VAULT_ENC_KEY='$VAULT_ENC_KEY'
LOGFLARE_PUBLIC_ACCESS_TOKEN='$LOGFLARE_PUBLIC_ACCESS_TOKEN'
LOGFLARE_PRIVATE_ACCESS_TOKEN='$LOGFLARE_PRIVATE_ACCESS_TOKEN'
POOLER_TENANT_ID='$POOLER_TENANT_ID'
EOF
  chmod 600 "$SECRETS_FILE"
fi

# ---------- 5. Write .env ----------
log "Writing $INSTALL_DIR/.env"

ENV_FILE="$INSTALL_DIR/.env"
cp "$INSTALL_DIR/.env.example" "$ENV_FILE"

set_env() {
  # set_env KEY VALUE  -> upsert KEY=VALUE in $ENV_FILE
  local key="$1" val="$2"
  local esc
  esc=$(printf '%s' "$val" | sed -e 's/[\/&]/\\&/g')
  if grep -qE "^${key}=" "$ENV_FILE"; then
    sed -i -E "s|^${key}=.*|${key}=${esc}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

set_env POSTGRES_PASSWORD            "$POSTGRES_PASSWORD"
set_env JWT_SECRET                   "$JWT_SECRET"
set_env ANON_KEY                     "$ANON_KEY"
set_env SERVICE_ROLE_KEY             "$SERVICE_ROLE_KEY"
set_env DASHBOARD_USERNAME           "$DASHBOARD_USERNAME"
set_env DASHBOARD_PASSWORD           "$DASHBOARD_PASSWORD"
set_env SECRET_KEY_BASE              "$SECRET_KEY_BASE"
set_env VAULT_ENC_KEY                "$VAULT_ENC_KEY"
set_env LOGFLARE_PUBLIC_ACCESS_TOKEN "$LOGFLARE_PUBLIC_ACCESS_TOKEN"
set_env LOGFLARE_PRIVATE_ACCESS_TOKEN "$LOGFLARE_PRIVATE_ACCESS_TOKEN"
set_env POOLER_TENANT_ID             "$POOLER_TENANT_ID"

set_env SITE_URL                     "http://${HOST_IP}:${STUDIO_PORT}"
set_env API_EXTERNAL_URL             "http://${HOST_IP}:${KONG_HTTP_PORT}"
set_env SUPABASE_PUBLIC_URL          "http://${HOST_IP}:${KONG_HTTP_PORT}"
set_env ADDITIONAL_REDIRECT_URLS     ""

set_env STUDIO_DEFAULT_ORGANIZATION  "Sharvi"
set_env STUDIO_DEFAULT_PROJECT       "VMS-DEV"

set_env KONG_HTTP_PORT               "$KONG_HTTP_PORT"
set_env KONG_HTTPS_PORT              "$KONG_HTTPS_PORT"
set_env STUDIO_PORT                  "$STUDIO_PORT"
set_env POSTGRES_PORT                "$POSTGRES_PORT"

set_env ENABLE_EMAIL_SIGNUP          "true"
set_env ENABLE_EMAIL_AUTOCONFIRM     "false"
set_env ENABLE_PHONE_SIGNUP          "false"
set_env ENABLE_PHONE_AUTOCONFIRM     "false"
set_env DISABLE_SIGNUP               "false"

chmod 600 "$ENV_FILE"

# ---------- 6. Firewall ----------
if ufw status | grep -q "Status: active"; then
  log "Configuring ufw rules"
  ufw allow 22/tcp   || true
  ufw allow 80/tcp   || true
  ufw allow "${STUDIO_PORT}/tcp"     || true
  ufw allow "${KONG_HTTP_PORT}/tcp"  || true
  # Postgres ${POSTGRES_PORT} intentionally NOT exposed publicly.
else
  echo "ufw inactive — skipping firewall config."
fi

# ---------- 7. Start the stack ----------
log "Pulling images"
( cd "$INSTALL_DIR" && docker compose pull )

log "Starting Supabase stack"
( cd "$INSTALL_DIR" && docker compose up -d )

log "Waiting for Kong API on :${KONG_HTTP_PORT} (up to 120s)"
ready=0
for i in $(seq 1 60); do
  if curl -sSf -o /dev/null "http://127.0.0.1:${KONG_HTTP_PORT}/"; then
    ready=1
    echo "Kong is up after ${i}x2s."
    break
  fi
  sleep 2
done
if [[ $ready -ne 1 ]]; then
  echo "WARNING: Kong did not respond within 120s. Check: docker compose -f $INSTALL_DIR/docker-compose.yml ps"
fi

# ---------- 8. Summary ----------
mask() { local s="$1"; echo "${s:0:12}...${s: -8}"; }

cat <<EOF

================================================================
  Self-Hosted Supabase ready
================================================================
  Studio:      http://${HOST_IP}:${STUDIO_PORT}
  REST API:    http://${HOST_IP}:${KONG_HTTP_PORT}
  Postgres:    127.0.0.1:${POSTGRES_PORT}  (NOT exposed externally)

  Studio login
    Username:  ${DASHBOARD_USERNAME}
    Password:  ${DASHBOARD_PASSWORD}

  Keys (full values in ${SECRETS_FILE}):
    ANON_KEY:          $(mask "$ANON_KEY")
    SERVICE_ROLE_KEY:  $(mask "$SERVICE_ROLE_KEY")

  Point the VMS frontend at this instance:
    VITE_SUPABASE_URL=http://${HOST_IP}:${KONG_HTTP_PORT}
    VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY from ${SECRETS_FILE}>
    Then rebuild and redeploy the React app.

  Useful commands:
    cd ${INSTALL_DIR}
    docker compose ps
    docker compose logs -f kong auth rest studio
    docker compose restart
    docker compose down            # stop
    docker compose down -v         # stop + wipe data (DANGEROUS)

  Logs: ${LOG_FILE}
================================================================
EOF
