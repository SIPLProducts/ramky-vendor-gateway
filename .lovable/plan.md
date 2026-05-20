## Goal

In the **View Details** dialog (`VendorReviewDialog`), update the existing **GST Compliance Report** tab so the returns table shows columns matching the vendor-side filing-status table:

```text
Financial Year | Tax Period | Date of filing | Status
```

…and populate it from the real GST filing data captured during validation, with a graceful fallback when none is present.

## Changes

### `src/components/vendor/VendorReviewDialog.tsx`

1. **Reuse normalizer** — import `normalizeFilingStatus` from `@/components/vendor/kyc/GstFilingStatusTable` to parse both nested-array and flat-array shapes that Surepass returns.

2. **Extend `GstComplianceReport`** — replace `returnsFiled` with:
   ```ts
   filingRows: Array<{
     financial_year: string;
     tax_period: string;
     date_of_filing: string; // DD/MM/YYYY
     status: string;
   }>
   ```

3. **`buildGstComplianceReport`** — derive `filingRows`:
   - Read `gstValidation.details.filing_status` (saved by the verify step) and run it through `normalizeFilingStatus`.
   - Dedupe per `financial_year + tax_period`, preferring **GSTR3B** over **GSTR1** (same rule used on the vendor tab).
   - Sort by `date_of_filing` desc, keep the **last 3** rows.
   - Format `date_of_filing` as `DD/MM/YYYY`.
   - If no real rows exist, fall back to the current 3-month synthetic placeholder mapped to the new column shape (so older vendors without stored filing data still render something).

4. **Table markup** under "Recent Returns Filed":
   - Headers: Financial Year, Tax Period, Date of filing, Status.
   - Status cell: plain text — "Filed" neutral, anything else in `text-destructive` (matches vendor-side styling). Drop the Badge.

5. **No other tab/section changes.** The tab trigger, score cards, GSTIN/registration block, and compliance document list stay as-is.

### No DB / edge / route changes

Filing data is already in `vendor_validations.details` (written by the GST verify step). No migration needed.

## Out of scope

- No changes to the vendor-side `GstFilingStatusTable` (already in correct format).
- No new tab — the **GST Compliance Report** tab already exists in `VendorReviewDialog`; only its table is being updated.