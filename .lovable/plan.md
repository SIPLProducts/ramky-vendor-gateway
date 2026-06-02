## Goal

Two fixes for the vendor registration flow:

1. **Latest verified data wins** — After a successful manual verification (Enter manually → Verify), DMS, the approval flow, and downstream validations must use the freshly verified values, not stale OCR data from a previously uploaded document.
2. **OCR auto-populate** — Data extracted from uploaded documents (GST certificate, PAN card, MSME, Bank cheque) should automatically populate the corresponding fields in the Vendor Registration Form (State, City, Address line, PIN code, GST Number, PAN Number, etc.) without breaking anything else.

Scope is strictly the OCR/manual-verify pipeline and field mapping into the form; existing approval gating, RLS, and SAP/DMS contracts are untouched.

---

## Option 1 — "Latest verified data wins"

### Where the staleness comes from
- `OcrUploadAndVerify` only writes verified data when the OCR path runs (`onVerified` → `onVerifiedDetails` in each KYC tab).
- `ManualEntryAndVerify` (GST/PAN/MSME/Bank) currently calls `verify()` which updates the verify *state* but does NOT call `onVerifiedDetails` for the tab → so:
  - The previously stored `vendor_validations` row from the older OCR run stays as the "verified" payload.
  - The previously uploaded document in `vendor_documents` still represents the "source" for that field, even though the user has now corrected the value manually.
- Result: DMS payload (`prepare-dms-payload` reads `vendor_documents`), approval views (vendor row + `vendor_validations`), and downstream validators all see the old document/value.

### Fix
- **GST / PAN / MSME / Bank manual-verify handlers** (`GstKycTab.handleManualVerify`, `PanKycTab`, `MsmeKycTab`, `BankKycTab` — only the manual paths):
  - On a successful manual verify, call the same `onVerifiedDetails(mergedApiData)` callback the OCR path uses, so the parent `ComplianceStep` re-maps verified fields into the form and `vendor_validations` is re-written with `source: 'manual'`.
- **`vendor_validations` write** (`persistGstValidation` and equivalents for PAN/MSME/Bank where they exist):
  - Always delete the existing row for `(vendor_id, validation_type)` and re-insert with the latest payload, marking `details.source = 'manual' | 'ocr'` and `details.verified_at = now()`. This guarantees readers see only the most recent verification.
- **Stale document handling** (`useVendorRegistration.uploadAllDocuments`):
  - When manual verification succeeds for a field AND the user has not re-uploaded a corresponding document, soft-mark the existing `vendor_documents` row with `details: { superseded_by: 'manual_verification' }` (added to existing `vendor_documents.metadata` JSONB if present, otherwise a small migration adds `metadata jsonb`). Skip the upload of any cached file that predates the manual verification timestamp.
  - DMS edge (`prepare-dms-payload`) gets a tiny tweak: filter out docs where `metadata->>'superseded_by'` is set, so the old OCR'd file is no longer included in the FILE_UPLOAD array.
- **Approval flow read paths** (`StageApprovalView`, vendor detail dialogs): no logic change needed — they already render `vendors` table fields (which we now keep current) and `vendor_validations` (which we now always refresh).

### Validation
- Upload an old GST certificate → verify (OCR) → values appear.
- Switch to "Enter manually", type a corrected GSTIN → click Verify.
- Confirm: form fields update, `vendor_validations.gst` row replaced, `prepare-dms-payload` returns no old certificate, approval view shows new values.

---

## Option 2 — OCR auto-populate of form fields

### Current behavior
- OCR data flows into the KYC tab's verify result, but `ComplianceStep.handleGstVerified` / `handleMsmeVerified` only populates GST-specific and MSME-specific compliance fields.
- The user expects extracted data (e.g., State, City, Address, PIN code) to also fill the **Address step** and the visible **GST Number / PAN Number** fields.

### Mapping (added to existing `onVerifiedDetails` handlers — no schema changes)

`ComplianceStep` already owns the form and has access to `setValue`. We extend its handlers and lift a new callback up to `VendorRegistration` so it can also patch the `AddressDetails` slice when the registered address is still blank.

GST extracted fields → form fields:
```
gstin                              → statutory.gstin
legal_name                         → organization.legalName (only if empty)
trade_name | business_name         → organization.tradeName (only if empty)
pan_number                         → statutory.pan
principal_place_of_business.*      → address.registeredAddress / city / state / pincode
                                     (only when the matching field is currently empty;
                                      never overwrite values the user has typed)
state_jurisdiction                 → address.registeredState fallback
```

PAN extracted fields → form fields:
```
pan_number                         → statutory.pan
full_name | holder_name            → contact.ceoName (only if empty)
```

MSME extracted fields → form fields (already partially wired):
```
state / district / city / pin_code → address.registeredState / City / Pincode (fallback only)
flat + building + road + village   → address.registeredAddress (fallback only)
```

Bank extracted fields:
```
account_holder_name                → already captured into vendor.bank
bank_name / branch_name / ifsc     → already captured
```

### Implementation
- Add a `onFormFieldsExtracted(patch: Partial<VendorFormData>)` prop to `ComplianceStep`.
- `VendorRegistration` (parent) merges the patch into its `formData` state with a "fill-only-if-empty" rule, then the existing autosave persists it.
- Update `GstKycTab.handleOcrVerify` / `runGstOcr` and `PanKycTab`/`MsmeKycTab` so that `onVerifiedDetails` receives the full merged extracted payload (already true for GST and PAN; verify for MSME/Bank).
- Add a small helper `applyExtractedToForm(formData, extracted, mapping)` in `src/lib/kycExtract.ts` that performs the "fill-only-if-empty" merge using the mapping above.
- All edits stay in frontend; no DB migration required for Option 2.

### Validation
- Upload a fresh GST certificate → after verification: GSTIN, PAN, Legal Name (if blank), Trade Name (if blank), and the registered Address/State/City/PIN are populated. Existing typed values are preserved.
- Upload PAN card → PAN number auto-fills; CEO name fills only if blank.
- Manual edits made after OCR remain intact on subsequent re-verifies.

---

## Files touched

Frontend (Option 1 + Option 2)
- `src/components/vendor/kyc/GstKycTab.tsx`
- `src/components/vendor/kyc/PanKycTab.tsx`
- `src/components/vendor/kyc/MsmeKycTab.tsx`
- `src/components/vendor/kyc/BankKycTab.tsx`
- `src/components/vendor/kyc/ManualEntryAndVerify.tsx` (only if we need to surface verified payload back)
- `src/components/vendor/steps/ComplianceStep.tsx`
- `src/pages/VendorRegistration.tsx` (pass-through `onFormFieldsExtracted`)
- `src/hooks/useVendorRegistration.tsx` (mark superseded documents)
- `src/lib/kycExtract.ts` (new `applyExtractedToForm` helper + map)

Backend (Option 1 only)
- `supabase/functions/prepare-dms-payload/index.ts` — filter out superseded documents.
- One small migration: add `metadata jsonb default '{}'::jsonb` to `vendor_documents` if it doesn't already exist.

No changes to RLS, approval workflow, SAP sync logic, or any other unrelated functionality.