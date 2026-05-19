# Bind real SAP DMS upload in the SAP Sync screen

The DMS Sync tab and `sync-vendor-to-dms` edge function already exist but currently send a custom payload (`UPLOAD: [{FILE_NAME, FILE, FILE_PATH}]`) and the middleware has no DMS route — so it always falls through to "simulated" mode. The actual SAP endpoint you shared expects a different shape and returns the classic SAP `MSGTYP`/`MSG`/`BP_LIFNR` array.

## SAP contract (confirmed from your message)

- **URL:** `http://10.200.1.2:8000/vendor/bp/create?sap-client=300` (DMS upload — same host as BP create, configurable)
- **Method:** POST, Basic Auth
- **Request:**
  ```json
  { "BP_LIFNR": "1061301",
    "FILE_UPLOAD": [
      { "FILE": "BASE64", "FILE_PATH": "PATH1" },
      { "FILE": "BASE64", "FILE_PATH": "PATH2" }
    ] }
  ```
- **Response (array):**
  ```json
  [{ "BP_LIFNR":"0001061303","MSGTYP":"S","MSGNR":"200",
     "ERDAT":"2026-05-18","UZEIT":"18:57:22","UNAME":"22000208",
     "MSG":"File(s) Uploaded Successfully","BP_LIFNRX":"","BPNAME":"","PERNR":0,"EXCEL_ROW":0 }]
  ```
  Success = first item `MSGTYP === "S"`.

## Changes

### 1. `middleware/server.js` — add real DMS route
- New env vars: `SAP_DMS_API_URL` (defaults to `SAP_BP_API_URL` if unset), reuse `SAP_BP_USERNAME` / `SAP_BP_PASSWORD`.
- Add `POST /sap/dms/upload` (auth-guarded, mirrors `/sap/bp/create`):
  - Forwards JSON body verbatim with Basic Auth.
  - Returns `{ ok, sapStatus, durationMs, sapResponse }`.
- Update `/` index endpoint list + `.env.example`.

### 2. `supabase/functions/sync-vendor-to-dms/index.ts` — match SAP shape
- Build payload as `{ BP_LIFNR: vendor.sap_vendor_code, FILE_UPLOAD: [{ FILE, FILE_PATH }] }` (drop `UPLOAD`, `idnum`, `BPNAME`, `FILE_NAME`).
- Skip vendors without `sap_vendor_code` with a clear message ("Vendor not yet synced to SAP").
- Parse middleware response: unwrap `sapResponse`, accept either an array or single object; success when any row has `MSGTYP === "S"`.
- Capture `BP_LIFNR`, `MSG`, `MSGTYP`, `ERDAT`, `UZEIT` and return them per vendor in `results[].sap` so the UI can render them.
- Keep existing simulation fallback only when middleware URL is missing.

### 3. `src/pages/SAPSync.tsx` — show SAP fields in DMS result dialog
- In the DMS Sync Result dialog (lines 555–587), render the returned SAP fields per row: `BP_LIFNR`, `MSG`, `ERDAT UZEIT`, `MSGTYP` badge — same visual style as the SAP sync result dialog.

### 4. Documentation
- Append a short "DMS upload" section to `SAP_FIELD_MAPPING.md` documenting the new payload/response.

## Technical details

- No DB schema changes. `vendors.status` transitions stay: `dms_sync_pending → dms_synced` on success.
- No new secrets needed in Lovable Cloud — middleware reads `SAP_DMS_API_URL` from its own `.env` on the customer server.
- Existing audit log entry (`action: "dms_sync"`) extended with `sap_vendor_code` and `msg`.

## Out of scope

- No changes to BP create flow, vendor list, or storage buckets.
- No retry/queue logic — single-shot upload like today, just pointed at the real endpoint.
