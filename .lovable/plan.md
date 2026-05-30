## Problem found

The Approval Flow View opens `VendorReviewDialog`, which currently tries to read GST filing rows only from `vendor_validations.details.filing_status` or by making a live `GST_FILING` call.

But in the live database, `vendor_validations` has no GST rows for the referenced vendor, and the configured KYC executor does not persist ad-hoc GST/GST_FILING provider responses into `vendor_validations`. That explains why the GST Upload tab can show the rows immediately from in-memory verification state, while the Approval View later has nothing reliable to bind.

## Plan

1. **Create a shared GST filing extraction helper**
   - Centralize the logic that can find `filing_status` in all known shapes:
     - `details.filing_status`
     - `details.data.filing_status`
     - `details.raw.data.filing_status`
     - `details.response.filing_status`
     - direct provider response shapes if needed
   - Reuse this in Approval View and any preview/review views instead of only checking one path.

2. **Persist filing rows from the GST Upload verification flow**
   - Update `GstKycTab` so when GST verification + filing check completes, the saved `vendor_validations` row always contains normalized filing rows under `details.filing_status`.
   - Avoid deleting/replacing useful filing rows with a later GST validation that does not include filing data.
   - Store enough GST metadata alongside the rows for the compliance summary fields.

3. **Fix Approval Flow View binding**
   - Update `VendorReviewDialog` GST Compliance tab to select all GST validation rows for the vendor, pick the most recent row that actually contains filing status data, and render the same `GstFilingStatusTable` used in the GST Upload tab.
   - Keep the existing fallback live fetch only as a backup, but make the primary source the persisted upload/verification response.

4. **Handle existing vendors already missing persisted rows**
   - For vendors like the screenshot example where `vendor_validations` is currently empty, the Approval View fallback will still fetch GST filing status from the configured provider using the vendor GSTIN.
   - If the provider returns rows, persist them into `vendor_validations.details.filing_status` so subsequent approvers see the table without refetching.

5. **Verify the specific scenario**
   - Check the referenced vendor `BADE MURALI KRISHNA / 36DPSPB7500A1Z8` in Approval Flow → View → GST Compliance.
   - Confirm that when GST is registered and filing rows exist from verification or fallback fetch, the table appears with the last 3 months using the same component as GST Upload.