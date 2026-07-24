#!/usr/bin/env bash
# =============================================================================
# VMS / Sharvi Vendor Portal — Self-Hosted Supabase Setup (single file)
#
# Usage:
#   sudo bash setup-selfhost.sh [flags]
#
# Flags:
#   --skip-deps          skip apt + docker + node install
#   --skip-build         don't rebuild frontend (reuse existing dist/)
#   --skip-migrations    don't apply SQL migrations
#   --skip-functions     don't sync edge functions
#   --skip-nginx         don't touch nginx config
#   --skip-middleware    don't (re)install middleware service
#   --reset-secrets      regenerate backend/.env.secrets (invalidates JWTs!)
#   --host-ip <ip>       public host IP/DNS (default: auto-detect)
#
# Re-runs are safe. Run as root.
# =============================================================================
set -Eeuo pipefail

# ---------- Args ----------
SKIP_DEPS=0; SKIP_BUILD=0; SKIP_MIGRATIONS=0; SKIP_FUNCTIONS=0
SKIP_NGINX=0; SKIP_MIDDLEWARE=0; RESET_SECRETS=0; HOST_IP_OVERRIDE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-deps)        SKIP_DEPS=1 ;;
    --skip-build)       SKIP_BUILD=1 ;;
    --skip-migrations)  SKIP_MIGRATIONS=1 ;;
    --skip-functions)   SKIP_FUNCTIONS=1 ;;
    --skip-nginx)       SKIP_NGINX=1 ;;
    --skip-middleware)  SKIP_MIDDLEWARE=1 ;;
    --reset-secrets)    RESET_SECRETS=1 ;;
    --host-ip)          HOST_IP_OVERRIDE="${2:-}"; shift ;;
    -h|--help)          sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "Unknown flag: $1" >&2; exit 2 ;;
  esac
  shift
done

# ---------- Config ----------
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="${APP_ROOT:-${SOURCE_DIR}/selfhost}"
BACKEND_DIR="${APP_ROOT}/backend"
FRONTEND_DIR="${APP_ROOT}/frontend"
MIDDLEWARE_DIR="${APP_ROOT}/middleware"
LOGS_DIR="${APP_ROOT}/logs"
LOG_FILE="${LOGS_DIR}/setup.log"
NGINX_CONF_PATH="${NGINX_CONF_PATH:-/etc/nginx/sites-available/vms-selfhost.conf}"

STUDIO_PORT="${STUDIO_PORT:-3000}"
KONG_HTTP_PORT="${KONG_HTTP_PORT:-8000}"
KONG_HTTPS_PORT="${KONG_HTTPS_PORT:-8443}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POOLER_DB_PORT="${POOLER_DB_PORT:-5433}"
POOLER_PROXY_PORT_TRANSACTION="${POOLER_PROXY_PORT_TRANSACTION:-6543}"
MIDDLEWARE_PORT="${MIDDLEWARE_PORT:-3002}"

# ---------- Preflight ----------
[[ $EUID -eq 0 ]] || { echo "Must run as root (use sudo)." >&2; exit 1; }
grep -qiE 'ubuntu|debian' /etc/os-release || { echo "Targets Ubuntu/Debian." >&2; exit 1; }
[[ -f "$SOURCE_DIR/package.json" && -d "$SOURCE_DIR/supabase" ]] || {
  echo "Run from the repo root (need package.json and supabase/)." >&2; exit 1; }

mkdir -p "$APP_ROOT" "$BACKEND_DIR" "$FRONTEND_DIR" "$MIDDLEWARE_DIR" "$LOGS_DIR"
touch "$LOG_FILE"
exec > >(tee -a "$LOG_FILE") 2>&1

log()  { echo -e "\n=== $* ==="; }
warn() { echo "WARN: $*" >&2; }

