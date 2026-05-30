## Plan

1. Update the Approval Flow View GST Compliance tab to use the same GST Filing Status table component and layout as the GST Upload tab.

2. Fix the data lookup so the table reads filing rows from the persisted GST verification response generated during GST upload/verification, including likely shapes such as:
   - `details.filing_status`
   - nested raw/mapped API payload locations returned by configured providers
   - the latest GST validation row for the vendor

3. Ensure the table renders whenever the vendor is GST registered / has GSTIN, and only shows the fallback message when no filing rows exist after checking the saved verification data.

4. Remove or de-emphasize the current live-fetch placeholder behavior in Approval View so approvers see the submitted verification result instead of a blank card saying “Fetching latest filing status from GSTN...”.

5. Keep the change limited to frontend/view logic unless inspection during implementation proves the upload verification is not persisting the filing data correctly.

## Technical details

- Primary file: `src/components/vendor/VendorReviewDialog.tsx`.
- Reuse `GstFilingStatusTable` and `normalizeFilingStatus` from `src/components/vendor/kyc/GstFilingStatusTable.tsx`.
- Add a robust extractor helper in `VendorReviewDialog.tsx` to normalize GST filing status from the latest `vendor_validations.details` object and compatible nested API response paths.
- Preserve the existing Compliance Document section and approval dialog tabs.