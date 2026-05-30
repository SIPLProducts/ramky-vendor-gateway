Plan to fix the missing GST Filing Status table without hardcoding:

1. Confirmed current issue
- The Approval View is querying `vendor_validations` for the selected vendor and GST type.
- The live network response for vendor `16e6ca63-7996-4856-ae4f-1b21c829b4ab` returned an empty array.
- A database check also shows `BADE MURALI KRISHNA / 36DPSPB7500A1Z8` has `gst_verification_status = passed`, but zero saved GST validation rows.
- This explains why the Vendor Registration GST Upload tab can show the table from local in-screen state, while the Approval Flow view cannot reload it later.

2. Persist the same dynamic GST filing response after vendor ID exists
- Extend the Step 1 GST verification data carried into the parent form to include the normalized `filing_status` response.
- Store this in form state as dynamic verification data, not as static mappings or hardcoded rows.
- In `useVendorRegistration`, after `saveVendor` creates or updates the vendor and has a real vendor ID, upsert the GST `vendor_validations` row using the saved GST verification response.
- This fixes the gap where Step 1 runs before `vendorId` exists, causing the current direct insert in the GST tab to be skipped.

3. Stop deleting useful GST validation data during later validations
- Ensure later submission/validation flows do not replace a GST validation row containing `filing_status` with a simpler row that lacks filing rows.
- If a later GST response does not contain filing rows, merge it with the existing `details.filing_status` instead of removing the saved filing table data.

4. Bind Approval Flow View only to dynamic saved data
- Update `VendorReviewDialog` to select the latest GST validation row that contains a valid `details.filing_status` array.
- Reuse the same `normalizeFilingStatus` and `GstFilingStatusTable` component used by the Vendor Registration form.
- Remove hardcoded fallback values such as fixed registration dates or generated last-filed months from the GST Compliance section; show values only from saved vendor fields or saved GST verification details.

5. Validation after implementation
- Re-test the specific vendor shown in the screenshot.
- Verify `vendor_validations` contains the GST response with `details.filing_status` after GST verification/save.
- Verify Approval Flow → View → GST Compliance displays the table from that saved response and no longer remains stuck at “Fetching latest filing status from GSTN…”.