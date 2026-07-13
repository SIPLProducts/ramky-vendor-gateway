## Hide email under "Invited By" across the app

Show only the inviter/buyer **name** wherever "Invited By" (or "Invited By (Buyer)") is displayed. Keep the email in the underlying data and CSV export unchanged.

### Files to edit

1. **`src/pages/Dashboard.tsx`** (lines 438–443)
   - Render only `v.invited_by.name` (fallback to `—` if no name). Remove the secondary `<div>` showing `invited_by.email`.
   - Leave the CSV export (line 252) untouched so exports still contain the email.

2. **`src/pages/VendorList.tsx`** (lines 431–437)
   - Render only `vendor.invited_by.name` (fallback to `—`). Remove the email sub-line.

3. **`src/components/approvals/StageApprovalView.tsx`** (lines 258–263)
   - Render only `it.buyerName`. Remove the `it.buyerEmail` sub-line.

4. **`src/components/vendor/VendorReviewDialog.tsx`** (lines 446–451)
   - Keep "Invited By (Buyer)" label and name. Remove the email `<p>` block with the Mail icon.

### Not changed
- Data fetching, types, CSV/Excel exports, email notifications, and any other functionality remain intact — only the visible email line is removed from the four UI surfaces above.