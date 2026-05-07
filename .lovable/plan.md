## Add UPLOAD array (file_name + base64 + path) to SAP sync payload

### Background — what already exists

- All vendor uploads (PAN, GST cert, GST self-declaration, MSME cert, cancelled cheque #1, cancelled cheque #2, financial docs, dealership certificate, etc.) are uploaded to the `vendor-documents` Supabase Storage bucket and indexed in `public.vendor_documents` (vendor_id, document_type, file_name, file_path, mime_type, …) — see `src/hooks/useVendorRegistration.tsx` (`uploadAllDocuments` / `saveDocumentMetadata`).
- The Approval screen "View" dialog already has a **Documents** tab that lists every row from `vendor_documents` with preview + download (added in the previous round via `StageApprovalView.tsx` + `VendorDocuments.tsx`). Nothing to redo there — only verifying the new `cancelled_cheque_2` and any other types render with friendly labels.

So the only missing piece is: **the SAP BP-create payload does not yet send the uploaded files**. Right now `buildPayload(vendor)` in `supabase/functions/sync-vendor-to-sap/index.ts` returns a single object with no `UPLOAD` key.

### Change 1 — extend SAP payload with `UPLOAD` array

In `supabase/functions/sync-vendor-to-sap/index.ts`:

1. After loading the vendor, query `vendor_documents` for that `vendor_id`.
2. For each row, download the binary from Storage:
   ```ts
   const { data: blob } = await supabase.storage
     .from('vendor-documents')
     .download(file_path);
   ```
   Convert the blob to base64 (chunked to avoid stack overflow on large files).
3. Map each `document_type` to the SAP-friendly **FILE_NAME** the user requested:

   | document_type           | FILE_NAME (sent to SAP) |
   |-------------------------|-------------------------|
   | pan_card                | pan                     |
   | gst_certificate         | gst                     |
   | gst_self_declaration    | gst_self_declaration    |
   | msme_certificate        | msme                    |
   | cancelled_cheque        | bank_cheque1            |
   | cancelled_cheque_2      | bank_cheque2            |
   | financial_docs          | financials              |
   | dealership_certificate  | dealership              |
   | iec_certificate         | iec                     |
   | swift_iban_proof        | swift_iban              |
   | incorporation_certificate | incorporation         |
   | other                   | other                   |

   (Unknown types fall back to `document_type` itself.)
4. Build each entry as:
   ```json
   { "FILE_NAME": "pan", "FILE": "<base64>", "FILE_PATH": "<vendor_documents.file_path>" }
   ```
5. Add `UPLOAD: [...]` to the row returned by `buildPayload`. Empty array if vendor has no docs.

Guardrails:
- Skip files larger than ~10 MB and log a warning (base64 + Edge Function memory limit).
- Wrap document fetch in try/catch per file so one bad file doesn't break the whole sync; failed files are omitted and reported in the response message.
- Keep `payload` as `[ row ]` (array-of-one) — existing SAP contract.

### Change 2 — pass `vendor` row + supabase client into builder

`buildPayload` becomes `async buildPayload(vendor, supabase)` (or a separate `buildUploads(...)` helper called inside `serve`). Same call site, just `await`ed.

### Change 3 — minor: friendly labels (sanity check)

`src/components/vendor/VendorDocuments.tsx` already has labels for all current document types. No code change needed unless we discover a missing key during testing.

### Out of scope

- Re-uploading docs from the approval screen (the dialog only views/downloads).
- Streaming very large files — keeping the 10 MB cap is consistent with existing upload limits.
- Changing storage layout or adding a second storage bucket.

### Files touched

- `supabase/functions/sync-vendor-to-sap/index.ts` — add `UPLOAD` array with FILE_NAME + base64 + FILE_PATH.

That's it — registration-side persistence and approval-side viewing are already wired up from the previous round; this round just makes those same files flow into the SAP payload as the user specified.