## Problem

`{"msg":"WorkerRequestCancelled: request has been cancelled by supervisor"}` is **not** the same error as before. It is emitted by the **self-hosted Supabase `edge-runtime` supervisor** (the process that hosts Deno workers), not by our `AbortController`. The supervisor killed the worker mid-request.

The supervisor cancels a worker for one of these reasons (in order of likelihood for this case):

1. **`worker_request_wall_clock_limit_ms` exceeded** — default in self-hosted edge-runtime is **60 seconds** (sometimes 150s depending on image). Our function now waits up to 90s for SAP, so the supervisor kills it before our own timeout fires.
2. `worker_request_cpu_time_soft_limit_ms` / `hard_limit_ms` exceeded (CPU, not wall clock) — unlikely here, the function is mostly idle awaiting fetch.
3. Memory limit exceeded — unlikely for this payload.
4. Kong/nginx closed the client connection and the supervisor cancelled the orphaned worker — possible but secondary; nginx is already at 600s on `/supabase/`.

So the new bottleneck has moved one layer **up**: from our in-code abort (was 25s, now 90s) to the **edge-runtime supervisor wall-clock limit** on your VM.

## Fix Strategy

Two independent changes are needed. Do **both**.

### A. Raise the edge-runtime supervisor wall-clock limit on the VM (required)

The supervisor is started by the `supabase/edge-runtime` container or the `edge-runtime` binary launched from `scripts/lib/40-functions.sh`. It accepts these flags / env vars:

- `--worker-request-wall-clock-limit-ms` (or env `EDGE_RUNTIME_WORKER_REQUEST_WALL_CLOCK_LIMIT_MS`)
- `--worker-request-cpu-time-soft-limit-ms`
- `--worker-request-cpu-time-hard-limit-ms`

Raise wall-clock to **120000 ms** (must be > our in-code 90s + headroom).

Action items (you run on the VM, I cannot reach it):

1. Inspect how edge-runtime is launched:
   - `systemctl cat supabase-edge-runtime` (or whatever the unit is called), or
   - `docker inspect <edge-runtime container>` to see the command/env.
2. Add to the launch command / unit `Environment=`:
   ```
   EDGE_RUNTIME_WORKER_REQUEST_WALL_CLOCK_LIMIT_MS=120000
   EDGE_RUNTIME_WORKER_REQUEST_CPU_TIME_SOFT_LIMIT_MS=120000
   EDGE_RUNTIME_WORKER_REQUEST_CPU_TIME_HARD_LIMIT_MS=120000
   ```
   or pass the equivalent `--worker-request-wall-clock-limit-ms 120000` flags.
3. Restart: `systemctl restart supabase-edge-runtime` (or `docker restart <name>`).
4. Verify with `systemctl show supabase-edge-runtime | grep -i wall` or `docker exec ... env | grep WALL`.

I will update `scripts/lib/40-functions.sh` so future redeploys also set these env vars, so the limit doesn't get reset on next `deploy-vms-server.sh` run.

### B. Make the edge function resilient (code change I will make in build mode)

Even with the limit raised, we should:

1. Keep `abortMs = Math.max(config.timeout_ms, 90000)` but cap it at **110000** so our abort still fires *before* the new 120s supervisor limit. That guarantees a clean JSON error instead of the cryptic `WorkerRequestCancelled`.
2. Wrap the outer `Deno.serve` handler so that if the worker is cancelled, we at least log the elapsed time and the SAP URL we were calling — easier to diagnose next time.
3. Add `console.log` lines with elapsed ms around the `fetch()` so `supabase functions logs fetch-tenants-from-sap` shows exactly which leg is slow (middleware → SAP, or SAP itself).

### C. Confirmation steps

After (A) + (B):

```
# 1. Hit middleware directly — should return JSON in ~35s
curl -X POST http://206.1.23.95:9009/sap/proxy \
  -H 'content-type: application/json' \
  -H "x-middleware-key: $KEY" \
  -d '{"url":"<SAP_URL>","method":"POST","headers":{...},"body":{"UMAIL":"shaileshvitthal.gundu@ramky.com"},"useBasicAuth":true}'

# 2. Hit the edge function — should now return tenants JSON, not WorkerRequestCancelled
curl -X POST http://206.1.23.95:9009/supabase/functions/v1/fetch-tenants-from-sap \
  -H 'authorization: Bearer <user_jwt>' \
  -H 'content-type: application/json' \
  -d '{"email":"shaileshvitthal.gundu@ramky.com"}'
```

If #1 succeeds and #2 still fails, the supervisor env vars didn't take effect — re-check step A.2.

## Files I will edit in build mode

- `supabase/functions/fetch-tenants-from-sap/index.ts` — cap abort at 110s, add timing logs.
- `scripts/lib/40-functions.sh` — export the three `EDGE_RUNTIME_*_LIMIT_MS` env vars when launching/relaunching edge-runtime so the fix survives redeploys.

## What I will NOT do

- No queue/background-worker refactor (overkill; raising the limit is the documented fix for self-hosted).
- No changes to middleware code or nginx (already correctly sized).
- I cannot SSH to your VM, so step A.1–A.4 must be done by you.
