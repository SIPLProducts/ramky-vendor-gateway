# GST Filing Status – Refresh Button, Continue Popup and Empty Response

## What Changes For The User

1. **Refresh Filing Status button**
   - Hidden once filing rows are received (as in your screenshot: "Filing Status Received (13 Returns)" – no button).
   - Shown only when the response has not come yet, failed, or came back empty, so the vendor can check again.

2. **Continue to PAN popup (only when filing data is not received)**
   - "GST Filing Data Not Received – Continue Without GST Filing Data?"
   - **No, Wait / Refresh**: stays on GST tab. If the API call is still running, it just waits for that response (no duplicate call) and shows "Fetching…". If no call is running, it calls the GST filing API once. The Refresh button stays visible for manual checking.
   - **Yes, Continue**: moves to PAN tab immediately, no extra API call.
   - No popup when filing rows already exist.

3. **Empty response ([])**
   - When the GST filing API answers with an empty list, we save that result with the message "GST Filing Data Not Available – GSTN Returned No Filing Records ([])" and the time it was checked.
   - GST tab shows this message instead of a blank table.
   - View Details → GST shows the same saved message instead of "Fetching latest filing status from GSTN…", and does not re-fetch live for that vendor.
   - If the API failed/timed out (no answer), it is not saved as empty; the message says "Filing Status Not Received – Please Refresh".

## Not Changed
- Existing vendors, validations and documents untouched (no bulk update, no migration).
- Successful filing flow, GSTR-1 grace/declaration logic, OCR and KYC retention remain as is.
- No edge function changes.

## Technical Details
- `DocumentVerificationStep.tsx`
  - Render Refresh button only when `gstFilingRows.length === 0`.
  - In `runGstFilingStatusCheck`: distinguish `empty` (provider ok, array `[]`) from `failed`. For `empty`, persist to latest gst `vendor_validations` row: `details.filing_status = []`, `details.filing_status_empty = true`, `details.filing_status_message`, `details.filing_checked_at` (merging existing details, not overwriting verification fields). Keep state `gstFilingEmpty`.
  - Popup "No" button: if `gstFilingChecking`, just close and stay; else call `refreshGstFiling()`. Popup skipped when rows exist.
  - Include empty flag/message in saved GST form data (line ~2263) so it reloads on edit.
- `GstKycTab.tsx`: same button visibility and empty message.
- `useVendorRegistration.tsx`: hydration keeps `filing_status_empty`/message when no rows.
- `VendorReviewDialog.tsx`: if latest gst details have `filing_status_empty`, show saved message and skip live fetch.
- Add tests in `src/lib/gstFiling.test` for empty-vs-failed classification.
- Self-hosted: frontend build + copy `dist` only.
