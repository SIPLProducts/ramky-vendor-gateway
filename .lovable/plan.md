## Change

Currently only the MSME certificate flows into the SAP `UPLOAD` array. Extend the whitelist to **all uploaded vendor documents** (GST certificate, GST self-declaration, PAN card, cancelled cheque 1 & 2, MSME certificate, MSME self-declaration, financials, dealership, IEC, SWIFT/IBAN proof, incorporation, other) using the existing `DOC_NAME_MAP` doctype codes.

## Files

1. **`src/lib/sapPayloadBuilder.ts`** — `buildUploads`: drop the `document_type = 'msme_certificate'` filter and the `.limit(1)`; iterate **all** rows from `vendor_documents` for the vendor, ordered by `uploaded_at desc`. Per row: skip if `file_size > MAX_UPLOAD_BYTES` (push to `skipped`), download from `vendor-documents`, base64-encode, push `{ FILE_NAME, FILE, FILE_PATH }`. Keep the per-file try/catch.

2. **`supabase/functions/sync-vendor-to-sap/index.ts`** —
   - `buildUploadArray`: same change — fetch all `vendor_documents` for the vendor (no `document_type` filter, no `limit(1)`), loop through them with the existing per-file size cap + download + base64 logic.
   - Client-supplied payload path: call `buildUploadArray` **unconditionally** (not gated on `effMsmeNo`) so non-MSME vendors still get their docs attached. Keep `row.UPLOAD = uploads`.
   - Legacy server-side path: same — call `buildUploadArray` unconditionally, drop the `effMsmeNo2` gate.

## Out of scope

- No schema changes, no UI changes, no change to the bulk-sync edge function.
- `DOC_NAME_MAP` already covers every `document_type` we save; no new mappings needed.
- Total request size: each file is still capped at 10 MB individually. If the cumulative payload exceeds the SAP middleware limit in practice, we'll address it separately (e.g., chunked uploads) — not part of this change.
