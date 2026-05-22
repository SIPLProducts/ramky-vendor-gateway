## Problem

`./deploy-vms-server.sh` fails at the "Start Supabase stack" step:

```
failed to bind host port 127.0.0.1:8000/tcp: address already in use
```

Port `8000` (Kong) is already bound on the host because a previous run of the script left the Supabase containers (or an orphan `supabase-kong`) running. The current script in `scripts/lib/20-supabase.sh` jumps straight to `docker compose up -d` without first stopping anything that's already there, so re-runs hit this conflict. Ports `3000` (Studio) and `5432` (Postgres) can hit the same issue.

## Fix (only `scripts/lib/20-supabase.sh`)

Before `docker compose pull` / `up -d`, add a "clean previous stack" step that:

1. Runs `docker compose down --remove-orphans` in `$BACKEND_DIR` (safe no-op on first run, releases ports on re-runs). Volumes are preserved — no data loss.
2. Force-removes any stray containers named `supabase-kong`, `supabase-studio`, `supabase-db`, `supabase-rest`, `supabase-auth`, `supabase-storage`, `supabase-meta`, `supabase-functions`, `realtime-dev.supabase-realtime`, `supabase-analytics`, `supabase-vector`, `supabase-pooler` (covers the case where compose project name changed between runs and `down` doesn't see them).
3. For each of `KONG_HTTP_PORT (8000)`, `KONG_HTTPS_PORT (8443)`, `STUDIO_PORT (3000)`, `POSTGRES_PORT (5432)`:
   - Check with `ss -ltnp` whether `127.0.0.1:<port>` is still bound.
   - If still bound by a non-Docker process, abort with a clear message naming the process so the user can free it.
   - If free, continue.
4. Then run the existing `docker compose pull` and `docker compose up -d`.

Also add a small `--force-recreate` flag (optional, default off via env) — not strictly needed for this bug; the `down` step is enough. Skipping to keep the change minimal.

No changes to secrets, `.env`, override file, migrations, functions, middleware, frontend, or nginx steps. No data loss: `down` without `-v` keeps volumes.

## Technical detail

Patch location: `scripts/lib/20-supabase.sh`, immediately before the existing `log "Pulling images"` block.

```bash
log "Stopping any previous Supabase stack (safe on first run)"
( cd "$BACKEND_DIR" && docker compose down --remove-orphans ) || true

# Belt-and-braces: remove stray containers from older compose project names
for c in supabase-kong supabase-studio supabase-db supabase-rest \
         supabase-auth supabase-storage supabase-meta supabase-functions \
         supabase-analytics supabase-vector supabase-pooler \
         realtime-dev.supabase-realtime; do
  if docker ps -a --format '{{.Names}}' | grep -qx "$c"; then
    echo "Removing stray container: $c"
    docker rm -f "$c" >/dev/null || true
  fi
done

log "Checking host ports are free"
check_port() {
  local port="$1" label="$2"
  if ss -ltn "( sport = :$port )" | tail -n +2 | grep -q .; then
    echo "ERROR: port $port ($label) is still in use after stopping the stack."
    echo "Run: sudo ss -ltnp | grep :$port    to see what is holding it."
    exit 1
  fi
}
check_port "$KONG_HTTP_PORT"  "Kong HTTP"
check_port "$KONG_HTTPS_PORT" "Kong HTTPS"
check_port "$STUDIO_PORT"     "Studio"
check_port "$POSTGRES_PORT"   "Postgres"
```

After this, the existing `docker compose pull` / `up -d` / Kong readiness loop runs unchanged, so a second `./deploy-vms-server.sh` invocation will succeed instead of failing on the bound port.
