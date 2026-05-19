## Goal
Make the DMS upload flow send exactly the SAP payload shape you shared and treat the SAP success response array as the final successful upload result.

## What I will change

1. **Keep your app request body as-is**
   - The frontend/backend function can continue receiving:
     ```json
     { "vendorIds": ["7fc4723c-3a26-43e6-a0e0-2aff76727ac3"] }
     ```
   - The DMS sync function will fetch that vendor and its uploaded documents, then build the SAP payload automatically.

2. **Build the exact SAP DMS payload**
   - Send this format to the middleware/SAP endpoint:
     ```json
     {
       "BP_LIFNR": "1061301",
       "FILE_UPLOAD": [
         { "FILE": "BASE64", "FILE_PATH": "PATH1" },
         { "FILE": "BASE64", "FILE_PATH": "PATH2" }
       ]
     }
     ```
   - Normalize `BP_LIFNR` so the response can support SAP’s padded value like `0001061303`.

3. **Return SAP success response cleanly**
   - If SAP returns:
     ```json
     [
       {
         "BP_LIFNR": "0001061303",
         "MSGTYP": "S",
         "MSGNR": "200",
         "MSG": "File(s) Uploaded Successfully"
       }
     ]
     ```
   - The DMS sync result will mark the vendor upload as successful, save the SAP response in audit logs, and expose that SAP row back in the result.

4. **Reduce repeated 413 payload failures at the source**
   - Instead of sending all documents in one very large JSON request, split documents into smaller batches before calling `/sap/dms/upload`.
   - This avoids hitting Express JSON parser limits even when multiple files exist.
   - Keep each batch under a safe request-size threshold and still upload all documents for the vendor.

5. **Improve middleware response passthrough**
   - Keep middleware accepting the exact DMS payload.
   - Preserve SAP’s response array under `sapResponse` so the cloud function can parse success correctly.
   - Improve error details for `PAYLOAD_TOO_LARGE` so the portal shows whether the failure happened before SAP or inside SAP.

6. **Update middleware docs/env example**
   - Add `MIDDLEWARE_BODY_LIMIT=500mb` to `.env.example` so future Windows copies are configured correctly.
   - Correct README text that still says 200 MB, so the instructions match the current 500 MB code.

## Technical notes
- Files to update:
  - `supabase/functions/sync-vendor-to-dms/index.ts`
  - `middleware/server.js`
  - `middleware/.env.example`
  - `middleware/README.md`
- No database schema changes are required.
- The current Windows log still suggests an old middleware copy may be running if it does not print `Middleware build: dms-large-upload-v3` and `Body limit: 500mb`.