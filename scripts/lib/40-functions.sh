#!/usr/bin/env bash
# 40-functions: sync edge functions and restart container
set -Eeuo pipefail

FN_SRC="${SOURCE_DIR}/supabase/functions"
FN_DST="${BACKEND_DIR}/volumes/functions"

ensure_functions_main() {
  mkdir -p "$FN_DST/main"
  if [[ -f "$FN_DST/main/index.ts" ]]; then
    echo "  self-host function router found"
    return 0
  fi

  echo "  self-host function router missing; creating $FN_DST/main/index.ts"
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
    echo "  $name entrypoint found"
  else
    echo "ERROR: $name/index.ts missing from deployed functions at $FN_DST" >&2
    echo "Expected: $FN_DST/$name/index.ts" >&2
    echo "Current deployed function folders:" >&2
    ls -la "$FN_DST" >&2 || true
    exit 1
  fi
}

if [[ ! -d "$FN_SRC" ]]; then
  echo "No functions dir at $FN_SRC — skipping."
  return 0 2>/dev/null || exit 0
fi

log "Syncing edge functions $FN_SRC -> $FN_DST"
mkdir -p "$FN_DST"
# Keep upstream/generated "main" router intact; deleting it makes self-host
# edge-runtime unable to route functions and causes InvalidWorkerCreation.
rsync -a --exclude '_shared' "$FN_SRC"/ "$FN_DST"/
# Also sync _shared if present (used by some functions)
if [[ -d "$FN_SRC/_shared" ]]; then
  rsync -a "$FN_SRC/_shared/" "$FN_DST/_shared/"
fi

ensure_functions_main
verify_function_entrypoint "main"
verify_function_entrypoint "upload-vendor-document"
verify_function_entrypoint "kyc-api-execute"
verify_function_entrypoint "log-login-attempt"

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
