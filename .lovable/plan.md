## Issue 1 — Uploaded documents not showing in "View Details"

### Root cause
There's a path mismatch between the **upload code** and the **storage RLS policy**:

- Upload code (`FileUpload.tsx` line 75 and `useVendorRegistration.tsx` line 102) writes files under `{vendorId}/...`
- Storage policy (`20260106174157...sql`) requires `auth.uid()::text = (storage.foldername(name))[1]` — i.e. the first folder must equal the **logged-in user's UID**, not the vendor row id.

Result: every storage upload from a real submission is rejected by RLS. The error is only `console.error`-logged (`useVendorRegistration` line 109) and the form continues. For seeded mock vendors the metadata rows were inserted via SQL, so the View Details panel can list them — but for any actual submission, both the storage object **and** the metadata row are missing (confirmed: `storage.objects` for bucket `vendor-documents` is empty; `vendor_documents` count for every real `SHARVI INFOTECH` vendor row is 0).

A secondary contributor: `FileUpload.uploadToStorage` uploads immediately when `vendorId` is passed (already wrong path), and `useVendorRegistration.uploadAllDocuments` re-uploads on save (also wrong path). Neither surfaces failures to the user.

### Fix
1. **Change the storage path convention to `{vendorId}/{documentType}/{filename}`** and update the storage RLS policy so authenticated users with `vendor`, `purchase`, `finance`, `scm_*`, `admin`, or `sharvi_admin` roles can read, and the owning vendor (matched via the `vendors` table) can write — instead of comparing folder name to `auth.uid()`.
   - New migration: drop the four `auth.uid() = foldername[1]` policies; recreate them with:
     - INSERT/UPDATE/DELETE allowed when `EXISTS (SELECT 1 FROM vendors v WHERE v.id::text = (storage.foldername(name))[1] AND (v.user_id = auth.uid() OR v.primary_email = auth.email()))`.
     - SELECT allowed for the vendor owner OR any user with an approver/admin role (`has_role` for `purchase`, `finance`, `admin`, `sharvi_admin`, `scm_manager`, `scm_head`, `finance_1`, `finance_2`, `ceo_office`, `sap_team`).
2. **Stop double-uploading** in `FileUpload.tsx` — make it a pure file picker (validate + preview + call `onFileSelect`); let `useVendorRegistration.uploadAllDocuments` be the single source of truth for storage writes.
3. **Surface failures**: in `uploadDocument` / `saveDocumentMetadata`, throw on error so `saveVendorMutation` toasts a real error instead of silently dropping the file.
4. **Backfill check**: leave existing seeded `vendor_documents` rows alone (they still resolve to non-existent objects, but won't break the list view).

### Out of scope
Re-uploading any documents the user already attempted to submit before this fix — those bytes never reached storage and must be re-uploaded after the fix ships.

## Issue 2 — Remove Approve/Reject from "View Details" dialog

In `src/pages/PurchaseApproval.tsx` (the SCM Approval page in the screenshot), remove the `DialogFooter` block at lines 440-443 that renders the two buttons inside the Vendor Details dialog. The Approve/Reject actions remain available on the vendor row in the list, so functionality isn't lost.

## Files changed
- `supabase/migrations/<new>.sql` — new storage policies for `vendor-documents`
- `src/components/vendor/FileUpload.tsx` — remove inline storage upload
- `src/hooks/useVendorRegistration.tsx` — throw on upload/metadata errors; standardize path to `{vendorId}/{documentType}/{filename}`
- `src/pages/PurchaseApproval.tsx` — remove Approve/Reject buttons from details dialog footer
