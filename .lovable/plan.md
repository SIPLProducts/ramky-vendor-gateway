## Problem

Current DMS flow already builds the exact SAP format:
```json
{
  "BP_LIFNR": "1061301",
  "FILE_UPLOAD": [
    { "FILE": "<base64>", "FILE_PATH": "PATH1" },
    { "FILE": "<base64>", "FILE_PATH": "PATH2" }
  ]
}
```
and SAP responds with the flat array you showed:
```json
[{ "BP_LIFNR": "...", "MSGTYP": "S", "MSG": "File(s) Uploaded Successfully", ... }]
```

The failure is **not** in the SAP call. It is the on-prem middleware rejecting the request before it ever reaches SAP:
```
HTTP 413 PayloadTooLargeError: request entity too large
  at jsonParser (D:\middleware (2)\middleware\node_modules\body-parser\lib\read.js)
```

Three base64 documents easily exceed Express's default 100 KB JSON body limit. The repo's `middleware/server.js` already sets `express.json({ limit: "50mb" })`, but the running instance at `D:\middleware (2)\` is an older build without that limit, so it still 413s.

You asked to keep the SAP single-request format — so the fix stays server-side, not in the payload shape.

## Fix

### 1. `middleware/server.js` — raise limits explicitly and add urlencoded parity
Confirm/keep:
- `app.use(express.json({ limit: "50mb" }))`
- Add `app.use(express.urlencoded({ limit: "50mb", extended: true }))` for parity.
- Optional: read limit from env `MIDDLEWARE_BODY_LIMIT` (default `50mb`) so the customer can bump it without code edits.

### 2. `middleware/README.md` — document the redeploy step
Add a short section:
- Stop the Windows service / node process.
- Replace `D:\middleware (2)\middleware\server.js` (and `package.json` if changed) with the latest from repo.
- `npm install` (no new deps, safe).
- Restart the service.
- Verify with `curl` against `/health` and a small `/sap/dms/upload` test.

### 3. `supabase/functions/sync-vendor-to-dms/index.ts` — response parsing only
Keep the **single batched request** in SAP format. Only refine response handling so the UI message is accurate when SAP returns the flat array:
- Treat parsed response as array (`rows`).
- `success = rows.every(r => r?.MSGTYP === "S")` (every file row OK).
- `message` = first row's `MSG` (e.g. `"File(s) Uploaded Successfully"`), or first error `MSG` on failure.
- Continue returning `sap` row array so the UI can list each file's status.
- Drop the misleading single-row `find(MSGTYP==='S')` so partial failures are surfaced.

No change to payload structure. No per-file splitting.

## Out of scope
- Database schema.
- BP create flow (`sync-vendor-to-sap`) — unchanged.
- Bulk SAP sync — unchanged.
- UI dialog layout — only the message text changes through the edge function response.

## Technical notes
- 50 MB covers ~37 MB of raw file bytes after base64 inflation (~33%). Existing 10 MB per-file cap in the edge function already keeps a single vendor's batch well under that.
- The middleware redeploy is a one-time customer action; without it, the code change in this repo has no effect on the running server.
