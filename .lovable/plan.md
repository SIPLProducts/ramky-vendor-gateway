## Plan

Update the shared PAN Comprehensive formatters so `null` values render like real data instead of `-`. Because every screen (registration Preview, Review step, View Details dialogs, Reports) uses these two helpers, changing them once fixes the value display everywhere consistently.

### Change

In `src/lib/panComprehensive.ts`:

1. **`formatAadhaarLinked(linked)`**
   - `true` → `Aadhaar Linked with PAN`
   - `false` or `null`/`undefined` → `Aadhaar Not Linked with PAN`

2. **`formatPanStatus(status)`**
   - Value equals `valid` (case-insensitive) → `Valid`
   - Any other value, `null`, or `undefined` → `Invalid`

### Screens that automatically pick up the fix
- Vendor Registration → Review step (`ReviewStep.tsx`)
- Vendor Registration → Submission Preview dialog (`VendorSubmissionPreviewDialog.tsx`)
- Vendor List → View Details (`VendorList.tsx`)
- Vendor Review dialog used by SAP Sync + approval screens (`VendorReviewDialog.tsx`)
- Document Verification page (`DocumentVerification.tsx`)
- Finance Review + Purchase Approval pages
- Reports export

### Validation
- Re-open the View Details dialog and the Preview dialog for the same vendor and confirm both rows now show `Valid` / `Invalid` and `Aadhaar Linked with PAN` / `Aadhaar Not Linked with PAN` even when the stored value is `null`.