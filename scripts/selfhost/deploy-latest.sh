#!/usr/bin/env bash
# =============================================================================
# VMS — Self-hosted: sync latest code from a checked-out repo into the running
# server, apply any new migrations, redeploy edge functions, redeploy the
# frontend bundle, reload PostgREST, and reload nginx.
#
# Run from the directory that contains the latest repo (where supabase/,
# middleware/, src/, package.json live), OR set SOURCE_DIR=/path/to/repo.
#
#   cd /path/to/checked-out-repo
#   sudo bash scripts/selfhost/deploy-latest.sh
#
# Flags:
#   --skip-build       reuse existing dist/ (don't run npm run build)
#   --skip-migrations  don't copy/apply new migrations
#   --skip-functions   don't sync edge functions
#   --skip-frontend    don't redeploy dist/ to nginx root
# =============================================================================
set -Eeuo pipefail

APP_ROOT="${APP_ROOT:-/opt/Ramky_Applications/DEV/VMS}"
BACKEND_DIR="${BACKEND_DIR:-$APP_ROOT/backend}"
FRONTEND_DIR="${FRONTEND_DIR:-$APP_ROOT/frontend}"
MIG_DIR="${MIG_DIR:-$BACKEND_DIR/migrations}"
FN_DST="${FN_DST:-$BACKEND_DIR/volumes/functions}"
SOURCE_DIR="${SOURCE_DIR:-$(pwd)}"
COMPOSE_FILE="$BACKEND_DIR/docker-compose.yml"

SKIP_BUILD=0; SKIP_MIG=0; SKIP_FN=0; SKIP_FE=0
for a in "$@"; do
  case "$a" in
    --skip-build)      SKIP_BUILD=1 ;;
    --skip-migrations) SKIP_MIG=1 ;;
    --skip-functions)  SKIP_FN=1 ;;
    --skip-frontend)   SKIP_FE=1 ;;
    *) echo "Unknown flag: $a"; exit 2 ;;
  esac
done

[[ $EUID -eq 0 ]] || { echo "Run with sudo."; exit 1; }
[[ -d "$SOURCE_DIR/supabase" ]] || { echo "SOURCE_DIR=$SOURCE_DIR has no supabase/ folder."; exit 1; }

