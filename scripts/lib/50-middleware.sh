#!/usr/bin/env bash
# 50-middleware: install node deps, write .env, systemd service
set -Eeuo pipefail

MW_SRC="${SOURCE_DIR}/middleware"
if [[ ! -d "$MW_SRC" ]]; then
  echo "No middleware dir at $MW_SRC — skipping."
  return 0 2>/dev/null || exit 0
fi

log "Syncing middleware -> $MIDDLEWARE_DIR"
rsync -a --delete --exclude node_modules --exclude .env "$MW_SRC"/ "$MIDDLEWARE_DIR"/

log "Installing middleware npm deps"
( cd "$MIDDLEWARE_DIR" && npm ci --omit=dev || npm install --omit=dev )

MW_ENV="${MIDDLEWARE_DIR}/.env"
if [[ ! -f "$MW_ENV" ]]; then
  log "Writing initial middleware .env (edit SAP_* values as needed)"
  MIDDLEWARE_SHARED_SECRET="$(openssl rand -hex 32)"
  cat > "$MW_ENV" <<EOF
PORT=${MIDDLEWARE_PORT}
MIDDLEWARE_BODY_LIMIT=500mb
MIDDLEWARE_SHARED_SECRET=${MIDDLEWARE_SHARED_SECRET}

# --- SAP endpoints (EDIT THESE) ---
SAP_BP_API_URL=http://10.200.1.2:8000/vendor/bp/create?sap-client=300
SAP_DMS_API_URL=http://10.200.1.2:8000/vendor/bp/create?sap-client=300
SAP_BP_USERNAME=replace-with-sap-username
SAP_BP_PASSWORD=replace-with-sap-password

SAP_REQUEST_TIMEOUT_MS=30000
SAP_CONNECT_TIMEOUT_MS=60000
SAP_HEADERS_TIMEOUT_MS=60000
SAP_BODY_TIMEOUT_MS=60000

CORS_ORIGINS=*
ALLOW_INSECURE_TLS=0
EOF
  chmod 600 "$MW_ENV"
  export MIDDLEWARE_SHARED_SECRET_GENERATED="$MIDDLEWARE_SHARED_SECRET"
else
  echo "Existing middleware .env preserved."
fi

log "Installing vms-middleware systemd unit"
install -m 0644 "${TEMPLATES_DIR}/vms-middleware.service" /etc/systemd/system/vms-middleware.service
# Patch WorkingDirectory + EnvironmentFile to real paths
sed -i "s|__WORKDIR__|${MIDDLEWARE_DIR}|g; s|__ENVFILE__|${MW_ENV}|g" \
  /etc/systemd/system/vms-middleware.service

systemctl daemon-reload
systemctl enable vms-middleware
systemctl restart vms-middleware
sleep 2
systemctl --no-pager --full status vms-middleware | head -n 15 || true
