# DEV tenant fetch — next step after the port fix

## Where things stand

The port collision is resolved and there is no duplicate process. `pm2 list` shows exactly one DEV middleware (id 3, online, 8m uptime) and one PROD middleware (id 0). The `EADDRINUSE` lines were from the crash-loop before the port change — the restart counter (6) marks them as historical, not current.

The middleware is bound and answering:

```text
Sharvi SAP middleware listening on :3002
SAP target: http://10.200.1.4:8080
GET /health 200 410 - 0.973 ms
```

Localhost is therefore healthy. If `Could not reach SAP: in-code-timeout` still appears in the app, the break is in the hop *before* the middleware — the edge function container reaching `http://10.200.1.7:9008` — or SAP itself being slow to answer `/sap/proxy`. Those `GET /health 200` lines only prove something local reached it; they do not prove the edge container did.

## Steps on the DEV server

1. Prove the path end to end, from outside localhost:
   - `curl -s http://10.200.1.7:9008/health`

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
