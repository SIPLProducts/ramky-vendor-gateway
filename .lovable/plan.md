## Goal

When any KYC document (GST / PAN / MSME / Bank cheque) is uploaded or re-uploaded, the latest OCR + verification result must:
1. Auto-populate the corresponding fields in the Vendor Registration Form (already partially works).
2. Remain editable by the vendor for review/correction.
3. Replace the previous file + extracted values everywhere downstream — Documents Approval, DMS payload, and SAP Sync.

## What works today

- `ComplianceStep.tsx` already wires `onVerifiedDetails` from each KYC tab into `setValue(...)` calls that fill GST / PAN / MSME / Bank fields.
- `VendorRegistration.tsx` → `mergeVerifiedDataIntoForm` already lifts data into `formData.organization / address / statutory / bank`.
- The earlier fix (WeakSet dedupe in `useVendorRegistration.uploadAllDocuments` + lastFileRef in `DocumentVerificationStep`) ensures the newest `File` reaches storage on re-upload.

## What still breaks

1. On re-upload, the KYC tabs run a fresh OCR → verify pipeline but the merger in `VendorRegistration.tsx` uses `newValue || prevValue`. Empty-string fields returned by the new OCR keep the **old** value instead of clearing it, so stale data persists when the new doc legitimately has fewer fields.
2. `ComplianceStep.handle*Verified` handlers use `if (value) setValue(...)` — same issue: fields the new document does not contain stay at the old extracted value.
3. The "latest file always wins" guarantee for `vendor_documents` exists for the `DocumentVerificationStep` path but not for the new KYC-tab path (`ComplianceStep` does not push a per-doc replacement marker into `useVendorRegistration`'s `uploadedFilesRef`). Re-uploading from the KYC tab can leave a stale row pointer.
4. `prepare-dms-payload` and `sync-vendor-to-sap` read from the latest `vendor_documents` row, so once (3) is fixed they automatically reflect the newest file.

## Plan

### 1. Track which document was last extracted (frontend, no DB)
In each KYC tab (`GstKycTab`, `PanKycTab`, `MsmeKycTab`, `BankKycTab`), when a new OCR pipeline run starts:
- Stamp the verified payload with a monotonic `extractedAt: Date.now()` and the new `File` reference.
- Pass the full extracted object (not just the few mapped fields) up via `onVerifiedDetails`.

### 2. Make `handle*Verified` in `ComplianceStep.tsx` overwrite, not OR-merge
Change `if (v) setValue(k, v)` to always call `setValue(k, v ?? '')` for fields that belong to the document being re-verified. This ensures a re-uploaded doc with a missing field clears the stale prior value instead of silently keeping it. Manual user edits made AFTER the latest verification are preserved because they happen later than the auto-fill.

### 3. Same overwrite semantics in `mergeVerifiedDataIntoForm`
In `src/pages/VendorRegistration.tsx`, replace the `data.x || prev.x` pattern with explicit "if this section was just re-verified, take the new value (even if empty); otherwise keep prev." Use the per-section `status === 'verified'` flag plus a `lastExtractedAt` timestamp from `VerifiedDocumentData` to decide which section to overwrite, so re-verifying GST doesn't clear PAN fields and vice-versa.

### 4. Force the latest `File` into upload
In `src/hooks/useVendorRegistration.tsx` `uploadAllDocuments`, additionally key the dedupe `WeakSet` by `(documentType + File identity)`. When a `documentType` appears with a NEW `File` instance, evict the old reference before upload so the same doc type can replace its row in `vendor_documents` (already a unique key on `(vendor_id, document_type)`, so the existing `upsert` overwrites `file_path`).

### 5. Verify downstream automatically picks up the latest
No edge-function code change is needed:
- `prepare-dms-payload` already selects the latest `vendor_documents` row per `document_type`.
- `sync-vendor-to-sap` reads the same row, so DMS link + SAP payload will reflect the most recent upload once (4) is in place.

Spot-check both functions to confirm there is no caching keyed off file name, and add a single `order by updated_at desc limit 1` guard if any query is ambiguous.

## Files to change

- `src/components/vendor/kyc/GstKycTab.tsx`
- `src/components/vendor/kyc/PanKycTab.tsx`
- `src/components/vendor/kyc/MsmeKycTab.tsx`
- `src/components/vendor/kyc/BankKycTab.tsx`
- `src/components/vendor/steps/ComplianceStep.tsx`
- `src/pages/VendorRegistration.tsx`
- `src/hooks/useVendorRegistration.tsx`
- (Read-only verify) `supabase/functions/prepare-dms-payload/index.ts`, `supabase/functions/sync-vendor-to-sap/index.ts`

## Out of scope

- International documents step (no OCR provider wired today).
- DynamicStep custom file fields (no OCR mapping configured).
- DB schema changes — none required; `vendor_documents` unique `(vendor_id, document_type)` already supports replacement via upsert.

## Validation

1. Upload GST cert A → fields populate → re-upload GST cert B → fields update to B (including fields that A had but B does not — they clear).
2. Manually edit Legal Name after auto-fill → save draft → re-open: edited value persists.
3. Re-upload cheque → `vendor_documents.cancelled_cheque.file_path` points to new object, old storage object replaced, Documents Approval shows new file, `prepare-dms-payload` returns new bytes, SAP Sync payload references new file.
4. Regression: uploading once, autosaving twice without changes → no duplicate storage writes (WeakSet still dedupes same `File`).
