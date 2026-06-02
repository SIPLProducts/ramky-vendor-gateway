## Root cause

When a vendor **re-uploads** a cancelled cheque and then completes the **manual bank verification** popup, the newly uploaded `File` reference is dropped from the form state. As a result, the **old (first) file** is what gets persisted to storage and to `vendor_documents`, which is what the Approval flow and DMS payload then read back.

Trace:

1. `DocumentVerificationStep.runDocFlow` (`src/components/vendor/steps/DocumentVerificationStep.tsx`)
   - On a successful upload+verify it stores `file` on `bankDoc` (line ~937–950).
   - On **OCR failure** / low confidence (lines ~869, 880, 891, 908) it sets `bankDoc` with only `fileName/fileSize/errorMessage` — `file` is lost.
2. `handleBankPopupSubmit` (line ~1285–1399) — the manual-entry success path that fires after the popup. The final `setDoc({...})` at line 1367 builds a fresh state with `fileName: "Manual ****"` and never carries `file` forward. So after manual verification, `bankDoc.file` is `undefined`.
3. `buildOutput` (line 1601): `out.cancelledChequeFile = bankDoc.status === "verified" ? (bankDoc.file ?? null) : null` → emits `null`.
4. `VendorRegistration.mergeVerifiedDataIntoForm` (line 617): `cancelledChequeFile: data.cancelledChequeFile ?? prev.bank.cancelledChequeFile` → falls back to the **previously uploaded file** still in `prev`.
5. `useVendorRegistration.uploadAllDocuments` then sees the OLD `File` and, via the dedupe check `existing.file_name === doc.file.name && existing.file_size === doc.file.size`, skips re-upload. `vendor_documents.file_path` keeps pointing to the first file, and `prepare-dms-payload` reads that old path.

The same shape can affect any document where the manual flow / failed-OCR popup is used, but the cheque is where it bites first because the manual popup is the standard recovery path.

## Fix

### 1. `src/components/vendor/steps/DocumentVerificationStep.tsx`

- Add two refs `lastBankFileRef` and `lastBankFile2Ref` (typed `useRef<File | null>(null)`).
- In `handleBankUpload(file)` and `handleBankUpload2(file)` set `lastBankFileRef.current = file` / `lastBankFile2Ref.current = file` **before** calling `runDocFlow`. Also clear the other ref appropriately when target changes.
- In `runDocFlow`, propagate `file` on every `setDoc({...})` call (uploading, preparing, ocr, verifying, failed branches) so the latest `File` object survives intermediate states. This is required so a re-upload that fails OCR still carries the new file forward.
- In `handleBankPopupSubmit`, when building the verified state (line ~1367), include:
  ```ts
  const lastFile = (target === "secondary" ? lastBankFile2Ref : lastBankFileRef).current;
  setDoc((prev) => ({
    status: "verified",
    file: lastFile ?? prev.file,        // preserve newest cheque file
    fileName: lastFile?.name || prev.fileName || `Manual ${apiAccount.slice(-4)}`,
    fileSize: lastFile?.size ?? prev.fileSize,
    ocrData: normalized,
    originalOcrData: normalized,
    apiData: { ... },
    nameMatchScore: nameMatchScore(effectiveLegalName, nameAtBank),
    verifiedAt: Date.now(),
  }));
  ```
- No other behavior changes; OCR-success path already attaches `file`.

### 2. `src/hooks/useVendorRegistration.tsx` — make dedupe safe against same-name replacements

In `uploadAllDocuments` (line ~180), the current dedupe is:
```ts
if (existing && existing.file_name === doc.file.name && existing.file_size === doc.file.size) continue;
```
A user can easily re-upload a different cheque named `cheque.pdf` with the same byte size (camera scans, re-exports). Replace it with an **upload-session identity** check using a `WeakSet<File>`:

- Add `const uploadedFilesRef = useRef<WeakSet<File>>(new WeakSet());` at hook scope.
- Skip only when `uploadedFilesRef.current.has(doc.file)`. Otherwise always: remove old storage object (already done), `uploadDocument`, `saveDocumentMetadata` (upsert on `vendor_id,document_type` — already correct), then `uploadedFilesRef.current.add(doc.file)`.
- This guarantees that any newly-selected `File` instance is treated as a replacement, while autosave running twice on the same unchanged `File` instance still skips re-uploading.

### 3. (No DB / RLS / migration / nginx changes required)

`vendor_documents` already has a unique `(vendor_id, document_type)` index used by the existing upsert. `prepare-dms-payload` reads the row keyed by that unique combination, so once the metadata `file_path` reflects the latest upload, DMS and the Approval flow automatically see the latest cheque.

## Validation

1. Vendor registration → upload cheque A → verify OK → save.
2. Re-upload cheque B (different content, same or different name) → if OCR fails, complete the manual entry popup → bank verification succeeds.
3. Check:
   - `vendor_documents` row for `cancelled_cheque` has `file_path` pointing to the **new** `Date.now()_*` object.
   - Storage bucket no longer contains the old object (deleted in the existing replacement branch).
   - Documents Approval view shows the new file.
   - `prepare-dms-payload` response includes the new file’s base64 bytes.
4. Regression: upload only once, save twice → no duplicate re-upload (WeakSet dedupes).

## Scope

Only the two files above change; no edge-function, schema, RLS, or nginx changes. All other registration steps and verifications are untouched.
