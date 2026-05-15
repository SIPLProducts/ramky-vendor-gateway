## Root cause

Every time the vendor form is saved (autosave + step nav + submit), `uploadAllDocuments` in `src/hooks/useVendorRegistration.tsx` runs again. For each `documentType` whose `formData...File` is set, it:

1. Re-uploads the file to storage with a new timestamped path.
2. Inserts a brand new row into `vendor_documents`.

There is no check for an existing row of the same `(vendor_id, document_type)`. For Brickwork Ratings the same 4 files (gst_self_declaration, pan_card, msme_self_declaration, cancelled_cheque) were inserted ~30+ times → 122 documents shown in the dialog.

## Plan

1. **Deduplicate document uploads in `useVendorRegistration.tsx`**
   - In `uploadAllDocuments`, before re-uploading a `documentType`, query `vendor_documents` for an existing row with the same `vendor_id` + `document_type`.
   - If a row exists and the in-memory `File` is the same one already uploaded (track an "uploaded" flag per file in component state, or compare `file_name` + `file_size`), skip both the storage upload and the metadata insert.
   - If the user replaced the file (different name/size), delete the old storage object + old `vendor_documents` row, then upload the new one.
   - Result: at most one row per `(vendor_id, document_type)` (two for the secondary cancelled cheque slot).

2. **Mark file fields as "already uploaded" after first successful save**
   - After `uploadAllDocuments` succeeds, clear the in-memory `File` objects from `formData.statutory.*File`, `formData.bank.*File`, etc., so subsequent autosaves do not see a `File` to re-upload. The metadata in `vendor_documents` is the source of truth for "already uploaded".
   - Loaded vendor records already do not rehydrate `File` objects, so this only affects the current edit session.

3. **One-time cleanup of existing duplicate rows**
   - Add a migration that, for each `(vendor_id, document_type)` group in `vendor_documents`, keeps the most recent row and deletes the rest. Same for storage objects under `vendor-documents` bucket (delete orphaned files whose paths are not referenced by any remaining `vendor_documents` row).
   - This will fix the Brickwork Ratings vendor (122 → ~4 documents) and any other affected vendors.

4. **Optional safety net (DB-level)**
   - Add a partial unique index on `vendor_documents (vendor_id, document_type)` (excluding the secondary cheque slot, or include it because it has its own type `cancelled_cheque_2`). This guarantees the bug cannot reappear even if another code path forgets to dedupe.

## Files to change

- `src/hooks/useVendorRegistration.tsx` — dedup logic in `uploadAllDocuments`, clear file refs after upload.
- New SQL migration — cleanup duplicate `vendor_documents` rows + add unique index on `(vendor_id, document_type)`.
- (Optional) cleanup of orphaned storage objects via the migration or an edge function.

## Verification

- Re-open Brickwork Ratings → Documents tab should show 4 files, not 122.
- Save the form multiple times → `vendor_documents` count stays the same.
- Replace a file and save → old row replaced, count still stable.
