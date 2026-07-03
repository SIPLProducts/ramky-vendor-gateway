## Problem

**Edit mode — Step 1 (Document Verification):**
- The GST Filing Status table is empty because the pre-seeded `verifiedData.gst` object in `VendorRegistration.tsx` (~L758) omits `filing_status`. `DocumentVerificationStep` already hydrates its `gstFilingRows` from `initialData.gst.filing_status` (it just never receives any).
- The persisted filing rows live in `vendor_validations.details.filing_status` (written by `useVendorRegistration.saveVendor`) but are never read back into `formData.statutory.gstFilingStatus` when a draft/returned vendor is opened for edit.
- Because `gstFilingRows` stays empty, `evaluateGstr1Compliance` isn't computed, "Continue to PAN" stays disabled, and the PAN pill also never becomes verified (PAN card is seeded but the PAN tab needs GST verified to proceed).

**View Details screens — PAN Status / Is Aadhaar Linked:**
- Values are stored on the vendor row (`vendors.pan_status`, `vendors.pan_aadhaar_linked`) and are already rendered in `ReviewStep`, `VendorReviewDialog` (SAP sync popup / approvals), Reports export and VendorList Excel export.
- They are missing from three visible view surfaces: **VendorList "View Details" dialog** (Statutory Details grid), **FinanceReview details panel**, and **DocumentVerification vendor details panel**.

## Fix

### 1. Restore GST filing status + PAN details during edit

**`src/hooks/useVendorRegistration.tsx` (loadDraft / mapper around L651-692)**
- After loading the vendor row, also fetch the latest `vendor_validations` row of type `gst` for that vendor and populate `formData.statutory.gstFilingStatus` from `details.filing_status` (normalised via `normalizeFilingStatus`).
- (Non-invasive addition; `pan_status` / `pan_aadhaar_linked` are already mapped at L654-656.)

**`src/pages/VendorRegistration.tsx` (~L758 seeded `verifiedData.gst`)**
- Add `filing_status: existingFormData.statutory.gstFilingStatus` so `DocumentVerificationStep` can seed `gstFilingRows`, `gstFilingChecked=true` and `gstCompliance`.
- Add `apiName: existingFormData.organization.legalName`, `tradeName: existingFormData.organization.tradeName`, and a `nameMatchScore` of 100 so the GST tile renders verified on Edit exactly as it does after a fresh check.
- Extend the seeded `verifiedData.pan` (currently only `{ number, holderName: legalName }`) with `apiName: legalName` and pass through the already-loaded `panStatus` / `panAadhaarLinked` / `panComprehensiveVerifiedAt` (already present at L754-756) — `DocumentVerificationStep` already knows how to render these when they come through `initialData.pan…`.

Result: On edit, GST tab shows the persisted filing table + green compliance badge → "Continue to PAN" becomes enabled → PAN tab renders with saved PAN, PAN Status and Is Aadhaar Linked without needing re-verification.

### 2. Show PAN Status & Is Aadhaar Linked on every PAN view

Use the existing helpers `formatPanStatus` / `formatAadhaarLinked` from `@/lib/panComprehensive` for consistent labels ("Valid" / "Invalid" and "Aadhaar Linked with PAN" / "Aadhaar Not Linked with PAN", `-` when null).

Add both fields alongside PAN in these view surfaces:

- **`src/pages/VendorList.tsx`** — Statutory Details grid (~L599-616): add PAN Status and Is Aadhaar Linked cells.
- **`src/pages/FinanceReview.tsx`** — vendor details panel (~L390): add two more rows below PAN.
- **`src/pages/DocumentVerification.tsx`** — vendor details grid (~L757-760): add two more grid items.

Already correct (no change): `ReviewStep`, `VendorReviewDialog` (used by SAP Sync popup, approvals, Reports preview), Reports Excel export, VendorList Excel export.

## Files touched

```text
src/hooks/useVendorRegistration.tsx        (load gstFilingStatus from vendor_validations)
src/pages/VendorRegistration.tsx           (seed filing_status, apiName, tradeName, PAN apiName)
src/pages/VendorList.tsx                   (add PAN Status + Aadhaar Linked)
src/pages/FinanceReview.tsx                (add PAN Status + Aadhaar Linked)
src/pages/DocumentVerification.tsx         (add PAN Status + Aadhaar Linked)
```

No DB migrations, no edge function changes, no changes to save-side logic — PAN Comprehensive fields are already persisted and the filing rows are already written to `vendor_validations`.