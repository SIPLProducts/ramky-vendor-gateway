#!/usr/bin/env bash
# Diagnose or repair a self-hosted Production supabase_admin password mismatch.
# Default is read-only. Pass --repair to align the database role to .env.secrets.
set -Eeuo pipefail

APP_ROOT="${APP_ROOT:-/opt/Ramky_Applications/PROD/VMS}"
BACKEND_DIR="${BACKEND_DIR:-$APP_ROOT/backend}"
COMPOSE_FILE="${COMPOSE_FILE:-$BACKEND_DIR/docker-compose.yml}"
SECRETS_FILE="$BACKEND_DIR/.env.secrets"
ENV_FILE="$BACKEND_DIR/.env"
MODE="${1:-diagnose}"

[[ $EUID -eq 0 ]] || { echo "ERROR: run with sudo." >&2; exit 1; }
[[ "$MODE" == "diagnose" || "$MODE" == "--repair" ]] || {
  echo "Usage: sudo APP_ROOT=/opt/Ramky_Applications/PROD/VMS bash $0 [--repair]" >&2
  exit 2
}
[[ -f "$COMPOSE_FILE" ]] || { echo "ERROR: compose file not found: $COMPOSE_FILE" >&2; exit 1; }
[[ -f "$SECRETS_FILE" ]] || { echo "ERROR: secrets file not found: $SECRETS_FILE" >&2; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "ERROR: backend environment file not found: $ENV_FILE" >&2; exit 1; }

read_shell_value() {
  local file="$1" key="$2"
  (
    set +u
    # shellcheck disable=SC1090
    source "$file"
    printf '%s' "${!key:-}"
  )
}

fingerprint() { printf '%s' "$1" | sha256sum | cut -c1-12; }

secret_password="$(read_shell_value "$SECRETS_FILE" POSTGRES_PASSWORD)"
env_password="$(read_shell_value "$ENV_FILE" POSTGRES_PASSWORD)"
[[ -n "$secret_password" ]] || { echo "ERROR: POSTGRES_PASSWORD is empty in .env.secrets" >&2; exit 1; }
[[ -n "$env_password" ]] || { echo "ERROR: POSTGRES_PASSWORD is empty in .env" >&2; exit 1; }

echo "Production database authentication diagnostic"
echo "  app root:            $APP_ROOT"
echo "  .env.secrets value:  $(fingerprint "$secret_password") (fingerprint)"
echo "  .env value:          $(fingerprint "$env_password") (fingerprint)"
docker compose -f "$COMPOSE_FILE" ps

if [[ "$secret_password" != "$env_password" ]]; then
  echo "ERROR: .env.secrets and .env disagree. No repair was attempted." >&2
  echo "Restore the correct Production files from backup before continuing." >&2
  exit 1
fi

if docker compose -f "$COMPOSE_FILE" exec -T -e PGPASSWORD="$secret_password" db \
     psql -h 127.0.0.1 -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c 'SELECT 1' >/dev/null 2>&1; then
  echo "  database login:      OK"
  exit 0
fi

echo "  database login:      FAILED (saved password does not match supabase_admin)"
[[ "$MODE" == "--repair" ]] || {
  echo "Run again with --repair after reviewing the fingerprints and service list."
  exit 3
}

backup_suffix="$(date +%Y%m%d-%H%M%S)"
cp -a "$SECRETS_FILE" "${SECRETS_FILE}.bak.${backup_suffix}"
cp -a "$ENV_FILE" "${ENV_FILE}.bak.${backup_suffix}"
echo "Backed up Production environment files."

escaped_password="${secret_password//\'/\'\'}"
printf "ALTER ROLE supabase_admin WITH PASSWORD '%s';\n" "$escaped_password" | \
  docker compose -f "$COMPOSE_FILE" exec -T db \
    psql -U postgres -d postgres -v ON_ERROR_STOP=1 >/dev/null

docker compose -f "$COMPOSE_FILE" exec -T -e PGPASSWORD="$secret_password" db \
  psql -h 127.0.0.1 -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c 'SELECT 1' >/dev/null
echo "Database login repaired and verified."

mapfile -t available_services < <(docker compose -f "$COMPOSE_FILE" config --services)
dependent_services=()
for wanted in meta rest auth storage realtime supavisor studio analytics vector; do
  for available in "${available_services[@]}"; do
    [[ "$available" == "$wanted" ]] && dependent_services+=("$wanted")
  done
done

if [[ ${#dependent_services[@]} -gt 0 ]]; then
  docker compose -f "$COMPOSE_FILE" up -d --force-recreate "${dependent_services[@]}"
fi

docker compose -f "$COMPOSE_FILE" exec -T -e PGPASSWORD="$secret_password" db \
  psql -h 127.0.0.1 -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c 'SELECT 1' >/dev/null
echo "Production password-dependent services were recreated; the database volume was preserved."