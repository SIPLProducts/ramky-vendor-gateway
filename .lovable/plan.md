## Goal

Trace exactly where `fetch-tenants-from-sap` is being aborted. The edge function logs already prove the abort is happening **inside the edge function's `fetch()` to the middleware** (`aborted=true after 90003ms`), even though direct curl to the middleware succeeds in ~70ms. So the failure is between the **self-hosted edge-runtime worker** and the **middleware** — not in SAP, not in the middleware → SAP leg.

This plan adds end-to-end correlated logs so we can prove that conclusively and pinpoint whether the request ever leaves the edge worker, ever arrives at nginx/kong, ever arrives at the middleware, or dies in between.

**No business logic, no request/response shape, no auth, no SAP behavior changes.**

## What the existing logs already tell us

```
[fetch-tenants-from-sap] mode=proxy abortMs=90000 sapUrl=http://10.200.1.2:8000/...
[fetch-tenants-from-sap] total elapsed=90003ms networkError=yes
[fetch-tenants-from-sap] fetch failed after 90003ms aborted=true: The signal has been aborted
```

- The edge function entered the `fetch(proxyUrl, ...)` to the middleware.
- It never received a response in 90s.
- Our `AbortController` (90s cap) fired.
- The user-visible message "Could not reach SAP: The signal has been aborted" comes from the catch block — it's misleading; the abort is on the **edge → middleware** hop, not edge → SAP.

So the question we need to answer with the new logs is: **did the request ever reach the middleware process?** If yes, where did it stall on the return. If no, edge-runtime egress / nginx is the suspect.

## Changes in this repo

### 1. `supabase/functions/fetch-tenants-from-sap/index.ts` — structured tracing

Add a small `log(reqId, stage, fields)` helper that prints one JSON line per event. All lines share the same `reqId` (crypto.randomUUID()).

Log stages (no behavior change, only `console.log`):

- `req.received` — timestamp, method, url, user-agent
- `auth.ok` — userId, email (already validated)
- `body.parsed` — request body (email only)
- `config.loaded` — configId, name, connection_mode, base_url, endpoint_path, timeout_ms, middleware_url (normalized), httpMethod, proxySecretPresent: true/false (never the value), authType
- `proxy.prepared` — proxyUrl, abortMs, outgoing headers keys (values redacted), payload key list
- `proxy.fetch.start` — startedAt (ISO)
- `proxy.fetch.end` — endedAt, elapsedMs, status, statusText, response header keys, contentLength, bodyPreview (first 500 chars)
- `proxy.fetch.error` — elapsedMs, errorName, errorMessage, errorCode (`err.cause?.code`), errorStack, aborted (boolean), abortReason (`controller.signal.reason`), timerFired (boolean from a flag set inside `setTimeout`)
- `sap.parsed` — tenant count, raw response keys
- `response.sent` — success, elapsedTotalMs

Also forward `reqId` to the middleware as header `x-request-id` so it appears in middleware logs for the same request.

### 2. `middleware/server.js` — correlated structured tracing

Add a request-scoped logger keyed by the incoming `x-request-id` header (or a freshly minted UUID). Behavior unchanged.

New logs on every `/sap/proxy` (and `/sap/bp/create`, `/sap/dms/upload`) call:

- `req.received` — reqId, ISO timestamp, clientIp (`req.ip`), method, path, header keys, contentLength, `x-middleware-key` present (boolean only)
- `auth.result` — pass/fail (no secret values)
- `upstream.prepared` — sapUrl, method, header keys, authMode (`basic` / `none`), username only (no password), payload key list, payloadBytes
- `upstream.fetch.start` — startedAt
- `upstream.fetch.end` — endedAt, elapsedMs, sapStatus, sapStatusText, sapHeaderKeys, responseBytes, bodyPreview (first 500 chars)
- `upstream.fetch.error` — elapsedMs, errorName, errorMessage, errorCode, cause.code, stack, mapped describeFetchError result
- `response.sent` — reqId, status returned to edge, elapsedTotalMs

Wrap `forwardToSap` so it accepts and propagates the `reqId`. Update `/sap/bp/create`, `/sap/dms/upload`, `/sap/proxy` to pass it through.