ensure_functions_main() {
  mkdir -p "$FN_DST/main"
  if [[ -f "$FN_DST/main/index.ts" ]]; then
    echo "   self-host function router found"
    return 0
  fi

  echo "   self-host function router missing; creating $FN_DST/main/index.ts"
  cat > "$FN_DST/main/index.ts" <<'TS'
console.log('main function router started')

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  const pathParts = url.pathname.split('/')
  const serviceName = pathParts[1]

  if (!serviceName) {
    return new Response(JSON.stringify({ msg: 'missing function name in request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const servicePath = `/home/deno/functions/${serviceName}`
  console.error(`serving the request with ${servicePath}`)

  try {
    const worker = await EdgeRuntime.userWorkers.create({
      servicePath,
      memoryLimitMb: 150,
      workerTimeoutMs: 120000,
      noModuleCache: false,
      importMapPath: null,
      envVars: Object.entries(Deno.env.toObject()),
    })
    return await worker.fetch(req)
  } catch (e) {
    return new Response(JSON.stringify({ msg: e instanceof Error ? e.toString() : String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
TS
}

verify_function_entrypoint() {
  local name="$1"
  if [[ -f "$FN_DST/$name/index.ts" ]]; then
    echo "   $name entrypoint found"
  else
    echo "ERROR: $name/index.ts missing from deployed functions at $FN_DST" >&2
    echo "Expected: $FN_DST/$name/index.ts" >&2
    echo "Current deployed function folders:" >&2
    ls -la "$FN_DST" >&2 || true
    exit 1
  fi
}

echo "=========================================================="
echo " VMS self-host deploy   $(date -Is)"
echo " Source repo : $SOURCE_DIR"
echo " App root    : $APP_ROOT"
echo "=========================================================="

# ---------- 1. Migrations ----------
if [[ $SKIP_MIG -eq 0 && -d "$SOURCE_DIR/supabase/migrations" ]]; then
  echo ">> Syncing SQL migrations -> $MIG_DIR"
  mkdir -p "$MIG_DIR"
  rsync -a --delete "$SOURCE_DIR/supabase/migrations/" "$MIG_DIR/"

  RUNNER="$APP_ROOT/run-migrations.sh"
  if [[ ! -f "$RUNNER" ]]; then
    # Fall back to the runner shipped with the repo
    cp -f "$SOURCE_DIR/scripts/selfhost/run-migrations.sh" "$RUNNER"
    chmod +x "$RUNNER"
  fi
  bash "$RUNNER"
fi

# ---------- 2. Edge functions ----------
if [[ $SKIP_FN -eq 0 && -d "$SOURCE_DIR/supabase/functions" ]]; then
  echo ">> Syncing edge functions -> $FN_DST"
  mkdir -p "$FN_DST"
  # Do not --delete: self-host requires the upstream/generated 'main' router.
  # Deleting it causes InvalidWorkerCreation/could not find entrypoint errors.
  rsync -a --exclude '_shared' "$SOURCE_DIR/supabase/functions/" "$FN_DST/"
  if [[ -d "$SOURCE_DIR/supabase/functions/_shared" ]]; then
    rsync -a "$SOURCE_DIR/supabase/functions/_shared/" "$FN_DST/_shared/"
  fi
  echo ">> Verifying self-host function router and critical functions"
  ensure_functions_main
  verify_function_entrypoint "main"
  verify_function_entrypoint "upload-vendor-document"
  verify_function_entrypoint "kyc-api-execute"
  verify_function_entrypoint "log-login-attempt"
  echo ">> Verifying WHOLDTAX final-boundary fix in deployed functions"
  grep -R "wholdtax-final-boundary-v2" "$FN_DST/sync-vendor-to-sap" "$FN_DST/sync-vendors-to-sap-bulk" >/dev/null \
    && echo "   WHOLDTAX fix marker found" \
    || { echo "ERROR: WHOLDTAX fix marker missing from deployed functions"; exit 1; }
  echo ">> Recreating functions container so edge-runtime reloads function entrypoints"
  docker compose -f "$COMPOSE_FILE" up -d --force-recreate functions || docker compose -f "$COMPOSE_FILE" restart functions
fi

# ---------- 3. Frontend ----------
if [[ $SKIP_FE -eq 0 ]]; then
  if [[ $SKIP_BUILD -eq 0 ]]; then
    echo ">> Building frontend in $SOURCE_DIR"
    ( cd "$SOURCE_DIR" && (npm ci || npm install) && npm run build )
  fi
  if [[ -d "$SOURCE_DIR/dist" ]]; then
    echo ">> Deploying dist/ -> $FRONTEND_DIR/dist/"
    mkdir -p "$FRONTEND_DIR/dist"
    rsync -a --delete "$SOURCE_DIR/dist/" "$FRONTEND_DIR/dist/"
  else
    echo "WARNING: no dist/ found in $SOURCE_DIR — skipping frontend deploy"
  fi
  # Bust browser cache by reloading nginx (and the new index.html hashes
  # already force fresh JS/CSS).
  nginx -t && systemctl reload nginx || true
fi

# ---------- 4. Re-seed approval progress for stuck submitted vendors ----------
# Heals (a) vendors in *_review with no progress rows, and (b) vendors in
# *_review with a buyer invitation but no BUYER stage row (created by the
# old pre-BUYER-stage seed function). seed_vendor_approval_progress() does
# DELETE+INSERT, so re-running it on case (b) safely rebuilds the chain
# starting with the BUYER row so the buyer screen shows the vendor.
echo ">> Re-seeding approval progress for stuck submitted vendors"
docker compose -f "$COMPOSE_FILE" exec -T db \
  psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE v record;
BEGIN
  FOR v IN
    SELECT ven.id
    FROM public.vendors ven
    WHERE ven.status::text IN (
      'buyer_review','scm_manager_review','scm_head_review',
      'finance_1_review','finance_2_review','ceo_office_review'
    )
      AND (
        NOT EXISTS (
          SELECT 1 FROM public.vendor_approval_progress p WHERE p.vendor_id = ven.id
        )
        OR (
          EXISTS (SELECT 1 FROM public.vendor_invitations vi WHERE vi.vendor_id = ven.id)
          AND NOT EXISTS (
            SELECT 1 FROM public.vendor_approval_progress p
            WHERE p.vendor_id = ven.id AND p.stage = 'BUYER'
          )
        )
      )
  LOOP
    PERFORM public.seed_vendor_approval_progress(v.id);
    RAISE NOTICE 'Re-seeded approval chain for vendor %', v.id;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
SQL

echo ""
echo "Done. Verify with:"
echo "  curl -I ${PUBLIC_BASE_URL:-http://${HOST_IP:-127.0.0.1}}/"
echo "  docker compose -f $COMPOSE_FILE logs -f functions"
