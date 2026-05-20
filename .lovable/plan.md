## What I found

The screen in your screenshot is using `src/components/vendor/steps/DocumentVerificationStep.tsx`, not the older `GstKycTab.tsx` flow. The older file has `GST_FILING`, but the active vendor registration flow only calls:

```text
GST_OCR -> GST
```

It never calls `GST_FILING`, so no filing table is rendered and `stage1Done` becomes true immediately after GST validation. That is why PAN unlocks before the filing status table appears.

## Plan

1. Add GST Filing Status state to the active vendor registration step
   - Track filing rows, checking status, latest-month filed result, and declaration requirement in `DocumentVerificationStep.tsx`.
   - Extend `VerifiedDocumentData.gst` to carry `filing_status` so it can be saved and used in View Details.

2. Chain the API calls in the correct order
   - After GST OCR and GSTIN Validation succeeds, automatically call:

```text
GST_FILING
```

   - Request payload will be:

```text
{ id_number: gstin, gstin: gstin }
```

   - If `GST_FILING` is not configured or returns no rows, fallback to `filing_status` from the GST validation response if present.

3. Show the table inside the GST tab before PAN unlocks
   - Render `GstFilingStatusTable` below GST verified details.
   - Show only the latest 3 months.
   - Keep headers as requested:

```text
Financial Year | Tax Period | Date of filing | Status
```

4. Correct the business gating
   - GST stage will be considered complete only when:
     - GST validation is verified, and
     - GST filing check has completed, and
     - latest month is filed, or declaration file is uploaded.
   - This prevents auto-moving to PAN until the table/message/declaration decision is finished.

5. Add filed/not-filed message
   - If latest month is filed: show success message like “GST returns filed up to last month” and then unlock/move to PAN.
   - If latest month is not filed: show warning “GST return not filed for last month”, show the GST Returns Declaration template download and upload field, then unlock/move to PAN only after upload.

6. Save table data for View Details
   - Include `filing_status` in the Step 1 output and save it into the existing `vendor_validations` GST record during registration save.
   - The existing View Details popup already has the “GST Compliance Report” tab and table renderer; after saving real `filing_status`, it will show those latest 3 months instead of fallback/sample rows.

## Files to change

- `src/components/vendor/steps/DocumentVerificationStep.tsx`
- `src/pages/VendorRegistration.tsx`
- possibly `src/hooks/useVendorRegistration.tsx` only if the final save path needs an additional validation insert/update for GST filing details.