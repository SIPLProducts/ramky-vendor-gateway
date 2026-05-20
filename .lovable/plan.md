## Goal

Make the **GST Compliance Report** tab in View Details show the **real** Financial Year / Tax Period / Date of filing / Status rows returned by Surepass during vendor registration, instead of the synthetic placeholder rows that appear today.

## Root cause

- `GstKycTab` calls the configured GST provider (Surepass) via `kyc-api-execute` and receives `filing_status` in the response, but only stores it in local React state (`filingStatusRows`). Nothing is written to `vendor_validations`.
- Later, `useVendorRegistration.runValidations()` calls the `validate-gst` edge function (simulator) and inserts a `vendor_validations` row with `validation_type='gst'` whose `details` payload has no `filing_status` key.
- `VendorReviewDialog` reads `vendor_validations.details.filing_status`, finds nothing, and falls back to the synthetic 3-row generator in `buildGstComplianceReport`.

Net effect: the table renders, but every row is fake.

## Changes

### 1. Persist the Surepass GST response on inline verify
**File:** `src/components/vendor/kyc/GstKycTab.tsx`

- After `handleManualVerify` / `handleOcrVerify` succeed AND `props.vendorId` is set, upsert one row into `vendor_validations`:
  - `vendor_id`: `props.vendorId`
  - `validation_type`: `'gst'`
  - `status`: `'passed'`
  - `message`: verified message
  - `details`: the **full provider data** (`r.data` from `useProviderVerify`), which already contains `filing_status`, `legal_name`, `gstin`, etc.
- Delete any older `gst` row for the same vendor first (mirrors existing pattern used elsewhere) so the new row wins ordering.
- Wrap in try/catch — failure to persist must not block the registration flow.

### 2. Stop overwriting the rich row during final submit
**File:** `src/hooks/useVendorRegistration.tsx` (around lines 980-1010, the `validate-gst` branch)

- Before invoking `verify-gst`/`validate-gst`, call `hasRecentValidation('gst')` — this already exists. Extend the "reuse existing" branch so that when the existing row's `details.filing_status` is present, we **do not** re-run the simulator and do **not** insert a new row (the inline Surepass row stays as the source of truth).
- Only run the legacy simulator when no inline verification result exists.

### 3. Optional: surface real `complianceScore` / `lastFiledReturn`
**File:** `src/components/vendor/VendorReviewDialog.tsx`

- `buildGstComplianceReport` already prefers real data when present. Once step 1 lands, `details.filing_status` populates and the synthetic fallback no longer triggers — no code change required here.
- Keep the existing fallback so vendors registered before this change still render something.

### 4. No DB migration, no edge function change
- `vendor_validations.details` is already `jsonb`; storing the Surepass payload as-is is supported.
- No new tables, no new providers.

## Files touched

- `src/components/vendor/kyc/GstKycTab.tsx` — persist Surepass `r.data` into `vendor_validations` after successful inline verify.
- `src/hooks/useVendorRegistration.tsx` — skip the simulator overwrite when a real `gst` validation row already exists.

## Verification

1. Register a vendor with a real GSTIN, complete the GST tab. Confirm a `vendor_validations` row of type `gst` exists with `details.filing_status` populated.
2. Open **View Details → GST Compliance Report**. The table should show the actual Financial Year / Tax Period / Date of filing / Status rows from Surepass (last 3 periods, GSTR3B preferred), not the synthetic ones.
3. Open an older vendor (registered before the change) — the synthetic fallback still renders so the tab is never empty.
