#!/usr/bin/env bash
# 00-preflight: root + OS check, dirs, log file
set -Eeuo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Must run as root (use sudo)." >&2; exit 1
fi
if ! grep -qi ubuntu /etc/os-release; then
  echo "This script targets Ubuntu." >&2; exit 1
fi

mkdir -p "$APP_ROOT" "$BACKEND_DIR" "$FRONTEND_DIR" "$MIDDLEWARE_DIR" \
         "$SUPABASE_SRC_DIR" "$LOGS_DIR" "${APP_ROOT}/uploads" "${APP_ROOT}/ssl"
touch "$LOG_FILE"

# Tee everything from now on to the log
exec > >(tee -a "$LOG_FILE") 2>&1

log "Preflight"
echo "Host IP:        $HOST_IP"
echo "App root:       $APP_ROOT"
echo "Source repo:    $SOURCE_DIR"
echo "Nginx conf:     $NGINX_CONF_PATH"
echo "Log file:       $LOG_FILE"
echo "Flags: docker=$([[ $SKIP_DOCKER -eq 1 ]] && echo skip || echo run) \
build=$([[ $SKIP_BUILD -eq 1 ]] && echo skip || echo run) \
migrations=$([[ $SKIP_MIGRATIONS -eq 1 ]] && echo skip || echo run) \
functions=$([[ $SKIP_FUNCTIONS -eq 1 ]] && echo skip || echo run) \
nginx=$([[ $SKIP_NGINX -eq 1 ]] && echo skip || echo run) \
middleware=$([[ $SKIP_MIDDLEWARE -eq 1 ]] && echo skip || echo run) \
reset_secrets=$([[ $RESET_SECRETS -eq 1 ]] && echo yes || echo no)"
