#!/usr/bin/env bash
# 30-migrations: apply SQL migrations from SOURCE_DIR/supabase/migrations
set -Eeuo pipefail

MIG_SRC="${SOURCE_DIR}/supabase/migrations"
if [[ ! -d "$MIG_SRC" ]]; then
  echo "No migrations dir at $MIG_SRC — skipping."
  return 0 2>/dev/null || exit 0
fi

log "Applying SQL migrations from $MIG_SRC"

# Ensure tracking table
docker compose -f "$BACKEND_DIR/docker-compose.yml" exec -T db \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS public._applied_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

applied=0; skipped=0; failed=0
shopt -s nullglob
for f in $(ls -1 "$MIG_SRC"/*.sql 2>/dev/null | sort); do
  fname="$(basename "$f")"
  already=$(docker compose -f "$BACKEND_DIR/docker-compose.yml" exec -T db \
    psql -U postgres -d postgres -tAc \
    "SELECT 1 FROM public._applied_migrations WHERE filename='${fname}'" 2>/dev/null | tr -d '[:space:]')
  if [[ "$already" == "1" ]]; then
    skipped=$((skipped+1)); continue
  fi
  echo "  applying $fname"
  if docker compose -f "$BACKEND_DIR/docker-compose.yml" exec -T db \
       psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$f" >/dev/null; then
    docker compose -f "$BACKEND_DIR/docker-compose.yml" exec -T db \
      psql -U postgres -d postgres -c \
      "INSERT INTO public._applied_migrations(filename) VALUES ('${fname}') ON CONFLICT DO NOTHING" >/dev/null
    applied=$((applied+1))
  else
    echo "    FAILED: $fname"
    failed=$((failed+1))
  fi
done
echo "Migrations: applied=$applied skipped=$skipped failed=$failed"
[[ $failed -eq 0 ]] || { echo "Stopping: migration failures."; exit 1; }

# PostgREST caches the database schema. Refresh it after every successful
# migration run so newly-created tables are immediately available via REST.
docker compose -f "$BACKEND_DIR/docker-compose.yml" exec -T db \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "NOTIFY pgrst, 'reload schema';" >/dev/null
echo "PostgREST schema cache reload requested."
