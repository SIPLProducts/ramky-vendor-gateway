## Problem

Two separate gaps make MSME data disappear from the SAP payload:

1. **MSME certificate file** is uploaded to Documents but never reaches the SAP `UPLOAD` array. Both the client builder (`src/lib/sapPayloadBuilder.ts` line ~342) and the edge function (`supabase/functions/sync-vendor-to-sap/index.ts` lines ~416 and ~519) hard-code `row.UPLOAD = []`. This was done to avoid SAP middleware 413 (payload too large) when attaching every document. MSME alone is a single small file, safe to include.

2. **MSME field values** (`msme` flag, `idnum2`, `IDCATG`) come only from `vendors.is_msme_registered` / `vendors.msme_number` / `vendors.msme_major_activity`. On recent test vendors these columns are `false` / `null`, and the SAP Sync popup has no MSME inputs — so the SAP team has no way to enter/correct them at push time. They render as empty in the payload.

## Fix

### 1. Attach MSME certificate to `UPLOAD` (single-file whitelist)

Both code paths build an `UPLOAD` array containing **only** the latest `msme_certificate` from `vendor_documents`, base64-encoded, capped at the existing `MAX_UPLOAD_BYTES` (10 MB). All other document types remain excluded.

Each upload entry follows the existing shape used elsewhere in the edge function:

```json
{ "doctype": "msme", "filename": "...", "mimetype": "...", "filedata": "<base64>" }
```

- `src/lib/sapPayloadBuilder.ts`: replace the stub `buildUploads` (currently returns `[]`) with a fetch of vendor_documents filtered to `document_type = 'msme_certificate'`, download from the `vendor-documents` storage bucket, base64-encode, push one entry. Remove the `row.UPLOAD = []` override so the template's `{{uploads}}` value is preserved.
- `supabase/functions/sync-vendor-to-sap/index.ts`: same logic in `buildUploadArray` (already scaffolded — just narrow it to `msme_certificate` and stop forcing `row.UPLOAD = []` at lines ~416 and ~519). Skip silently if no MSME doc exists or file exceeds the cap (push to `skipped[]`).

### 2. Add MSME inputs to the SAP Sync confirmation popup

Mirror the Contact 2 / Email 2 / Address pattern just shipped:

| Popup field          | Override key   | Vendor field overwritten     |
|----------------------|----------------|------------------------------|
| MSME Registered (Y/N)| `reg_is_msme`  | `is_msme_registered`         |
| MSME Number          | `reg_msme_no`  | `msme_number`                |
| MSME Major Activity  | `reg_msme_act` | `msme_major_activity`        |

Changes:

- `src/components/.../SapFieldConfirmation.tsx` (the popup): add a small "MSME" section with these three controls, prefilled from the vendor row, and include the three `reg_*` keys in the `overrides` object passed to `buildSapPayload`.
- `src/lib/sapPayloadBuilder.ts` `buildSapPayload`: in the existing `vendorForPayload` overlay block, copy `reg_is_msme` → `is_msme_registered`, `reg_msme_no` → `msme_number`, `reg_msme_act` → `msme_major_activity`. After overlay, recompute `isMsme = !!vendorForPayload.msme_number` so `msme_flag` / `idnum2` / `IDCATG` pick up the popup values.

### Scope / non-goals

- No schema changes.
- No change to the bulk sync edge function (`sync-vendors-to-sap-bulk`) — popup-driven push only, same boundary as the previous Contact 2 / Email 2 fix.
- Other document types stay excluded from `UPLOAD` to keep the request under SAP middleware limits.

## Files touched

- `src/lib/sapPayloadBuilder.ts` — real MSME upload fetch + MSME override overlay; drop `row.UPLOAD = []`.
- `supabase/functions/sync-vendor-to-sap/index.ts` — same MSME upload fetch; drop the two `row.UPLOAD = []` overrides.
- `src/components/.../SapFieldConfirmation.tsx` — MSME section + 3 override keys (exact file path confirmed when editing).
