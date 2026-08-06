# Fix DEV tenant fetch — middleware is on the wrong port

## Root cause (confirmed from your two .env files)

DEV middleware `.env` has `PORT=3000`.

But everywhere else in DEV expects the middleware on **3002**:

```text
nginx (:80 and :9008)   location ~ ^/(sap|health)  ->  http://127.0.0.1:3002
DEV middleware .env                                     PORT=3000
DEV Supabase Studio                                     127.0.0.1:3000   <-- collision
```

Two consequences:

1. Nothing is listening on 3002, so any call routed through nginx `/sap` dies.
2. Port 3000 is already the DEV Supabase Studio port, so the middleware either fails to bind or requests to 3000 land on Studio and never return a `/sap/proxy` answer.

Either way the edge function waits until its own 25s abort timer fires and reports `Could not reach SAP: in-code-timeout`. PROD works because its `.env` has `PORT=3012`, which matches its nginx block.

## Fix

1. On the DEV server, change `PORT=3000` to `PORT=3002` in `/opt/Ramky_Applications/DEV/VMS/middleware/.env`, then restart the DEV middleware service.
2. Verify: `curl http://127.0.0.1:3002/health` and `curl http://10.200.1.7:9008/health` both return JSON.
3. In SAP API Settings → `Tenants From SAP` (DEV), confirm:
   - Middleware URL points at a container-reachable address — `http://10.200.1.7:9008` is safest (`127.0.0.1` gets rewritten to `172.17.0.1` inside the edge container and may not resolve).
   - Proxy Secret matches the DEV `MIDDLEWARE_SHARED_SECRET` (DEV and PROD use different values).
   - `base_url` host matches the DEV middleware's `SAP_BP_API_URL` host — `/sap/proxy` rejects any other host.
4. Note for PROD: its `SAP_BP_API_URL` / `SAP_DMS_API_URL` are empty. Tenant fetch may be running in direct mode there, but any proxy-mode call will fail the host check — worth filling in with the same SAP base URL.

## Code changes in this repo (small, so this is self-diagnosing next time)

- `supabase/functions/fetch-tenants-from-sap/index.ts`: abort with a real `AbortError` (or treat the `in-code-timeout` reason as an abort) so the UI shows "SAP did not respond within Ns (timeout)" instead of the misleading "Could not reach SAP", and include the attempted middleware URL in the returned message.
- `middleware/server.js`: on startup, log the bound port clearly, and return an explicit `503 middleware not configured` from `/sap/proxy` when `SAP_BP_API_URL` is empty instead of a confusing host-mismatch error.
- `src/components/admin/CreateUserDialog.tsx`: render the returned `hint` under the red error text.

## Notes

- No database schema changes.
- Steps 1–3 are server-side; the code changes need a DEV edge-function redeploy and frontend rebuild.
- Your nginx config needs no changes — it is already consistent for both environments.
- Rotate the SAP password you pasted in chat when convenient.
