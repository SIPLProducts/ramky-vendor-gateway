# DEV tenant fetch — next step after the port fix

## Where things stand

The port collision is resolved. Your logs show the middleware bound successfully and answering:

```text
Sharvi SAP middleware listening on :3002
SAP target: http://10.200.1.4:8080
GET /health 200 410 - 0.973 ms
```

Two things remain:

1. **A duplicate pm2 instance.** The error log shows `EADDRINUSE ... port: 3002`. One copy of the middleware owns 3002 and a second copy keeps crash-looping on it. That second process is harmless to traffic but hides real errors and will race after any reboot.
2. **The timeout, if it still appears.** With 3002 answering locally, a remaining `in-code-timeout` can only come from the hop *before* the middleware — the edge function container reaching `http://10.200.1.7:9008` — or from SAP itself being slow to answer `/sap/proxy`.

## Steps on the DEV server

1. Remove the duplicate:
   - `pm2 list` — look for two entries pointing at `DEV/VMS/middleware`.
   - `pm2 delete <the crashing id>` then `pm2 save`.
   - `pm2 logs vms-dev-middleware --lines 30` should now show no `EADDRINUSE`.
2. Confirm the full path the app actually uses (not just localhost):
   - `curl -s http://10.200.1.7:9008/health`
   - Then exercise the real route with the DEV secret:
     `curl -s -X POST http://10.200.1.7:9008/sap/proxy -H 'content-type: application/json' -H 'x-middleware-secret: 123456' -d '{"targetUrl":"http://10.200.1.4:8080/<tenants-path>","method":"GET"}'`
   - Watch `pm2 logs` while that runs. If a line appears in the middleware log, the network path is fine and the delay is SAP-side. If nothing appears, nginx on 9008 or the edge container's egress is the blocker.
3. If step 2 shows nothing from outside but localhost works, check that nginx on 9008 is actually running the DEV server block and that the DEV Supabase edge-runtime container can route to `10.200.1.7` (it cannot use `localhost`).
4. Confirm the Proxy Secret saved in SAP API Settings is `123456` (DEV) and not the PROD value — a mismatch returns 401, which the UI currently also surfaces as a generic failure.

## Code changes in this repo (so this diagnoses itself next time)

- `supabase/functions/fetch-tenants-from-sap/index.ts`: distinguish the failure modes instead of the blanket "Could not reach SAP: in-code-timeout" — report `timeout after Ns calling <url>`, `connection refused`, and `401 secret mismatch` separately, and return the attempted middleware URL in the response.
- `middleware/server.js`: log every inbound `/sap/proxy` call with the target URL and the SAP response time, and return `503 middleware not configured` when `SAP_BP_API_URL` is empty.
- `src/components/admin/CreateUserDialog.tsx`: render the returned hint (URL + failure kind) under the red error text.

## Notes

- No database changes.
- Code changes require a DEV edge-function redeploy and a frontend rebuild.
- `SAP_BP_USERNAME`/`SAP_BP_PASSWORD` appear twice in your DEV `.env`; the later pair wins. Worth removing the placeholder pair to avoid confusion — and rotate the SAP password you pasted in chat.
