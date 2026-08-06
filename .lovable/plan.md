# Fix DEV tenant fetch — middleware is on the wrong port

## Root cause (confirmed from your .env files)

The code is identical in DEV and PROD. The difference is a port collision that exists only in DEV.

```text
                        DEV                         PROD
middleware .env         PORT=3000                   PORT=3012
backend .env            STUDIO_PORT=3000  <-- same  STUDIO_PORT=3010
nginx /sap ->           127.0.0.1:3002              127.0.0.1:3012   (matches)
nginx /studio/ ->       127.0.0.1:3000              127.0.0.1:3010
```

So in DEV:

1. Nothing listens on **3002**, which is where nginx sends `/sap` and `/health`.
2. The middleware is configured for **3000**, which Supabase Studio already occupies — it either fails to bind or the port answers as Studio, never as `/sap/proxy`.

In PROD all three numbers line up (3012 middleware = 3012 nginx, Studio separately on 3010), which is why only DEV fails. The edge function then waits out its 25s abort timer and prints `Could not reach SAP: in-code-timeout`.

## Your app config is already correct — the server side is not

The screenshot shows the DEV `Tenants From SAP` row is fine: Base URL `http://10.200.1.4:8080`, Via Proxy Server, Middleware URL `http://10.200.1.7:9008`, Middleware Port 3002.

That is exactly the problem: the app asks nginx on 9008, nginx forwards `/sap` to `127.0.0.1:3002`, and the DEV middleware is not there — it is set to 3000. Saving the screen again will not change that; the port must be fixed on the server.

## Fix

1. On the DEV server, change `PORT=3000` to `PORT=3002` in `/opt/Ramky_Applications/DEV/VMS/middleware/.env`, then `systemctl restart vms-middleware` (DEV unit).
2. Verify both return JSON:
   - `curl http://127.0.0.1:3002/health`
   - `curl http://10.200.1.7:9008/health`
   If the second fails, the problem is nginx; if the first fails, the middleware did not start (check `journalctl -u vms-middleware -n 50` for `EADDRINUSE`).
3. Confirm the Proxy Secret on that screen equals the DEV `MIDDLEWARE_SHARED_SECRET` — DEV and PROD use different values, so a copied PROD secret gives a 401.
4. Confirm the DEV middleware's `SAP_BP_API_URL` host matches the Base URL host `10.200.1.4:8080` — `/sap/proxy` rejects any other target host. DEV already matches; PROD's is empty and should be filled with the same value.

## Code changes in this repo (small, so this is self-diagnosing next time)

- `supabase/functions/fetch-tenants-from-sap/index.ts`: abort with a real `AbortError` (or treat the `in-code-timeout` reason as an abort) so the UI shows "SAP did not respond within Ns (timeout)" instead of the misleading "Could not reach SAP", and include the attempted middleware URL in the returned message.
- `middleware/server.js`: on startup, log the bound port clearly, and return an explicit `503 middleware not configured` from `/sap/proxy` when `SAP_BP_API_URL` is empty instead of a confusing host-mismatch error.
- `src/components/admin/CreateUserDialog.tsx`: render the returned `hint` under the red error text.

## Notes

- No database schema changes.
- Steps 1–3 are server-side; the code changes need a DEV edge-function redeploy and frontend rebuild.
- Your nginx config needs no changes — it is already consistent for both environments.
- Rotate the SAP password you pasted in chat when convenient.
