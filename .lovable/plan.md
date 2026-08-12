# Fix DEV SAP Sync 404 + clearer SAP error messages

## What the response actually says

The failure is not in the app or the middleware routing. The request travelled all the way to SAP, and **SAP itself replied with its "Service cannot be reached — 404 Not found" HTML page**. That means the SAP service URL the DEV middleware forwards to does not exist on the DEV SAP system (wrong path, wrong port, wrong `sap-client`, or the ICF service is not activated there).

The message you see, `Middleware error: HTTP 200`, is misleading: the middleware answered fine (HTTP 200) and reported `ok:false` with SAP's real 404 inside. Our code only prints its own HTTP status, so the SAP status is lost.

## Part 1 — Configuration fix (server side, DEV)

On the DEV box, `middleware/.env` currently points `SAP_BP_API_URL` (and `SAP_DMS_API_URL`) at a path the DEV SAP system does not serve. Confirm with the SAP Basis team the correct DEV values, for example:

```text
SAP_BP_API_URL=http://<dev-sap-host>:<port>/vendor/bp/create?sap-client=<dev-client>
SAP_DMS_API_URL=http://<dev-sap-host>:<port>/vendor/dms/upload?sap-client=<dev-client>
```

Then restart the DEV middleware (`pm2 restart vms-dev-middleware`). Quick check before retrying from the app: `curl -i -u <user>:<pass> -X POST "<SAP_BP_API_URL>" -H 'Content-Type: application/json' -d '[]'` — an HTML 404 page means the URL is still wrong; JSON back means it is right.

Note: PROD works because its `.env` points at the correct PROD SAP service. Only the DEV `.env` needs correcting.

## Part 2 — Code change: report SAP's real status, not the middleware's

So this class of problem is self-explaining next time, in both sync paths:

- `supabase/functions/sync-vendor-to-sap/index.ts` — when the middleware wrapper returns `ok:false`, use `sapStatus` from the wrapper in the message (e.g. `SAP returned HTTP 404 for <target URL> — the SAP service path is wrong or not activated`) instead of `HTTP 200`.
- Detect an HTML body in `sapResponse` (starts with `<html`) and replace the raw markup in the dialog with a short line: `SAP returned an HTML error page (404 Not found) instead of JSON — check SAP_BP_API_URL in middleware/.env.`
- `supabase/functions/sync-vendor-to-dms/index.ts` — apply the same two rules for the DMS path, and keep the per-document counts intact.
- `middleware/server.js` — include the SAP target URL in the `ok:false` response for `/sap/bp/create` and `/sap/dms/upload` (it is already logged; adding it to the body makes the dialog actionable). No secrets are included.

## Result

- After the DEV `.env` correction, SAP Sync and DMS Sync work in DEV as they do in PROD.
- If an SAP path is ever wrong again, the dialog says "SAP returned HTTP 404 for <url>" instead of an HTML dump and a confusing `HTTP 200`.
