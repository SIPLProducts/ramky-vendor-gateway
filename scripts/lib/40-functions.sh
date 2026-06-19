#!/usr/bin/env bash
# 40-functions: sync edge functions and restart container
set -Eeuo pipefail

FN_SRC="${SOURCE_DIR}/supabase/functions"
FN_DST="${BACKEND_DIR}/volumes/functions"

if [[ ! -d "$FN_SRC" ]]; then
  echo "No functions dir at $FN_SRC — skipping."
  return 0 2>/dev/null || exit 0
fi

log "Syncing edge functions $FN_SRC -> $FN_DST"
mkdir -p "$FN_DST"
# Keep upstream's "main" / shared dirs intact; sync user functions over top
rsync -a --exclude '_shared' "$FN_SRC"/ "$FN_DST"/
# Also sync _shared if present (used by some functions)
if [[ -d "$FN_SRC/_shared" ]]; then
  rsync -a "$FN_SRC/_shared/" "$FN_DST/_shared/"
fi

ls -1 "$FN_DST" | sed 's/^/  fn: /' || true

# --- Raise edge-runtime supervisor limits so long SAP calls (~35s+) don't
# get killed with "WorkerRequestCancelled: request has been cancelled by
# supervisor". Default wall-clock limit in self-hosted edge-runtime is 60s.
# Our in-code AbortController caps at 110s, so the supervisor must allow
# at least 120s.
OVERRIDE_FILE="${BACKEND_DIR}/docker-compose.override.yml"
log "Writing edge-runtime limit overrides -> $OVERRIDE_FILE"
cat > "$OVERRIDE_FILE" <<'YAML'
# Auto-managed by scripts/lib/40-functions.sh — edits will be overwritten.
# Raises the Supabase edge-runtime per-worker wall-clock / CPU limits so
# long-running SAP integration calls aren't cancelled by the supervisor.
services:
  functions:
    environment:
      EDGE_RUNTIME_WORKER_REQUEST_WALL_CLOCK_LIMIT_MS: "120000"
      EDGE_RUNTIME_WORKER_REQUEST_CPU_TIME_SOFT_LIMIT_MS: "120000"
      EDGE_RUNTIME_WORKER_REQUEST_CPU_TIME_HARD_LIMIT_MS: "120000"
    command:
      - "edge-runtime"
      - "start"
      - "--main-service"
      - "/home/deno/functions/main"
      - "--worker-request-wall-clock-limit-ms"
      - "120000"
      - "--worker-request-cpu-time-soft-limit-ms"
      - "120000"
      - "--worker-request-cpu-time-hard-limit-ms"
      - "120000"
YAML

log "Recreating functions container with new limits"
docker compose -f "$BACKEND_DIR/docker-compose.yml" -f "$OVERRIDE_FILE" up -d functions || \
  docker compose -f "$BACKEND_DIR/docker-compose.yml" restart functions || true
