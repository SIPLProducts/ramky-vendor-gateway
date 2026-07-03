## Goal
Move vendor **Monoj Kumar Biswas** (Ref 20260703001, id `54b3d915…d68663`) from its current **Finance 2 Review** stage to the **SAP Team** queue so it appears on the SAP Sync page.

## Current state
- `vendors.status = finance_2_review`
- `vendor_approval_progress`: BUYER, SCM_MANAGER, FINANCE_1 = approved; FINANCE_2 = pending.
- SAP Sync page lists vendors whose status is `pending_sap_sync` or `purchase_approved`.

## Changes (data-only, via migration)
1. Mark the pending FINANCE_2 progress row as `approved` with a system note ("Manually advanced by admin to SAP Team stage"), `acted_at = now()`, `completed_at = now()`.
2. Update `vendors.status` for that vendor to `pending_sap_sync`.
3. Insert an `audit_logs` entry (`action = 'admin_manual_advance_to_sap_team'`) recording the vendor id and reason.

No application code changes. No changes to any other vendor.

## Verification
- Reload `/sap-sync` as a SAP Team user and confirm the vendor appears in the SAP queue.
- Confirm the vendor no longer appears under Finance 2 pending approvals.
