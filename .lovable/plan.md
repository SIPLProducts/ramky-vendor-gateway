## Plan

1. **Confirm the data source for remarks**
   - The Finance 2 rejection remark is already saved in the database in two places:
     - the rejected Finance 2 progress row: `comments`
     - the reopened Finance 1 progress row: `rejection_comments`
   - The pending approvals API is already returning `rejectionComments`, so Finance 1 can receive the remark.

2. **Fix the approval history/status table binding**
   - Update the shared approval trail data hook to read both normal approval comments and rejection metadata from `vendor_approval_progress`:
     - `comments`
     - `rejection_comments`
     - `rejection_from_stage`
     - `rejection_at`
   - For rejected rows, display `comments` as the rejection reason.
   - For reopened previous approver rows, display `rejection_comments` as the returned/rejection reason.

3. **Update all approval tracking UI that uses this trail**
   - Update the Finance approval trail/status table so the Remarks/Comments section shows:
     - approval comments when approved
     - rejection remarks when rejected
     - “Returned from Finance 2” style context when a previous stage is reopened
   - Update the reusable `ApprovalTimeline` component used in buyer/SCM views with the same remarks binding.

4. **Ensure vendor/buyer visibility is preserved**
   - Keep using the vendor-level `last_rejection_comments` fields for high-level banners/status.
   - Make the detailed approval trail continue to show historical row-level remarks for audit tracking.

5. **Verify after implementation**
   - Re-check the current vendor record (`BADE MURALI KRISHNA`) to confirm the DB still has Finance 2 rejection remark `state mismatch`.
   - Verify the pending Finance 1 API response includes `rejectionComments`.
   - Confirm the UI components are bound to the correct fields so remarks appear in the approval history/status table.