Secret/password masking helper retained and extended: mask `Authorization`, `x-middleware-key`, anything matching `/secret|password|token|key/i` in header/body key names.

### 3. New file `docs/TRACING_FETCH_TENANTS.md`

Operator-facing recipe (under 2 pages) explaining:

- How to read the new structured logs on both sides
- How to grep by reqId: `docker logs functions 2>&1 | grep <reqId>` and `journalctl -u vms-middleware | grep <reqId>`
- How to enable kong access logs: example `kong.conf` snippet (`proxy_access_log = /dev/stdout`, `log_level = info`) and how to include `$request_id` in the log_format
- How to enable nginx debug for just this location:
  ```
  location /supabase/ {
      access_log /var/log/nginx/edge_access.log main;
      error_log  /var/log/nginx/edge_error.log debug;
      proxy_read_timeout 180s;
      proxy_send_timeout 180s;
      proxy_set_header X-Request-Id $request_id;
  }
  ```
- How to raise self-hosted edge-runtime supervisor limits (the actual root cause for the 90s aborts):
  ```yaml
  services:
    functions:
      environment:
        EDGE_RUNTIME_WORKER_REQUEST_WALL_CLOCK_LIMIT_MS: "150000"
        EDGE_RUNTIME_WORKER_REQUEST_CPU_TIME_SOFT_LIMIT_MS: "150000"
        EDGE_RUNTIME_WORKER_REQUEST_CPU_TIME_HARD_LIMIT_MS: "150000"
  ```
  followed by `docker compose up -d functions`.
- The expected timing summary table the operator can build manually from the reqId-correlated logs:
  ```
  Nginx received       (nginx access log timestamp)
  Kong upstream        (kong access log)
  Edge req.received    (edge log)
  Edge proxy.fetch.start
  Middleware req.received
  Middleware upstream.fetch.start
  Middleware upstream.fetch.end
  Middleware response.sent
  Edge proxy.fetch.end
  Edge response.sent
  ```
  The plan does NOT attempt to compute this automatically in code (would require shipping logs to a single sink). The doc shows the operator how to assemble it from grep output.

### 4. No other repo files change

- No changes to: nginx configs in the repo (`scripts/lib/70-nginx.sh`), kong/edge-runtime startup (`scripts/lib/40-functions.sh` already updated previously), middleware unit file, frontend, RLS, edge function business logic.

## Technical notes

- All new logs use `console.log(JSON.stringify({...}))` so they're greppable and parseable. No new dependencies on either side.
- Edge function still returns the same JSON shape on success and failure. The misleading `"Could not reach SAP: ..."` text is preserved (changing it is a behavior change you asked us to avoid).
- Middleware still returns the same `{ ok, sapStatus, durationMs, sapResponse }` envelope.
- `x-request-id` is purely additive; if the edge function or any caller omits it, the middleware mints its own.
- Secrets are never logged. We log presence booleans and header **key names** only for sensitive entries.

## Out of scope (called out so it's not a surprise)

- We can't add logs inside the `edge-runtime` supervisor itself or inside Kong — those are upstream binaries. The doc explains how to enable their built-in access/error logs and correlate via `X-Request-Id`.
- We won't ship logs to an aggregator. Correlation is by grep on `reqId` until/unless you ask for an aggregator integration.
- We won't change the 90s in-code abort. If you want a longer cap after raising the supervisor limit, that's a one-line follow-up.

## After this lands — how to use it

1. Reproduce the failure once from the UI.
2. Copy the `reqId` from the edge function log line `req.received`.
3. Run on the VM:
   ```bash
   docker compose logs --since=10m functions | grep <reqId>
   journalctl -u vms-middleware --since "10 min ago" | grep <reqId>
   grep <reqId> /var/log/nginx/edge_access.log /var/log/nginx/edge_error.log
   ```
4. Whichever side does **not** show the reqId is the side the request never reached — that's where the abort happens.

That single piece of evidence will tell us whether to fix the edge-runtime supervisor limit, nginx `proxy_read_timeout`, or kong's upstream timeout.