ensure_functions_main() {
  local fn_dst="${BACKEND_DIR}/volumes/functions"
  mkdir -p "$fn_dst/main"
  if [[ -f "$fn_dst/main/index.ts" ]]; then
    echo "  self-host function router found"
    return 0
  fi

  echo "  self-host function router missing; creating $fn_dst/main/index.ts"
  cat > "$fn_dst/main/index.ts" <<'TS'
console.log('main function router started')

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  const pathParts = url.pathname.split('/')
  const serviceName = pathParts[1]

  if (!serviceName) {
    return new Response(JSON.stringify({ msg: 'missing function name in request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const servicePath = `/home/deno/functions/${serviceName}`
  console.error(`serving the request with ${servicePath}`)

  try {
    const worker = await EdgeRuntime.userWorkers.create({
      servicePath,
      memoryLimitMb: 150,
      workerTimeoutMs: 120000,
      noModuleCache: false,
      importMapPath: null,
      envVars: Object.entries(Deno.env.toObject()),
    })
    return await worker.fetch(req)
  } catch (e) {
    return new Response(JSON.stringify({ msg: e instanceof Error ? e.toString() : String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
TS
}

verify_function_entrypoint() {
  local fn_dst="${BACKEND_DIR}/volumes/functions"
  local name="$1"
  if [[ -f "$fn_dst/$name/index.ts" ]]; then
    echo "  $name entrypoint found"
  else
    echo "ERROR: $name/index.ts missing from deployed functions at $fn_dst" >&2
    echo "Expected: $fn_dst/$name/index.ts" >&2
    echo "Current deployed function folders:" >&2
    ls -la "$fn_dst" >&2 || true
    exit 1
  fi
}

trap 'rc=$?; echo; echo "!!! setup failed at line $LINENO (exit $rc)"; tail -n 40 "$LOG_FILE" || true; exit $rc' ERR

HOST_IP="${HOST_IP_OVERRIDE:-$(hostname -I 2>/dev/null | awk "{print \$1}")}"
HOST_IP="${HOST_IP:-127.0.0.1}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-http://${HOST_IP}}"

log "Preflight"
echo "Host IP        : $HOST_IP"
echo "Public base URL: $PUBLIC_BASE_URL"
echo "App root       : $APP_ROOT"
echo "Source repo    : $SOURCE_DIR"
echo "Log file       : $LOG_FILE"

# ---------- 1. Packages ----------
if [[ $SKIP_DEPS -eq 0 ]]; then
  log "Installing base packages"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg jq openssl git ufw python3 \
                     rsync lsb-release nginx apache2-utils iproute2

  if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -dv -f2 | cut -d. -f1)" -lt 20 ]]; then
    log "Installing Node.js 20"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  fi

  if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
    log "Installing Docker + Compose plugin"
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
  echo "Node: $(node -v)  npm: $(npm -v)  Docker: $(docker --version)"
fi

# ---------- 2. Fetch upstream Supabase docker stack ----------
log "Preparing Supabase stack at $BACKEND_DIR"
if [[ ! -f "$BACKEND_DIR/docker-compose.yml" ]]; then
  rm -rf /tmp/supabase-src
  git clone --depth 1 https://github.com/supabase/supabase /tmp/supabase-src
  rsync -a /tmp/supabase-src/docker/ "$BACKEND_DIR/"
  rm -rf /tmp/supabase-src
fi
mkdir -p "$BACKEND_DIR"/volumes/{db/data,storage,functions,logs}
[[ -f "$BACKEND_DIR/.env.example" ]] || { echo ".env.example missing"; exit 1; }

# ---------- 3. Secrets ----------
SECRETS_FILE="$BACKEND_DIR/.env.secrets"
mint_jwt() {
  python3 - "$1" "$2" <<'PY'
import sys, hmac, hashlib, base64, json, time
role, secret = sys.argv[1], sys.argv[2]
b64 = lambda b: base64.urlsafe_b64encode(b).rstrip(b'=').decode()
h = b64(json.dumps({"alg":"HS256","typ":"JWT"}, separators=(",",":")).encode())
now = int(time.time())
p = b64(json.dumps({"role":role,"iss":"supabase","iat":now,"exp":now+60*60*24*365*10}, separators=(",",":")).encode())
s = b64(hmac.new(secret.encode(), f"{h}.{p}".encode(), hashlib.sha256).digest())
print(f"{h}.{p}.{s}")
PY
}
rand_hex() { openssl rand -hex "${1:-32}"; }
rand_b64() { openssl rand -base64 "${1:-48}" | tr -d '\n=+/' | cut -c1-"${2:-32}"; }

if [[ $RESET_SECRETS -eq 1 && -f "$SECRETS_FILE" ]]; then
  mv "$SECRETS_FILE" "${SECRETS_FILE}.bak.$(date +%s)"
fi
if [[ -f "$SECRETS_FILE" ]]; then
  log "Reusing $SECRETS_FILE"
  # shellcheck disable=SC1090
  source "$SECRETS_FILE"
else
  log "Generating secrets -> $SECRETS_FILE"
  POSTGRES_PASSWORD="$(rand_b64 48 32)"
  JWT_SECRET="$(rand_hex 32)"
  DASHBOARD_USERNAME="supabase"
  DASHBOARD_PASSWORD="$(rand_b64 48 24)"
  SECRET_KEY_BASE="$(rand_hex 32)"
  VAULT_ENC_KEY="$(rand_b64 48 32)"
  LOGFLARE_PUBLIC_ACCESS_TOKEN="$(rand_hex 32)"
  LOGFLARE_PRIVATE_ACCESS_TOKEN="$(rand_hex 32)"
  POOLER_TENANT_ID="1000"
  ANON_KEY="$(mint_jwt anon "$JWT_SECRET")"
  SERVICE_ROLE_KEY="$(mint_jwt service_role "$JWT_SECRET")"
  umask 077
  cat > "$SECRETS_FILE" <<EOF
# Generated $(date -Iseconds)
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

# ---------- 4. backend/.env ----------
log "Writing $BACKEND_DIR/.env"
ENV_FILE="$BACKEND_DIR/.env"
cp -f "$BACKEND_DIR/.env.example" "$ENV_FILE"
set_env() {
  local k="$1" v="$2" e
  e=$(printf '%s' "$v" | sed -e 's/[\/&]/\\&/g')
  if grep -qE "^${k}=" "$ENV_FILE"; then
    sed -i -E "s|^${k}=.*|${k}=${e}|" "$ENV_FILE"
  else
    echo "${k}=${v}" >> "$ENV_FILE"
  fi
}
set_env POSTGRES_PASSWORD              "$POSTGRES_PASSWORD"
set_env JWT_SECRET                     "$JWT_SECRET"
set_env ANON_KEY                       "$ANON_KEY"
set_env SERVICE_ROLE_KEY               "$SERVICE_ROLE_KEY"
set_env DASHBOARD_USERNAME             "$DASHBOARD_USERNAME"
set_env DASHBOARD_PASSWORD             "$DASHBOARD_PASSWORD"
set_env SECRET_KEY_BASE                "$SECRET_KEY_BASE"
set_env VAULT_ENC_KEY                  "$VAULT_ENC_KEY"
set_env LOGFLARE_PUBLIC_ACCESS_TOKEN   "$LOGFLARE_PUBLIC_ACCESS_TOKEN"
set_env LOGFLARE_PRIVATE_ACCESS_TOKEN  "$LOGFLARE_PRIVATE_ACCESS_TOKEN"
set_env POOLER_TENANT_ID               "$POOLER_TENANT_ID"
set_env SITE_URL                       "$PUBLIC_BASE_URL"
set_env API_EXTERNAL_URL               "${PUBLIC_BASE_URL}/supabase"
set_env SUPABASE_PUBLIC_URL            "${PUBLIC_BASE_URL}/supabase"
set_env ADDITIONAL_REDIRECT_URLS       ""
set_env STUDIO_DEFAULT_ORGANIZATION    "Sharvi"
set_env STUDIO_DEFAULT_PROJECT         "VMS"
set_env KONG_HTTP_PORT                 "$KONG_HTTP_PORT"
set_env KONG_HTTPS_PORT                "$KONG_HTTPS_PORT"
set_env STUDIO_PORT                    "$STUDIO_PORT"
set_env POSTGRES_PORT                  "$POSTGRES_PORT"
set_env POOLER_PROXY_PORT_TRANSACTION  "$POOLER_PROXY_PORT_TRANSACTION"
set_env ENABLE_EMAIL_SIGNUP            "true"
set_env ENABLE_EMAIL_AUTOCONFIRM       "false"
set_env ENABLE_PHONE_SIGNUP            "false"
set_env ENABLE_PHONE_AUTOCONFIRM       "false"
set_env DISABLE_SIGNUP                 "false"
chmod 600 "$ENV_FILE"

# ---------- 5. compose override (localhost-only + pooler ports) ----------
log "Writing docker-compose.override.yml"
cat > "$BACKEND_DIR/docker-compose.override.yml" <<EOF
# Auto-generated. Binds Supabase to 127.0.0.1 only; nginx is the only public port.
# Pooler gets its own host ports so it doesn't collide with db:5432.
services:
  kong:
    ports:
      - "127.0.0.1:${KONG_HTTP_PORT}:8000/tcp"
      - "127.0.0.1:${KONG_HTTPS_PORT}:8443/tcp"
  studio:
    ports:
      - "127.0.0.1:${STUDIO_PORT}:3000/tcp"
  db:
    ports:
      - "127.0.0.1:${POSTGRES_PORT}:5432/tcp"
  supavisor:
    ports:
      - "127.0.0.1:${POOLER_DB_PORT}:5432/tcp"
      - "127.0.0.1:${POOLER_PROXY_PORT_TRANSACTION}:6543/tcp"
EOF

# ---------- 6. Free conflicting ports ----------
log "Stopping previous stack + freeing ports"
( cd "$BACKEND_DIR" && docker compose down --remove-orphans ) || true
for c in supabase-kong supabase-studio supabase-db supabase-rest \
         supabase-auth supabase-storage supabase-meta supabase-functions \
         supabase-analytics supabase-vector supabase-pooler supavisor \
         realtime-dev.supabase-realtime supabase-imgproxy supabase-edge-functions; do
  if docker ps -a --format '{{.Names}}' | grep -qx "$c"; then
    docker rm -f "$c" >/dev/null || true
  fi
done
free_port() {
  local p="$1" ids
  ids=$(docker ps -q --filter "publish=${p}" 2>/dev/null || true)
  [[ -n "$ids" ]] && docker rm -f $ids >/dev/null || true
}
for p in "$KONG_HTTP_PORT" "$KONG_HTTPS_PORT" "$STUDIO_PORT" \
         "$POSTGRES_PORT" "$POOLER_DB_PORT" "$POOLER_PROXY_PORT_TRANSACTION"; do
  free_port "$p"
done
check_port() {
  local p="$1" l="$2"
  if ss -ltn "( sport = :$p )" 2>/dev/null | tail -n +2 | grep -q .; then
    echo "ERROR: port $p ($l) still in use. Run: sudo ss -ltnp | grep :$p"
    exit 1
  fi
}
check_port "$KONG_HTTP_PORT"                "Kong HTTP"
check_port "$KONG_HTTPS_PORT"               "Kong HTTPS"
check_port "$STUDIO_PORT"                   "Studio"
check_port "$POSTGRES_PORT"                 "Postgres"
check_port "$POOLER_DB_PORT"                "Pooler session"
check_port "$POOLER_PROXY_PORT_TRANSACTION" "Pooler transaction"

# ---------- 7. Bring stack up ----------
log "Pulling images"
( cd "$BACKEND_DIR" && docker compose pull )
log "Starting Supabase stack"
( cd "$BACKEND_DIR" && docker compose up -d )

log "Waiting for Kong on 127.0.0.1:${KONG_HTTP_PORT} (up to 180s)"
ready=0
for i in $(seq 1 90); do
  if curl -sSf -o /dev/null "http://127.0.0.1:${KONG_HTTP_PORT}/"; then
    ready=1; echo "Kong is up after ${i}x2s."; break
  fi
  sleep 2
done
[[ $ready -eq 1 ]] || warn "Kong did not respond within 180s. Check: docker compose -f $BACKEND_DIR/docker-compose.yml ps"

# ---------- 8. Migrations ----------
if [[ $SKIP_MIGRATIONS -eq 0 && -d "$SOURCE_DIR/supabase/migrations" ]]; then
  log "Applying SQL migrations"
  export PGPASSWORD="$POSTGRES_PASSWORD"
  PSQL="docker exec -i -e PGPASSWORD=$POSTGRES_PASSWORD $(docker ps --filter name=supabase-db --format '{{.Names}}' | head -1) psql -U postgres -d postgres -v ON_ERROR_STOP=1"
  $PSQL -c "CREATE TABLE IF NOT EXISTS public._applied_migrations (name text primary key, applied_at timestamptz default now());"
  shopt -s nullglob
  for f in "$SOURCE_DIR"/supabase/migrations/*.sql; do
    name="$(basename "$f")"
    already=$($PSQL -tA -c "SELECT 1 FROM public._applied_migrations WHERE name='$name'")
    if [[ "$already" == "1" ]]; then
      echo "  skip $name"
    else
      echo "  apply $name"
      docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" \
        $(docker ps --filter name=supabase-db --format '{{.Names}}' | head -1) \
        psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$f"
      $PSQL -c "INSERT INTO public._applied_migrations(name) VALUES ('$name');"
    fi
  done
  shopt -u nullglob
fi

# ---------- 9. Edge functions ----------
if [[ $SKIP_FUNCTIONS -eq 0 && -d "$SOURCE_DIR/supabase/functions" ]]; then
  log "Syncing edge functions"
  mkdir -p "$BACKEND_DIR/volumes/functions"
  # Do not --delete: self-host requires the upstream/generated 'main' router.
  # Deleting it causes InvalidWorkerCreation/could not find entrypoint errors.
  rsync -a --exclude '_shared' "$SOURCE_DIR/supabase/functions/" "$BACKEND_DIR/volumes/functions/"
  if [[ -d "$SOURCE_DIR/supabase/functions/_shared" ]]; then
    rsync -a "$SOURCE_DIR/supabase/functions/_shared/" "$BACKEND_DIR/volumes/functions/_shared/"
  fi
  ensure_functions_main
  verify_function_entrypoint "main"
  verify_function_entrypoint "upload-vendor-document"
  verify_function_entrypoint "kyc-api-execute"
  ( cd "$BACKEND_DIR" && docker compose up -d --force-recreate functions ) || \
    ( cd "$BACKEND_DIR" && docker compose restart functions ) || true
fi

# ---------- 10. Frontend build ----------
if [[ $SKIP_BUILD -eq 0 ]]; then
  log "Building frontend"
  cat > "$SOURCE_DIR/.env.production" <<EOF
VITE_SUPABASE_URL=${PUBLIC_BASE_URL}/supabase
VITE_SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}
VITE_SUPABASE_PROJECT_ID=self-hosted
EOF
  ( cd "$SOURCE_DIR" && (npm ci || npm install) && npm run build )
  mkdir -p "$FRONTEND_DIR/dist"
  rsync -a --delete "$SOURCE_DIR/dist/" "$FRONTEND_DIR/dist/"
fi

# ---------- 11. Middleware ----------
if [[ $SKIP_MIDDLEWARE -eq 0 && -d "$SOURCE_DIR/middleware" ]]; then
  log "Installing middleware service"
  rsync -a --delete --exclude node_modules "$SOURCE_DIR/middleware/" "$MIDDLEWARE_DIR/"
  ( cd "$MIDDLEWARE_DIR" && (npm ci || npm install) )
  if [[ ! -f "$MIDDLEWARE_DIR/.env" ]]; then
    SHARED_SECRET="$(rand_hex 32)"
    cat > "$MIDDLEWARE_DIR/.env" <<EOF
PORT=${MIDDLEWARE_PORT}
MIDDLEWARE_SHARED_SECRET=${SHARED_SECRET}
SAP_BP_API_URL=
SAP_BP_USERNAME=
SAP_BP_PASSWORD=
EOF
    chmod 600 "$MIDDLEWARE_DIR/.env"
  fi
  cat > /etc/systemd/system/vms-middleware.service <<EOF
[Unit]
Description=VMS Middleware (SAP bridge)
After=network.target
[Service]
Type=simple
WorkingDirectory=${MIDDLEWARE_DIR}
EnvironmentFile=${MIDDLEWARE_DIR}/.env
ExecStart=/usr/bin/node ${MIDDLEWARE_DIR}/server.js
Restart=on-failure
RestartSec=5
[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now vms-middleware
  systemctl restart vms-middleware || true
fi

# ---------- 12. Nginx ----------
if [[ $SKIP_NGINX -eq 0 ]]; then
  log "Configuring nginx"
  HTPASSWD="$APP_ROOT/studio.htpasswd"
  if [[ ! -f "$HTPASSWD" ]]; then
    htpasswd -bc "$HTPASSWD" "$DASHBOARD_USERNAME" "$DASHBOARD_PASSWORD"
  fi
  cat > "$NGINX_CONF_PATH" <<EOF
# Auto-generated by setup-selfhost.sh
server {
  listen 80 default_server;
  server_name _;
  client_max_body_size 50m;

  root ${FRONTEND_DIR}/dist;
  index index.html;

  location / {
    try_files \$uri \$uri/ /index.html;
  }

  location /supabase/ {
    proxy_pass http://127.0.0.1:${KONG_HTTP_PORT}/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
  }

  location /studio/ {
    auth_basic "Supabase Studio";
    auth_basic_user_file ${HTPASSWD};
    proxy_pass http://127.0.0.1:${STUDIO_PORT}/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:${MIDDLEWARE_PORT}/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
  }
}
EOF
  rm -f /etc/nginx/sites-enabled/default
  ln -sf "$NGINX_CONF_PATH" /etc/nginx/sites-enabled/vms-selfhost.conf
  nginx -t
  systemctl reload nginx || systemctl restart nginx
fi

# ---------- 13. Firewall ----------
if command -v ufw >/dev/null 2>&1; then
  log "Configuring ufw (22 + 80)"
  ufw allow OpenSSH || ufw allow 22/tcp || true
  ufw allow 80/tcp || true
  yes | ufw enable >/dev/null 2>&1 || true
fi

# ---------- 14. Summary ----------
cat <<EOF

==============================================================================
  Self-hosted Supabase + VMS deployed
==============================================================================
  App        : ${PUBLIC_BASE_URL}/
  Supabase   : ${PUBLIC_BASE_URL}/supabase/
  Studio     : ${PUBLIC_BASE_URL}/studio/   (user: ${DASHBOARD_USERNAME})
  Studio pw  : ${DASHBOARD_PASSWORD}
  Middleware : ${PUBLIC_BASE_URL}/api/   (local :${MIDDLEWARE_PORT})

  ANON_KEY         : ${ANON_KEY}
  SERVICE_ROLE_KEY : ${SERVICE_ROLE_KEY}
  Postgres (local) : postgresql://postgres:<secret>@127.0.0.1:${POSTGRES_PORT}/postgres
  Pooler (txn)     : 127.0.0.1:${POOLER_PROXY_PORT_TRANSACTION}

  Secrets file     : ${SECRETS_FILE}  (chmod 600 — back this up)
  Compose dir      : ${BACKEND_DIR}
  Log              : ${LOG_FILE}

Next steps
  1) Open ${PUBLIC_BASE_URL}/studio/ and create the first auth user.
  2) In Studio SQL editor:
       insert into public.user_roles (user_id, role)
       values ('<auth-user-uuid>', 'sharvi_admin');
  3) Add edge-function secrets to ${ENV_FILE}, then:
       cd ${BACKEND_DIR} && docker compose restart functions
       Keys: RESEND_API_KEY, CASHFREE_CLIENT_ID, CASHFREE_CLIENT_SECRET, SAP_MIDDLEWARE_KEY
  4) Fill SAP creds in ${MIDDLEWARE_DIR}/.env, then:
       systemctl restart vms-middleware

  NOTE: Edge functions using LOVABLE_API_KEY (Lovable AI Gateway) must be
  repointed to OpenAI/Gemini with your own API key when self-hosted.
==============================================================================
EOF
