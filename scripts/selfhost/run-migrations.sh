#!/usr/bin/env bash
# =============================================================================
# VMS — Self-hosted migration runner (fixed)
#
# Fixes:
#   - "must be owner of function update_updated_at_column" by re-creating the
#     function as `supabase_admin` (the role that owns the public schema in
#     the official Supabase docker stack) BEFORE applying any migration.
#   - Runs every migration as `supabase_admin` so it can ALTER/REPLACE objects
#     created by previous installer runs.
#   - Stops on first failure (ON_ERROR_STOP=1) instead of silently skipping.
#   - Reloads PostgREST schema cache at the end.
#
# Place this file at:
#   /opt/Ramky_Applications/DEV/VMS/run-migrations.sh
# Migrations folder:
#   /opt/Ramky_Applications/DEV/VMS/backend/migrations/
#
# Run:
#   sudo bash /opt/Ramky_Applications/DEV/VMS/run-migrations.sh
# =============================================================================
set -Eeuo pipefail

APP_ROOT="${APP_ROOT:-/opt/Ramky_Applications/DEV/VMS}"
BACKEND_DIR="${BACKEND_DIR:-$APP_ROOT/backend}"
MIG_DIR="${MIG_DIR:-$BACKEND_DIR/migrations}"
LOG_DIR="${LOG_DIR:-$APP_ROOT/logs}"
COMPOSE_FILE="${COMPOSE_FILE:-$BACKEND_DIR/docker-compose.yml}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_NAME="${DB_NAME:-postgres}"
# Use supabase_admin — it owns public schema objects created by the supabase
# bootstrap. `postgres` is the superuser but is NOT the owner of these
# functions, hence the "must be owner" error you saw.
DB_USER="${DB_USER:-supabase_admin}"

mkdir -p "$LOG_DIR" "$MIG_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="$LOG_DIR/migrations-$TS.log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "============================================================"
echo " VMS migration run   $(date -Is)"
echo " Migrations dir : $MIG_DIR"
echo " DB user        : $DB_USER"
echo " Log file       : $LOG_FILE"
echo "============================================================"

PSQL=(docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE"
      psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1)

# ---- 0. Sanity: db container reachable ----
if ! "${PSQL[@]}" -c "SELECT 1" >/dev/null; then
  echo "ERROR: cannot reach Postgres via docker compose ($DB_SERVICE)."
  echo "       Try: cd $BACKEND_DIR && docker compose ps"
  exit 1
fi

# ---- 1. Tracking table ----
"${PSQL[@]}" <<'SQL'
CREATE TABLE IF NOT EXISTS public._vms_migrations (
  filename     text PRIMARY KEY,
  applied_at   timestamptz NOT NULL DEFAULT now()
);
SQL

# ---- 2. Ownership / search_path repair for update_updated_at_column ----
# Re-create as the migration role so subsequent CREATE OR REPLACE succeeds.
echo ">> Repairing public.update_updated_at_column ownership"
"${PSQL[@]}" <<'SQL'
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
-- Make sure the migration role owns it from now on.
ALTER FUNCTION public.update_updated_at_column() OWNER TO supabase_admin;
SQL

# ---- 3. Apply migrations in sorted order ----
shopt -s nullglob
applied=0; skipped=0; failed=0
for f in $(ls -1 "$MIG_DIR"/*.sql 2>/dev/null | sort); do
  fname="$(basename "$f")"
  already=$("${PSQL[@]}" -tAc \
    "SELECT 1 FROM public._vms_migrations WHERE filename='${fname}'" \
    2>/dev/null | tr -d '[:space:]')
  if [[ "$already" == "1" ]]; then
    echo "-- skip   $fname (already applied)"
    skipped=$((skipped+1))
    continue
  fi
  echo ">> apply  $fname"
  if "${PSQL[@]}" < "$f"; then
    "${PSQL[@]}" -c \
      "INSERT INTO public._vms_migrations(filename) VALUES ('${fname}') ON CONFLICT DO NOTHING" \
      >/dev/null
    applied=$((applied+1))
  else
    echo "!! FAILED $fname"
    failed=$((failed+1))
    break
  fi
done

# ---- 4. Reload PostgREST schema cache ----
echo ">> NOTIFY pgrst, 'reload schema'"
"${PSQL[@]}" -c "NOTIFY pgrst, 'reload schema';" || true

echo "------------------------------------------------------------"
echo " Migrations: applied=$applied  skipped=$skipped  failed=$failed"
echo "------------------------------------------------------------"
[[ $failed -eq 0 ]] || exit 1
