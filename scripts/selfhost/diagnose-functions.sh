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
check_file "$FN_DST/fetch-tenants-from-sap/index.ts"
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
echo ">> KYC/OCR database readiness"
if [[ -f "$COMPOSE_FILE" ]]; then
  provider_count=$(docker compose -f "$COMPOSE_FILE" exec -T db \
    psql -U supabase_admin -d postgres -tAc \
    "SELECT count(*) FROM public.api_providers WHERE provider_name IN ('GST_OCR','PAN_OCR','BANK_OCR') AND is_enabled IS TRUE" \
    2>/dev/null | tr -d '[:space:]') || provider_count="query_failed"
  if [[ "$provider_count" == "3" ]]; then
    echo "OK   GST_OCR, PAN_OCR, and BANK_OCR are enabled"
  else
    echo "FAIL enabled OCR provider count=$provider_count (expected 3)"
    status=1
  fi

  grant_count=$(docker compose -f "$COMPOSE_FILE" exec -T db \
    psql -U supabase_admin -d postgres -tAc \
    "SELECT count(*) FROM (VALUES ('api_providers'),('api_credentials')) AS required(table_name) WHERE has_table_privilege('service_role', format('public.%I', table_name), 'SELECT')" \
    2>/dev/null | tr -d '[:space:]') || grant_count="query_failed"
  if [[ "$grant_count" == "2" ]]; then
    echo "OK   service_role can read KYC provider settings and credentials"
  else
    echo "FAIL service_role KYC SELECT grant count=$grant_count (expected 2)"
    status=1
  fi
fi

echo ""
echo ">> Functions container KYC environment (values are not printed)"
if [[ -f "$COMPOSE_FILE" ]]; then
  docker compose -f "$COMPOSE_FILE" exec -T functions sh -lc '
    if [ -n "$SUPABASE_URL" ]; then echo "OK   SUPABASE_URL is present"; else echo "FAIL SUPABASE_URL is missing"; exit 1; fi
    if [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then echo "OK   SUPABASE_SERVICE_ROLE_KEY is present"; else echo "FAIL SUPABASE_SERVICE_ROLE_KEY is missing"; exit 1; fi
    parts=$(printf "%s" "$SUPABASE_SERVICE_ROLE_KEY" | awk -F. "{print NF}")
    if [ "$parts" = "3" ]; then echo "OK   service-role credential has three JWT segments"; else echo "FAIL service-role credential JWT segment count=$parts (expected 3)"; exit 1; fi
  ' || status=1
fi

echo ""
echo ">> Files visible inside functions container"
if [[ -f "$COMPOSE_FILE" ]]; then
  docker compose -f "$COMPOSE_FILE" exec -T functions sh -lc '
    for f in \
      /home/deno/functions/main/index.ts \
      /home/deno/functions/upload-vendor-document/index.ts \
      /home/deno/functions/kyc-api-execute/index.ts \
      /home/deno/functions/fetch-tenants-from-sap/index.ts \
      /home/deno/functions/_shared/auth.ts
    do
      if [ -f "$f" ]; then echo "OK   $f"; else echo "MISS $f"; fi
    done
    echo "-- /home/deno/functions --"
    ls -la /home/deno/functions
  ' || status=1
fi

echo ""
echo ">> Worker boot / parse errors in recent logs"
if [[ -f "$COMPOSE_FILE" ]]; then
  if docker compose -f "$COMPOSE_FILE" logs --tail=300 functions 2>/dev/null | \
       grep -E 'InvalidWorkerCreation|could not be parsed|Expression expected|failed to bootstrap runtime'; then
    echo "-> A function failed to boot because its source could not be parsed."
    echo "   Fix the file named in the error, then redeploy with scripts/selfhost/deploy-latest.sh."
    status=1
  else
    echo "No worker boot/parse errors found in the last 300 log lines."
  fi
fi

echo ""
echo ">> Recent functions logs"
if [[ -f "$COMPOSE_FILE" ]]; then
  docker compose -f "$COMPOSE_FILE" logs --tail=120 functions | \
    grep -E 'main function|serving the request|InvalidWorkerCreation|entrypoint|upload-vendor-document|kyc-api-execute|fetch-tenants-from-sap' || true
fi


echo ""
if [[ $status -eq 0 ]]; then
  echo "Diagnostics completed: function files and KYC/OCR prerequisites are ready."
else
  echo "Diagnostics found a function or KYC/OCR readiness problem. Review FAIL messages before redeploying."
fi
exit "$status"