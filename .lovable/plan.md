## Why CEO Office shows "No pending approvals"

The vendor's chain is correct — Finance 2 is approved and the CEO Office row (`level_id = 393b9f91…`, tenant `6fd07201` = Ramky Infrastructure Limited) is `pending`. The screen is empty because that level is configured with **only one approver: `ceo@ramky.com`** (no `user_id`).

You're logged in as **`sureshkumar.b@sharviinfotech.com`** (auth user `b1cdabde…`). That email is set up as a CEO Office approver on a different tenant (`b514cc90…`), but **not on Ramky Infrastructure Limited's CEO Office level**, so `list-pending-approvals-by-stage` returns 0 for you.

There's a separate stale duplicate level `78027683…` on tenant `77062586…` (also pointing at `ceo@ramky.com`) that no vendor uses — leftover from an earlier matrix edit.

## Fix

1. **Migration** — make Suresh the CEO Office approver on Ramky Infrastructure (tenant `6fd07201`):
   ```sql
   UPDATE approval_matrix_approvers
   SET approver_email = 'sureshkumar.b@sharviinfotech.com',
       approver_name  = 'suresh',
       user_id        = 'b1cdabde-9fd7-4c96-89c6-4c559385202d'
   WHERE level_id = '393b9f91-28ed-4639-832e-ba4afa8fab2a'
     AND approver_email = 'ceo@ramky.com';
   ```
   After this, `/approvals/ceo` will list the SHARVI vendor (`a0a0b224…`) for Suresh, and approving it will flip the vendor to `pending_sap_sync`.

2. **Cleanup migration (optional but recommended)** — delete the orphan duplicate level so Approval Matrix admin doesn't show two CEO Office levels:
   ```sql
   DELETE FROM approval_matrix_approvers WHERE level_id = '78027683-0bdc-4e63-a0c4-be8575bc3baa';
   DELETE FROM approval_matrix_levels    WHERE id       = '78027683-0bdc-4e63-a0c4-be8575bc3baa';
   ```

3. **UX safeguard** — in `src/components/approvals/StageApprovalView.tsx`, when the list is empty show a small note: *"You are not configured as a CEO Office approver for some tenants. Vendors waiting on other approvers won't appear here."* This stops repeat confusion when the same symptom occurs because of approver-assignment, not workflow bugs.

No edge-function or workflow code changes are required — `process-approval-action` and `route-vendor-approval` are working correctly; this is purely an approver-configuration data issue.

Approve to apply.