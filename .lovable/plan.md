## Diagnosis

1. The request you see in browser Inspect is currently the portal calling Lovable Cloud with:

```json
{ "vendorIds": ["..."] }
```

That is why you do not see this SAP payload in Inspect:

```json
{
  "BP_LIFNR": "1061301",
  "FILE_UPLOAD": [
    { "FILE": "BASE64", "FILE_PATH": "PATH1" },
    { "FILE": "BASE64", "FILE_PATH": "PATH2" }
  ]
}
```

The SAP payload is already built inside `sync-vendor-to-dms` and sent server-side to `/sap/dms/upload`, so browser Inspect cannot show it unless we change the frontend to call a separate backend function with the prepared payload.

2. The response confirms the live Windows middleware is still old:

```json
"Old middleware is running. /health must show middlewareVersion dms-large-upload-v3+ and bodyLimit. Current: {}"
```

The live `/health` response does not contain `middlewareVersion` and `bodyLimit`, which means the running process is not the updated `server.js` with `dms-large-upload-v4` and `500mb`.

## Fix plan

1. Add a new DMS payload prepare step
   - Create/adjust backend function behavior so the portal can first request the exact SAP DMS payload shape:

```json
{
  "BP_LIFNR": "1061301",
  "FILE_UPLOAD": [
    { "FILE": "BASE64", "FILE_PATH": "PATH1" }
  ]
}
```

   - This lets browser Inspect show the payload in the requested format before upload.
   - Keep base64 generated server-side from `vendor-documents`, not from the browser.

2. Change frontend DMS sync request flow
   - Instead of sending only `{ vendorIds }` for the visible DMS call, send the prepared payload to the upload function so Inspect shows `BP_LIFNR` and `FILE_UPLOAD`.
   - For multiple vendors, handle each vendor payload separately.

3. Keep safe upload batching internally
   - Even though Inspect can show the requested payload shape, the actual upload should still split large `FILE_UPLOAD` arrays into smaller batches to avoid 413.
   - Keep the SAP/middleware request body exactly as `{ BP_LIFNR, FILE_UPLOAD }` for every batch.

4. Make the old middleware error clearer and actionable
   - If `/health` does not return `middlewareVersion` and `bodyLimit`, show a direct message that the Windows process on port `3002` is not the latest file.
   - Include the exact expected health output: `middlewareVersion: dms-large-upload-v4`, `bodyLimit: 500mb`.

5. Verify deployment
   - Deploy the updated DMS backend function.
   - Confirm the function accepts the new frontend payload format and still supports the existing `{ vendorIds }` format if needed.

## What you still must do on Windows middleware

After code changes, you must restart the correct middleware folder on the Windows machine. The current response proves Cloud is reaching an old middleware instance.

Run in PowerShell as Administrator:

```powershell
Get-NetTCPConnection -LocalPort 3002 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
cd "D:\middleware (2)\middleware"
node server.js
```

Startup must show:

```text
Middleware build: dms-large-upload-v4
Body limit: 500mb
```

Then verify:

```powershell
curl http://localhost:3002/health
```

It must include:

```json
{
  "middlewareVersion": "dms-large-upload-v4",
  "bodyLimit": "500mb"
}
```

If this is missing, the app will continue blocking DMS upload because the live middleware is still old.