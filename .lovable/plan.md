# Fix "Could not reach SAP: in-code-timeout" on DEV (10.200.1.7)

## What the message actually means

That text is produced by the `fetch-tenants-from-sap` function only when its own 25-second abort timer fires. The function calls `controller.abort("in-code-timeout")`, and because the thrown value is a plain string (not an `AbortError`), the timeout branch is skipped and the generic "Could not reach SAP: …" wording is printed instead.

So the real situation is: **the edge function never got a reply from the SAP middleware within 25s** — it is not a nginx/SSL problem on the browser side. The browser call to `/supabase/functions/v1/fetch-tenants-from-sap` clearly succeeded (you got a JSON answer back).

## Where the connection breaks

The function reads the `Tenants From SAP` row in SAP API Settings and, in `proxy` mode, posts to `<middleware_url>/sap/proxy`. Inside the Supabase edge-runtime container:

- `127.0.0.1` / `localhost` is rewritten to `172.17.0.1` (docker host). If the DEV middleware only listens on loopback, or the docker bridge IP differs, this hangs until the timer fires.
- If the DEV config still points at the PROD middleware port (`3012`) instead of DEV `3002`, it also hangs.
- The nginx blocks you pasted expose the middleware at `/sap` on ports 80 and 9008 for DEV — going through nginx (`http://10.200.1.7:9008`) is the reliable path from inside the container.
- Secondary: the middleware's `/sap/proxy` rejects any target host other than the one in its own `SAP_BP_API_URL`. Your DEV `middleware/.env` currently has `SAP_BP_API_URL` empty, so this guard throws before reaching SAP — that alone can break tenant fetch.

## Plan

1. Diagnose (server-side, before code changes)
   - Confirm what the DEV `Tenants From SAP` row holds: `connection_mode`, `middleware_url`, `proxy_secret`, `base_url + endpoint_path`, `timeout_ms`.
   - From the server: `curl http://127.0.0.1:3002/health` and the same via `http://10.200.1.7:9008/health` to verify the DEV middleware is up and reachable through nginx.
   - Read the DEV edge function logs for the `proxy.prepared` / `proxy.fetch.error` trace lines — they print the exact URL the container tried.

2. Fix the DEV configuration
   - Set the DEV middleware URL to a container-reachable address (`http://10.200.1.7:9008`), not `127.0.0.1:3002`.
   - Fill DEV `middleware/.env`: `SAP_BP_API_URL`, `SAP_BP_USERNAME`, `SAP_BP_PASSWORD`, and `MIDDLEWARE_SHARED_SECRET` matching the Proxy Secret in SAP API Settings; restart the middleware service.

3. Code changes (small, in this repo)
   - `supabase/functions/fetch-tenants-from-sap/index.ts`: abort with a proper `DOMException`/`AbortError` (or treat reason `in-code-timeout` as an abort) so the user sees a correct "SAP did not respond within Ns (timeout)" message plus the attempted URL, instead of a confusing "Could not reach SAP".
   - Surface the attempted middleware URL and elapsed time in the JSON returned to the UI so this is self-diagnosable next time.
   - `middleware/server.js`: when `SAP_BP_API_URL` is empty, return a clear `503 middleware not configured` from `/sap/proxy` rather than a host-mismatch error.
   - `src/components/admin/CreateUserDialog.tsx`: show the returned hint/URL under the red error line.

## Technical notes

- No database schema changes.
- Edge function redeploy needed on DEV after step 3; middleware restart after step 2.
- Nginx config itself needs no change for this issue — the `/sap` and `/supabase/` blocks you pasted are correct.
