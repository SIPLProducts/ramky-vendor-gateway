# Tracing SAP requests end-to-end

A single **`reqId`** (UUID) is generated at the browser, forwarded as the
`x-request-id` HTTP header into every layer, and echoed back in response
headers. `grep <reqId>` over any layer's logs returns the full slice of that
request — there is no other correlation step.

## Layers covered

| Layer        | Code                                                    |
| ------------ | ------------------------------------------------------- |
| Browser      | `src/lib/sapTrace.ts` → `invokeWithTrace(fn, options)`  |
| Edge runtime | `supabase/functions/_shared/trace.ts` + per-function    |
| Middleware   | `middleware/server.js` (global per-request logger)      |
| SAP          | Captured via middleware `upstream.fetch.*` events       |

## Instrumented edge functions

- `fetch-tenants-from-sap`
- `sap-api-test-connection`
- `sap-master-fetch`
- `sync-vendor-to-sap`
- `sync-vendor-to-dms`

All of them now:

1. Generate or accept a `reqId` (`x-request-id`).
2. Emit JSON log lines for `req.received`, `auth.ok|failed`, `body.parsed`,
   `config.loaded` (where applicable), `upstream.prepared`,
   `upstream.fetch.start`, `upstream.fetch.end`, `upstream.fetch.error`,
   `response.sent`, and a catch-all `unhandled.error`.
3. Forward the `reqId` to the middleware on every outbound call.
4. Return the `reqId` in the JSON body (`{ ..., reqId }`) and `x-request-id`
   response header so the browser can print it.

## Log line shape

Every log line is one JSON object on a single line:

```json
{"svc":"sync-vendor-to-sap","reqId":"7c…","stage":"upstream.fetch.end","ts":"2026-…","elapsedMs":74,"status":200,"contentLength":1820}
```

Fields are consistent across layers, so you can filter on any of them:

- `stage` — lifecycle stage (`req.received`, `upstream.fetch.start`, …)
- `elapsedMs` — duration for that hop
- `status` / `sapStatus` — HTTP status
- `errorName`, `errorCode`, `causeCode`, `aborted`, `stack` — on failure

## Masking

Secrets are **never** printed:

- HTTP headers `authorization`, `x-middleware-key`, `apikey`, `cookie`,
  `proxy-authorization`, `x-api-key` log only the **key name** (value is
  redacted to `***`).
- Body fields matching `secret|password|token|api[-_ ]?key|authorization|
  service[-_ ]?role` are redacted to `***` recursively (up to depth 4).
- Body previews are capped at 500 bytes.

## Reading the logs

After reproducing once, copy the `reqId` from the browser console (or from
the response JSON / `x-request-id` header), then on the VM:

```bash
# Edge function logs (self-hosted Supabase docker compose)
docker compose logs --since=15m functions | grep <reqId>

# Middleware logs (systemd)
journalctl -u vms-middleware --since "15 min ago" | grep <reqId>

# Nginx (if x-request-id is logged — see TRACING_FETCH_TENANTS.md §3)
grep <reqId> /var/log/nginx/edge_access.log /var/log/nginx/edge_error.log
```

**Whichever layer is missing the `reqId` is where the request never landed.**
That single piece of evidence pinpoints the failing hop without guessing.

## Frontend usage

Replace direct `supabase.functions.invoke(...)` calls with the helper:

```ts
import { invokeWithTrace } from "@/lib/sapTrace";

const { data, error, reqId, elapsedMs } = await invokeWithTrace(
  "fetch-tenants-from-sap",
  { body: { email } },
);

// reqId is in the browser console as well as in the response JSON.
console.log("Use reqId on the server:", reqId);
```

Or, if you must call `invoke` directly, attach the `x-request-id` header
manually:

```ts
const reqId = crypto.randomUUID();
console.info({ reqId, fn: "sync-vendor-to-sap", stage: "invoke.start" });
const t0 = Date.now();
const { data, error } = await supabase.functions.invoke("sync-vendor-to-sap", {
  body: { vendorId },
  headers: { "x-request-id": reqId },
});
console.info({ reqId, stage: "invoke.end", elapsedMs: Date.now() - t0, ok: !error });
```

## Verifying nothing leaks

After triggering some traffic:

```bash
# Should return zero matches for known secret values:
journalctl -u vms-middleware --since "1 hour ago" | grep -F "$MIDDLEWARE_SHARED_SECRET"
docker compose logs --since=1h functions | grep -F "$MIDDLEWARE_SHARED_SECRET"
```

If either grep prints lines, the masker missed a case — open an issue with
the offending log line redacted.

See `docs/TRACING_FETCH_TENANTS.md` for nginx/Kong/edge-runtime tuning
recipes when the `reqId` is present on one side but missing on the other.
