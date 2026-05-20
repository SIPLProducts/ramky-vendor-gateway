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

log "Restarting functions container"
docker compose -f "$BACKEND_DIR/docker-compose.yml" restart functions || true
