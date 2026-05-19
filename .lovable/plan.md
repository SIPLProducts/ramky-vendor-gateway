## What is actually happening

- The DMS upload is now sending a browser-visible request that contains `{ vendorId, payload }`. That is why the vendor ID still appears in the request/response wrapper.
- The 413 is happening before SAP receives the request. Latest logs show the middleware is still an old running process:

```text
Old middleware is running. /health must show middlewareVersion dms-large-upload-v3+ and bodyLimit. Current: {}
DMS SAP payload batch 1/1: BP_LIFNR=1061307 files=3 approx=1.51 MB
DMS batch 1/1 status=413 PayloadTooLargeError
```

- Since only ~1.51 MB is rejected, the live middleware is using Express default/small body limits, not the updated 500mb middleware.

## Implementation plan

1. Change the browser-visible DMS request to use SAP code only
   - Update the frontend DMS sync flow to send:

```json
{
  "BP_LIFNR": "1061307",
  "FILE_UPLOAD": [
    { "FILE": "BASE64", "FILE_PATH": "PATH1" }
  ]
}
```

   - Remove `vendorId` from the visible upload request body.
   - The backend will identify the vendor by `BP_LIFNR` instead of `vendorId`.

2. Stop returning vendor ID in the DMS result payload
   - Update `sync-vendor-to-dms` response so each result returns SAP-oriented fields only, for example:

```json
{
  "BP_LIFNR": "1061307",
  "success": true,
  "message": "File(s) Uploaded Successfully",
  "uploadedCount": 3,
  "sapRows": []
}
```

   - Keep internal vendor lookup for status updates/audit logs, but do not expose `vendorId` in the API response.

3. Remove the extra prepare response bloat
   - Keep `prepare-dms-payload` only for building the exact SAP payload.
   - The upload function will accept direct `{ BP_LIFNR, FILE_UPLOAD }`, so browser Inspect will show exactly the SAP payload shape instead of a wrapper.

4. Tighten payload sizing to avoid 413
   - Lower the per-request DMS batch limit further from 8 MB to a safer small limit.
   - Keep batching in the backend so each call to the middleware remains:

```json
{
  "BP_LIFNR": "1061307",
  "FILE_UPLOAD": [...]
}
```

   - If a single file is too large for the current path, return a clear message instead of retrying a guaranteed 413.

5. Restore strict middleware detection
   - Because the logs prove the old middleware is still running, make the error actionable again when `/health` does not expose `middlewareVersion` and `bodyLimit`.
   - This avoids sending payloads into an old Express parser that will always fail.

6. Update the DMS result dialog
   - Show `BP_LIFNR` / SAP code instead of vendor UUID.
   - Keep uploaded count, skipped documents, and SAP response rows visible.

## Required Windows middleware action

Even after code changes, the 413 will continue if the old Windows process is still running. The current live log proves that port 3002 is not serving the updated middleware.

Run on the Windows middleware machine:

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