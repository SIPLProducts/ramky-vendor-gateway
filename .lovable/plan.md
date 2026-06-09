# Fix: SCM Manager sees vendors in approval queue but not in All Vendors / Dashboard

## Root cause

Raja Mani (SCM Manager) is wired to Ajay Babu's vendors through `buyer_approval_flows.scm_manager_user_id`, NOT through `buyer_scm_mappings` (that table has no row for him). 

- The **SCM Manager Approval** page works because it uses the `list-pending-approvals-by-stage` edge function (service role, ignores RLS, walks `vendor_approval_progress`).
- The **All Vendors** and **Dashboard** pages use `useTenantFilter()` → `scmManagerVendorIds` in `useTenantContext.tsx`, which only looks at `buyer_scm_mappings`. Result: empty list → no vendors shown.

## Change

Update the `scm-manager-vendor-ids` query in `src/hooks/useTenantContext.tsx` to compute the buyer set from BOTH sources, then resolve invited vendors as before:

1. Buyers from `buyer_scm_mappings` where `scm_manager_user_id = me` (existing).
2. Buyers from `buyer_approval_flows` where `scm_manager_user_id = me` (new).
3. Union → fetch `vendor_invitations.vendor_id` for `created_by IN (buyers)`.

No other files need changes — `VendorList`, `Dashboard`, and `useTenantFilter` already consume `scmManagerVendorIds`.

## Verification

- As Raja Mani, open All Vendors → Ajay Babu's submitted vendors appear.
- Dashboard counters reflect the same set.
- SCM Manager Approval queue is unaffected (still served by the edge function).
- Other SCM Managers (e.g. Soumendu, Shailesh) keep their existing `buyer_scm_mappings`-based scoping.