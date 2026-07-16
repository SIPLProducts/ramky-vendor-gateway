#!/usr/bin/env bash
# 70-nginx: edit /opt/Ramky_Applications/nginx/ramky-vms.conf in place
set -Eeuo pipefail

log "Configuring nginx vhost at $NGINX_CONF_PATH"

# Pull dashboard creds for studio basic-auth
if [[ -z "${DASHBOARD_USERNAME:-}" || -z "${DASHBOARD_PASSWORD:-}" ]]; then
  # shellcheck disable=SC1090
  source "$BACKEND_DIR/.env.secrets"
fi

HTPASSWD_FILE="/etc/nginx/.vms-studio.htpasswd"
htpasswd -bc "$HTPASSWD_FILE" "$DASHBOARD_USERNAME" "$DASHBOARD_PASSWORD" >/dev/null
chmod 640 "$HTPASSWD_FILE"
chown root:www-data "$HTPASSWD_FILE" 2>/dev/null || true

# Preserve existing server_name if present, otherwise default
SERVER_NAME="dev-vms.ramky.com ${HOST_IP} localhost"
if [[ -f "$NGINX_CONF_PATH" ]]; then
  cp -f "$NGINX_CONF_PATH" "${NGINX_CONF_PATH}.bak.$(date +%s)"
  existing=$(grep -E '^\s*server_name' "$NGINX_CONF_PATH" | head -n1 | sed -E 's/^\s*server_name\s+//; s/;\s*$//')
  [[ -n "$existing" ]] && SERVER_NAME="$existing"
fi

mkdir -p "$(dirname "$NGINX_CONF_PATH")"
cat > "$NGINX_CONF_PATH" <<EOF
# Auto-managed by deploy-vms-server.sh — edits will be overwritten on next run.
server {
    listen 80;
    server_name ${SERVER_NAME};

    root ${FRONTEND_DIR}/dist;
    index index.html;

    # Do not cap request body size in nginx; DMS uploads are processed
    # document-by-document by the application, while upstream systems may
    # still enforce their own physical limits.
    client_max_body_size 0;

    access_log ${LOGS_DIR}/access.log;
    error_log  ${LOGS_DIR}/error.log;

    # ---- Frontend SPA ----
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # ---- SAP middleware (Node, :${MIDDLEWARE_PORT}) ----
    location /api/ {
        proxy_pass http://127.0.0.1:${MIDDLEWARE_PORT}/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        proxy_connect_timeout 120s;
    }

    # ---- Supabase Kong gateway (REST, Auth, Storage, Realtime, Functions) ----
    location /supabase/ {
        proxy_pass http://127.0.0.1:${KONG_HTTP_PORT}/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        proxy_connect_timeout 120s;
    }

    # ---- Supabase Studio (admin UI, basic-auth protected) ----
    location /studio/ {
        auth_basic           "Supabase Studio";
        auth_basic_user_file ${HTPASSWD_FILE};
        proxy_pass http://127.0.0.1:${STUDIO_PORT}/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # ---- Uploads ----
    location /uploads/ {
        alias ${APP_ROOT}/uploads/;
        autoindex off;
    }

    location ~ /\\. {
        deny all;
    }
}
EOF

# Link into sites-enabled
SITES_ENABLED="/etc/nginx/sites-enabled/ramky-vms.conf"
ln -sf "$NGINX_CONF_PATH" "$SITES_ENABLED"
[[ -L /etc/nginx/sites-enabled/default ]] && rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl reload nginx
echo "Nginx reloaded."
