## Goal
The GST Filing Status flow you described is already wired up end-to-end. This plan covers the **remaining gaps** so it fully matches your request — using your new template file, capping the inline table at 3 months, and confirming the View Details popup shows the saved data.

## What's already working (no changes needed)

| Requirement | Where it lives |
|---|---|
| After GSTIN validation → auto-call GST Filing Status API | `GstKycTab.tsx` → `handleManualVerify` / `handleOcrVerify` chain into `runFilingStatusCheck` (calls the `GST_FILING` provider) |
| Parse `filing_status` array & show in a table on the GST tab | `GstFilingStatusTable` (columns: Financial Year, Tax Period, Date of filing, Status) |
| Last month filed → success badge + auto-advance to PAN | `runFilingStatusCheck` calls `props.onVerifiedDetails` when `isLatestPeriodFiled` is true |
| Last month NOT filed → warning + self-declaration upload required → after upload move to PAN | `GstDeclarationDialog` opens automatically; `confirmDeclarationUpload` advances to PAN after the signed file is uploaded |
| Persist filing data so View Details popup can show it | `persistGstValidation` writes the full payload (incl. `filing_status`) to `vendor_validations.details` |
| View Details → GST Compliance Report tab table | `VendorReviewDialog.tsx` → `buildGstComplianceReport` reads `details.filing_status`, dedupes (GSTR3B over GSTR1), sorts desc by filing date, **already slices to last 3 months** |

## Changes to make

### 1. Use your new declaration template
- Copy uploaded `user-uploads://3.GST_Returns_Declaration-3.docx` → `public/templates/gst-self-declaration.docx` (overwrite the existing one).
- Filename stays the same so both download links (`GstDeclarationDialog.tsx` and the "Not GST registered" branch in `GstKycTab.tsx`) keep working with zero code change.

### 2. Cap the inline GST tab table at last 3 months
Currently `GstFilingStatusTable` renders every deduped row. Change so the inline table on the GST tab shows **only the most recent 3** (View Details popup already does this).

- Smallest change: in `GstKycTab.tsx`, before passing rows to `GstFilingStatusTable`, slice the deduped result to 3.
- Alternative: add an optional `limit?: number` prop on `GstFilingStatusTable` and pass `limit={3}` from the GST tab. (View Details builds its own array via `dedupeAndTrim`, so it's unaffected either way.)

### 3. View Details popup — confirm it's working
No code change needed. After a vendor completes the new flow:
- `persistGstValidation` saves `{ ...gstData, filing_status: [...] }` into `vendor_validations` with `validation_type='gst'`, `status='passed'`.
- Opening **View Details → GST Compliance Report** runs `buildGstComplianceReport`, which finds `details.filing_status` and renders the same Financial Year | Tax Period | Date of filing | Status table (last 3 months).
- Older vendors with no saved `filing_status` still get the existing synthetic fallback so the tab is never blank.

## Files touched
- `public/templates/gst-self-declaration.docx` — replace contents with your uploaded `3.GST_Returns_Declaration-3.docx`.
- `src/components/vendor/kyc/GstKycTab.tsx` (or `GstFilingStatusTable.tsx`) — slice inline table to last 3 rows.

No DB migration, no new edge function, no changes to `VendorReviewDialog.tsx` or `KycApiSettings.tsx`.

## Open question
Do you also want the inline GST-tab table headers renamed to **Month | Return Type | Status | Date of Filing** (as in your earlier spec), or keep the current **Financial Year | Tax Period | Date of filing | Status** (which matches the View Details popup)? Default: keep current so both screens stay consistent.
