#!/usr/bin/env bash
# Safe diagnostics for self-host edge function boot errors.
# Prints no secrets. Use APP_ROOT=/opt/Ramky_Applications/PROD/VMS if needed.
set -Eeuo pipefail

if [[ -z "${APP_ROOT:-}" ]]; then
  if [[ -f /opt/Ramky_Applications/PROD/VMS/backend/docker-compose.yml ]]; then
    APP_ROOT=/opt/Ramky_Applications/PROD/VMS
  elif [[ -f /opt/Ramky_Applications/DEV/VMS/backend/docker-compose.yml ]]; then
    APP_ROOT=/opt/Ramky_Applications/DEV/VMS
  else
    APP_ROOT="$(pwd)"
  fi
fi

BACKEND_DIR="${BACKEND_DIR:-$APP_ROOT/backend}"
FN_DST="${FN_DST:-$BACKEND_DIR/volumes/functions}"
COMPOSE_FILE="${COMPOSE_FILE:-$BACKEND_DIR/docker-compose.yml}"

echo "=========================================================="
echo " VMS edge function diagnostics"
echo " App root     : $APP_ROOT"
echo " Backend dir  : $BACKEND_DIR"
echo " Functions dir: $FN_DST"
echo "=========================================================="

status=0
check_file() {
  local path="$1"
  if [[ -f "$path" ]]; then
    echo "OK   $path"
  else
    echo "MISS $path"
    status=1
  fi
}

echo ""
echo ">> Host function files"
check_file "$FN_DST/main/index.ts"
check_file "$FN_DST/upload-vendor-document/index.ts"
check_file "$FN_DST/kyc-api-execute/index.ts"
check_file "$FN_DST/_shared/auth.ts"

echo ""
echo ">> Function folders on host"
ls -la "$FN_DST" 2>/dev/null | sed 's/^/  /' || { echo "Cannot list $FN_DST"; status=1; }

echo ""
echo ">> Containers"
if [[ -f "$COMPOSE_FILE" ]]; then
  docker compose -f "$COMPOSE_FILE" ps functions || status=1
else
  echo "MISS $COMPOSE_FILE"
  status=1
fi

echo ""
echo ">> Files visible inside functions container"
if [[ -f "$COMPOSE_FILE" ]]; then
  docker compose -f "$COMPOSE_FILE" exec -T functions sh -lc '
    for f in \
      /home/deno/functions/main/index.ts \
      /home/deno/functions/upload-vendor-document/index.ts \
      /home/deno/functions/kyc-api-execute/index.ts \
      /home/deno/functions/_shared/auth.ts
    do
      if [ -f "$f" ]; then echo "OK   $f"; else echo "MISS $f"; fi
    done
    echo "-- /home/deno/functions --"
    ls -la /home/deno/functions
  ' || status=1
fi

echo ""
echo ">> Recent functions logs"
if [[ -f "$COMPOSE_FILE" ]]; then
  docker compose -f "$COMPOSE_FILE" logs --tail=120 functions | \
    grep -E 'main function|serving the request|InvalidWorkerCreation|entrypoint|upload-vendor-document|kyc-api-execute' || true
fi

echo ""
if [[ $status -eq 0 ]]; then
  echo "Diagnostics completed: required entrypoint files are present."
else
  echo "Diagnostics found missing function entrypoint files. Redeploy with scripts/selfhost/deploy-latest.sh."
fi
exit "$status"