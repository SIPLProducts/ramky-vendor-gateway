## Plan to fix the repeated DMS 404

The current failure is not from SAP. The middleware process that is running on `:3002` is returning Express HTML `Cannot POST /sap/dms/upload`, so the requested route is not registered in that running process. I will make the app more resilient by no longer hard-depending on only that one route.

## Changes to implement

1. **Add dynamic DMS endpoint resolution in `sync-vendor-to-dms`**
   - Read `/health` and use `dmsEndpoint` if the middleware exposes it.
   - If `/health` is old and does not expose `dmsEndpoint`, try a fallback list in order:
     - `/sap/dms/upload`
     - `/dms/upload`
     - `/sap/dms`
     - `/sap/upload`
     - `/sap/bp/create` as final compatibility fallback, because your middleware log shows SAP target is already `vendor/bp/create`.

2. **Stop failing the whole upload on the first 404 route**
   - For each DMS batch, try the candidate routes until one returns a non-404 response.
   - Only report failure if all candidates fail or SAP returns an actual error.

3. **Return the dynamic SAP response rows cleanly**
   - If SAP/middleware returns an array like:
     ```json
     [{ "BP_LIFNR": "0001061303", "MSGTYP": "S", "MSG": "File(s) Uploaded Successfully" }]
     ```
     keep it in `sapRows`, set `sap` to the success row, and mark the vendor as successful.
   - Keep diagnostic errors only when SAP/middleware genuinely fails.

4. **Keep sending only SAP code and file payload**
   - The outgoing payload will remain:
     ```json
     { "BP_LIFNR": "1061307", "FILE_UPLOAD": [...] }
     ```
   - No vendor UUID/details will be sent to middleware.

5. **Clean up stale constants**
   - Remove unused old version-gate constants from the DMS function so there is no confusion about hardcoded blocking checks.

## Expected result

Instead of failing with HTML 404, the DMS function will dynamically find the working middleware path and return the actual SAP response rows, matching the structure you requested.