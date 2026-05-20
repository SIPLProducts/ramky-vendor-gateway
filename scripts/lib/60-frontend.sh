#!/usr/bin/env bash
# 60-frontend: write .env.production, build, copy to nginx root
set -Eeuo pipefail

log "Building frontend"

FE_SRC="$SOURCE_DIR"  # repo root = vite project
[[ -f "$FE_SRC/package.json" ]] || { echo "No package.json at $FE_SRC"; exit 1; }

# Pull ANON_KEY from secrets if not in env (e.g. re-run with --skip-supabase later)
if [[ -z "${ANON_KEY:-}" && -f "$BACKEND_DIR/.env.secrets" ]]; then
  # shellcheck disable=SC1090
  source "$BACKEND_DIR/.env.secrets"
fi

cat > "$FE_SRC/.env.production" <<EOF
VITE_SUPABASE_URL=${PUBLIC_BASE_URL}/supabase
VITE_SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}
VITE_SUPABASE_PROJECT_ID=self-hosted
EOF

log "Installing frontend npm deps"
( cd "$FE_SRC" && npm ci || npm install )

log "Running npm run build"
( cd "$FE_SRC" && npm run build )

log "Deploying dist/ -> $FRONTEND_DIR/dist/"
mkdir -p "$FRONTEND_DIR/dist"
rsync -a --delete "$FE_SRC/dist/" "$FRONTEND_DIR/dist/"
