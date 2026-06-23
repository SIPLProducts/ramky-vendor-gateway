## 1) Validate Primary vs Secondary Account Holder Name (cancelled cheques)

**Where:** `src/components/vendor/steps/DocumentVerificationStep.tsx` — secondary cheque upload flow (`handleBankUpload2`) and the manual-bank popup submit (`handleBankPopupSubmit` when `target === "secondary"`).

**Logic:**
- After the secondary cheque is OCR-verified (or manual flow returns a `nameAtBank`), read the primary holder name from `bankDoc.ocrData?.account_holder_name` (or `bankDoc.apiData?.accountHolderName`).
- Normalize both names (uppercase, collapse whitespace, strip punctuation, drop common salutations like MR/MRS/M/S).
- If primary is set and the two names do not match (exact normalized match, fall back to >=90% similarity via the existing `nameMatchScore`/cross-match helper already imported in the file), then:
  - Show SweetAlert2: `Swal.fire({ icon: 'error', title: 'Account holder mismatch', text: 'Primary and Secondary Account Holder Names do not match.' })`.
  - Reset secondary state: `setBankDoc2(idleDoc)`, `lastBankFile2Ref.current = null`, `setBankBranchAutoFilled2(false)`, `setBankBranchAddress2('')`, and clear any other `*_2` secondary fields (account number / IFSC / bank name / branch already live in `bankDoc2.ocrData` which is cleared by resetting `bankDoc2`).
  - Also clear the file input element if a ref is available so the same file can be reselected.
- Run the same check inside `handleBankPopupSubmit` (target=secondary) before the `setDoc({ status: 'verified', ... })` call; if mismatch, abort with the same Swal + reset.
- `sweetalert2` (v11) is already in `package.json` — `import Swal from 'sweetalert2'`.

## 2) Show `VENDOR` instead of `BP_LIFNR` after SAP sync

**Edge function side** (`supabase/functions/sync-vendor-to-sap/index.ts`, `supabase/functions/sync-vendors-to-sap-bulk/index.ts`, `supabase/functions/prepare-dms-payload/index.ts` if it forwards the value):
- When parsing the SAP response, if the row contains a `VENDOR` field, copy it onto `BP_LIFNR` (or add a new `VENDOR` property to each `ACC_RES` row) so the client receives both. Prefer `VENDOR` when present, fall back to `BP_LIFNR`.
- Set `sapVendorCode` from `match?.VENDOR ?? match?.BP_LIFNR`.

**Client side:**
- `src/pages/SAPSync.tsx` — replace `r.BP_LIFNR` reads at lines 699, 737, 772, 776–777 with `r.VENDOR ?? r.BP_LIFNR` and rename the visible label from "BP_LIFNR" to "Vendor Code" (line 777). Same fallback for `r.sap?.VENDOR ?? r.sap?.BP_LIFNR`.
- `src/hooks/useVendors.tsx` — in `useDMSSync` (lines 690–701), check `payload.VENDOR || payload.BP_LIFNR`; in audit-log `details.sap_vendor_code` already uses `sapResult.sapVendorCode` which now comes from VENDOR.
- The `vendors.sap_vendor_code` DB column already stores whatever `sapVendorCode` resolves to — no schema change needed; it will simply start holding the `VENDOR` value.

**Tables affected (display only):** SAP Sync result dialogs (single, bulk, DMS), `VendorList.tsx` "SAP Code" column — already reads `sap_vendor_code`, so it picks up VENDOR automatically once the edge function updates the source.

## 3) Documents "missing in storage" in SAP Sync → View

**Diagnosis steps (read-only):**
- Query `vendor_documents` for the affected vendor(s) and list rows whose `file_path` does not have a matching object in the `vendor-documents` bucket.
- Likely causes already known to the code path:
  - `uploadAllDocuments` deletes the old storage object before upserting the new one (line 230). If the subsequent `uploadDocument` throws after the delete, the row is left pointing to a now-missing file. Wrap the delete inside a try and only delete after the new upload succeeds (delete-after-success swap), OR delete only after `saveDocumentMetadata` succeeds. Safer pattern: upload new under a fresh path, update metadata, then delete the old object.
  - Some vendors were seeded without a corresponding storage upload (sample/migration data). For those, the only fix is to re-upload.
- Add a one-off admin script/edge function `audit-vendor-documents` that lists orphan rows (DB row exists but `storage.from('vendor-documents').download(file_path)` 404s) so support can identify which vendors must re-upload.

**Code fix in `src/hooks/useVendorRegistration.tsx` (`uploadAllDocuments`):**
- Reorder: (1) upload new file to a fresh path, (2) `upsert` metadata row to the new path, (3) only then remove the previous storage object. This guarantees the DB row always points to an existing file.

**UI:** Per earlier confirmed preference, keep the View/Download buttons and the existing toast in `VendorDocuments.tsx` (no change). The toast will simply stop firing once new uploads use the swap order and orphans are re-uploaded.

## Out of scope
- No schema changes; no RLS changes; no rename of the `sap_vendor_code` column.
- Re-uploading historical orphan files is a data task for the affected vendors (or admin re-upload) — not a code change.
