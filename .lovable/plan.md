# Implement Edge Function middleware-URL + timeout fix (so it lands in GitHub)

## Why this is needed
Lovable auto-syncs every code change to your connected GitHub repo. Our recent turns were all in **plan mode** — no files were written, so there is literally nothing for GitHub to receive. To get "latest changes" into Git, we need to actually implement the fix we discussed.

## What will change

### 1. `supabase/functions/_shared/trace.ts`
Add and export a shared helper:

- `normalizeMiddlewareBase(rawUrl, logger)` — strips known path suffixes (`/sap/proxy`, `/sap/bp/create`, `/sap/dms/upload`, `/health`), then if the host is `127.0.0.1` or `localhost`, rewrites it to `172.17.0.1` (the Docker host gateway used by the Supabase functions container). Logs both the original and rewritten URLs under stage `middleware.url.rewritten`.
- Honors a `SAP_MIDDLEWARE_URL_OVERRIDE` environment secret — when set, it always wins over the DB-stored value.

### 2. Each SAP-calling Edge Function
Files: `fetch-tenants-from-sap`, `sap-api-test-connection`, `sap-master-fetch`, `sync-vendor-to-sap`, `sync-vendor-to-dms`, `sync-vendors-to-sap-bulk`.

- Replace inline URL normalization with the shared `normalizeMiddlewareBase()` call.
- Fix the in-code abort timeout: change the clamp so `config.timeout_ms` (currently 30000) is the real ceiling — `clamp(config.timeout_ms ?? 30000, 5000, 25000)` — instead of forcing 90000s, which exceeds the Edge runtime wall-clock limit and causes the supervisor to kill the function before any JSON error can be returned.
- Confirm `await fetch(...)` and `await res.text()` are already awaited and every exit path returns through the shared `json(...)` helper (spot-checked already; no changes needed beyond a final verification pass).

### 3. Optional `SAP_MIDDLEWARE_URL_OVERRIDE` secret
Not added automatically. If you want a kill-switch to override the per-tenant DB value from one place, I'll prompt to add it via the secrets tool after the code lands.

## What will NOT change
- No business logic, no SAP payload shapes, no auth, no DB schema, no request/response contracts.
- No frontend changes.
- Logging stages and field names stay the same; one new stage `middleware.url.rewritten` is added.

## After implementation
- Files are written → Lovable auto-commits and pushes to your connected GitHub repo within seconds.
- I'll deploy the affected Edge Functions so you can retry from the app and confirm the new log sequence: `middleware.url.rewritten` → `proxy.fetch.start` → `proxy.fetch.end` → `sap.parsed` → `response.sent`.

Approve to switch to build mode and apply.
