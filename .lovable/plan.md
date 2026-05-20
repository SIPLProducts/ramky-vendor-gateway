## Goal

Show the saved GST Filing Status table (last 3 months) inside every "View Details" / preview popup for a vendor, using the data already persisted during registration.

## Current state

- During vendor registration, `DocumentVerificationStep.tsx` already saves `filing_status` into `vendor_validations.details` for the `gst` row (verified at lines 1027–1037).
- `VendorReviewDialog.tsx` already reads `details.filing_status` and renders the table in its "GST Compliance Report" tab — but falls back to dummy rows when none are stored.
- Other View Details surfaces do NOT show the filing table:
  - `VendorSubmissionPreviewDialog.tsx` (used by Approvals → Preview, SAP Sync → Preview)
  - `FinanceReview.tsx` (inline "Vendor Details" dialog opened from "View Details" button)

## Plan

1. **`VendorSubmissionPreviewDialog.tsx`**
   - Alongside loading the vendor, also fetch the latest `vendor_validations` row where `validation_type = 'gst'` for that vendor.
   - Normalize `details.filing_status` via existing `normalizeFilingStatus`.
   - When rows exist, render a new "GST Return Filing Status (Last 3 Months)" section using the shared `GstFilingStatusTable` with `limit={3}`. Show only when vendor has a GSTIN; otherwise hide.

2. **`FinanceReview.tsx` — inline Vendor Details dialog**
   - In the same data-fetch path used for the dialog (or on dialog open), fetch the `gst` `vendor_validations` row for `selectedVendor.id`.
   - Add a new card/section under the "Statutory" card (or as a full-width row below the 2-col grid) titled "GST Return Filing Status (Last 3 Months)" rendering `GstFilingStatusTable` with `limit={3}` when rows exist.

3. **`VendorReviewDialog.tsx` — remove sample fallback**
   - In `buildGstComplianceReport`, keep the real rows path but stop generating synthetic "Filed" placeholder rows when `filing_status` is empty. Instead show a small "No filing data captured for this vendor" empty state inside the GST Compliance Report tab. This guarantees View Details always reflects stored data, not mock data.

4. **No schema changes**
   - All required data is already in `vendor_validations.details.filing_status`. No migration needed.
   - No edge-function changes needed.

## Files to change

- `src/components/vendor/VendorSubmissionPreviewDialog.tsx` — fetch GST validation + render table section.
- `src/pages/FinanceReview.tsx` — fetch GST validation for selected vendor + render table section in Details tab.
- `src/components/vendor/VendorReviewDialog.tsx` — drop sample-row fallback, show empty state when no rows.

## Out of scope

- The registration GST flow itself (already implemented and visible in screenshot).
- Any backend / SAP-sync changes.