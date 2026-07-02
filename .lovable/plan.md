## Goal
Make Edit Vendor Registration behave identically to a saved/in-progress registration: every field and every uploaded document that was saved must appear in the form on reopen, and each document must be viewable, downloadable, and replaceable.

## What's already correct
- `useVendorRegistration.existingFormData` already rebuilds most text fields from the `vendors` row and attaches persisted documents (GST cert, GST self‑declaration, PAN card, MSME cert, MSME self‑declaration, cancelled cheques, financial docs, dealership cert) as `PersistedDocumentFile` placeholders (name + size + `filePath`).
- `VendorRegistration.tsx` hydrates `formData` from `existingFormData` on `returned_to_vendor` / `returned_to_buyer` and lands the user on Review.

## What's broken
1. **Step 1 (Document Verification) does not receive persisted documents.** The `verifiedData` object built in `VendorRegistration.tsx` (the `useEffect` on `existingFormData`) omits:
   - `isGstRegistered`, `gstDeclarationReason`, `gstSelfDeclarationFile`
   - `isMsmeRegistered`, `msmeDeclarationReason`, `msmeSelfDeclarationFile`
   - `gstCertificateFile`, `panCardFile`, `msmeCertificateFile`, `cancelledChequeFile`, `cancelledChequeFile2`
   So on reopen: GST=No hides the saved declaration, MSME=No hides the saved declaration, and no GST/PAN/MSME/Bank certificate tile shows the previously uploaded file.
2. **`DocumentVerificationStep` doesn't seed the `file` slot of each doc tile.** `gstDoc` / `panDoc` / `msmeDoc` / `bankDoc` initial state sets `ocrData` from `initialData` but ignores the corresponding `*File` props (which are already declared on `VerifiedDocumentData`). Tiles render "no file uploaded" even though the DB has one.
3. **No View / Download for persisted files.** `PersistedDocumentFile` carries `filePath`, but no UI exposes a signed URL. Only `Replace` works today.
4. **Register step revisits (Organization / Address / Contact / Financial / Infra) rely solely on the initial `setFormData(existingFormData)` snapshot.** They already pick up hydrated values, so text fields are fine — the outstanding gap is only doc‑related (points 1–3). No changes needed to those step components beyond a spot‑check of the declaration‑file props on Organization/Compliance.

## Plan

### 1. Pass persisted docs into Step 1
In `src/pages/VendorRegistration.tsx`, extend the `verifiedData` seeded inside the `existingFormData` hydration effect to include, when present in `existingFormData.statutory` / `existingFormData.bank`:
- `isGstRegistered`, `gstDeclarationReason`, `gstSelfDeclarationFile`
- `isMsmeRegistered`, `msmeDeclarationReason`, `msmeSelfDeclarationFile`
- `gstCertificateFile`, `panCardFile`, `msmeCertificateFile`
- `cancelledChequeFile`, `cancelledChequeFile2` (secondary bank)

### 2. Seed file slots in Document Verification tiles
In `src/components/vendor/steps/DocumentVerificationStep.tsx`, when initial `DocState` is built for `gstDoc` / `panDoc` / `msmeDoc` / `bankDoc` (and secondary bank), also populate `file`, `fileName`, `fileSize`, and (new) `filePath` from `initialData.gstCertificateFile` / `panCardFile` / `msmeCertificateFile` / `cancelledChequeFile` / `cancelledChequeFile2`. Add `filePath?: string` to the internal `DocState` interface so signed URLs can be generated.

### 3. Add View / Download for persisted files
In the shared doc‑tile UI inside `DocumentVerificationStep.tsx` (`onReplace` block around lines 3163‑3250), add a View and Download action next to Replace when the doc has a `filePath`. Both call `supabase.storage.from('vendor-documents').createSignedUrl(filePath, 300)` — View opens in a new tab, Download triggers an anchor download. Replace continues to work as today; uploading a new file clears `filePath`.

### 4. Repeat the same View/Download affordance for the other steps' file inputs
The Organization/Compliance step already receives `gstCertificateFile`, `msmeCertificateFile`, `panCardFile`, `gstSelfDeclarationFile`, `msmeSelfDeclarationFile` via hydrated `formData.statutory`, and Financial receives `dealershipCertificateFile` / `financialDocsFile`, Bank has `cancelledChequeFile`. Where those steps render a file input, show file name + View + Download when the current value is a `PersistedDocumentFile` (has `__persistedDocument === true` and a `filePath`). Introduce a small shared helper component `PersistedFileActions` under `src/components/vendor/` to avoid duplication.

### 5. No changes to save/submit path
Persisted files with no user replacement should continue to skip re-upload — that already works via the `__persistedDocument` check in `saveVendor` (line 278 of the hook). Verify (read only) that clearing a persisted file (Remove) also removes it from `vendor_documents`.

### Technical notes
- `PersistedDocumentFile` (in `useVendorRegistration.tsx`) already exposes `filePath` — no schema change.
- Storage bucket `vendor-documents` is private → use `createSignedUrl` (5 min expiry) for both View and Download.
- Guard signed‑URL calls behind a `useState` loading flag per tile to prevent double clicks.
- No DB migration, no edge function change.

### Files touched
- `src/pages/VendorRegistration.tsx` — extend `verifiedData` seeding
- `src/components/vendor/steps/DocumentVerificationStep.tsx` — seed `file`/`filePath` in each `DocState`, add View/Download in the shared tile
- `src/components/vendor/steps/OrganizationStep.tsx`, `ComplianceStep.tsx`, `FinancialInfrastructureStep.tsx`, and the bank sections — wire `PersistedFileActions` next to their file inputs
- `src/components/vendor/PersistedFileActions.tsx` — new small helper
