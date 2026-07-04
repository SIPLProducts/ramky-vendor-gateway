## Goal

Make sure `PAN Status` (Valid/Invalid) and `Is Aadhaar Linked` (from the PAN Comprehensive API) are:
1. Reliably saved on the vendor row.
2. Displayed in every approver/reviewer "View" screen alongside PAN — using the same wording already used elsewhere.

## Current state (verified)

- Columns exist: `vendors.pan_status`, `vendors.pan_aadhaar_linked`.
- Client save path already writes them (`useVendorRegistration.tsx` lines 490–491) and re-hydrates them on load (lines 668–669).
- Extraction from PAN doc → form state exists (`DocumentVerificationStep.tsx` lines 1930–1931, 858/883).
- View already renders them in: `VendorReviewDialog` (used by SAP Sync + all stage approval screens via `StageApprovalView`), `FinanceReview`, `DocumentVerification`, `VendorList`, `ReviewStep`, `Reports` export.
- **Missing / broken**:
  - `PurchaseApproval` "Details" tab does NOT show these two fields.
  - Save only happens through the registration submit path; if a buyer approves/edits without going through `DocumentVerificationStep`, values captured from the live PAN Comprehensive call are not flushed back to the vendor row. DB check: 0 of the recent PAN-having vendors have `pan_aadhaar_linked` populated.
  - `PurchaseApproval` details tab is missing several statutory rows too.

## Changes

### 1. Save reliably (business logic — minimal)

In `src/components/vendor/steps/DocumentVerificationStep.tsx`, when the PAN Comprehensive API call succeeds inside `runPanVerify` (the two success branches around lines 851 and 876), in addition to updating form state also persist directly to the vendor row when a `vendorId` is available:

```
if (vendorId) {
  await supabase.from('vendors')
    .update({
      pan_status: comprehensive.status ?? null,
      pan_aadhaar_linked: comprehensive.aadhaarLinked ?? null,
    })
    .eq('id', vendorId);
}
```

This guarantees the two fields are stored the moment the API returns, independent of whether the user clicks Save/Submit afterwards. No other business logic changes.

### 2. Show in `PurchaseApproval` view dialog (presentation only)

In `src/pages/PurchaseApproval.tsx` "Details" tab (~lines 413–425), add two rows after the PAN row using the existing shared formatters:

```
import { formatPanStatus, formatAadhaarLinked, PAN_STATUS_LABEL, AADHAAR_LINKED_LABEL } from '@/lib/panComprehensive';

<div><span className="text-muted-foreground">{PAN_STATUS_LABEL}:</span> <span className="font-medium">{formatPanStatus((selectedVendor as any).pan_status)}</span></div>
<div><span className="text-muted-foreground">{AADHAAR_LINKED_LABEL}:</span> <span className="font-medium">{formatAadhaarLinked((selectedVendor as any).pan_aadhaar_linked)}</span></div>
```

### 3. Normalise wording in `VendorReviewDialog`

Replace the inline ternaries at lines 593–594 with `formatPanStatus` / `formatAadhaarLinked` from `@/lib/panComprehensive` so every screen renders the exact same text ("Valid"/"Invalid", "Aadhaar Linked with PAN"/"Aadhaar Not Linked with PAN"). Wording and layout unchanged — this just centralises formatting.

## Files touched

- `src/components/vendor/steps/DocumentVerificationStep.tsx` — persist to `vendors` when API confirms.
- `src/pages/PurchaseApproval.tsx` — add 2 rows in Details tab.
- `src/components/vendor/VendorReviewDialog.tsx` — use shared formatter helpers.

## Verification

- Register/verify a new vendor via PAN → check `vendors` row has `pan_status = 'valid'` and `pan_aadhaar_linked` boolean set.
- Open each approval screen (Buyer, SCM Manager, SCM Head, Finance 1, Finance 2, CEO Office, SAP Sync, Finance Review, Purchase Approval, Document Verification) → View → confirm `PAN Status` and `Is Aadhaar Linked` rows appear next to PAN.
