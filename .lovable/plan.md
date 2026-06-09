## Goal

Stop cross-buyer / cross-approver vendor and invitation visibility. A Buyer must see only their own vendors and invitations; SCM Manager / SCM Head / Finance 1 / Finance 2 / CEO Office must see only the vendors routed to them via the Approval Matrix. Admin and SAP Team keep full access.

## Root causes found

1. **`vendors` RLS** still has broad-tenant policies that bypass our scoping:
   - `Approvers view tenant vendors` — any user with `app_role = 'approver'` sees every vendor in tenants they belong to (this is why Sriusha / Ajay-style buyers see other buyers' vendors — Sriusha's base role is `approver`, Ajay has `vendor` + custom `Buyer` but other accounts with `approver` leak data).
   - `Purchase can view tenant vendors`, `Finance can view tenant vendors`, `Customer admins view tenant vendors` — same pattern.

2. **`vendor_invitations` RLS** has:
   - `Tenant members can view tenant invitations` and `Finance and purchase view tenant invitations` — every buyer in a tenant sees every other buyer's invitations.

3. **`AdminInvitations.tsx`** query filters only by `tenant_id`, never by `created_by`, so the frontend doesn't compensate.

## Backend changes (migration)

Drop the broad-tenant SELECT/UPDATE policies on `vendors` for the `approver`, `purchase`, `finance`, `customer_admin` roles and replace them with scoped policies that reuse the existing helpers:

- `Buyers view their invited vendors` — `id IN (SELECT buyer_visible_vendor_ids(auth.uid()))`
- `Stage approvers view routed vendors` — already present as `Approvers view routed vendors` via `approver_visible_vendor_ids`; keep.
- `SCM Manager views mapped buyer vendors` — keep.
- `Customer admins manage tenant vendors` — narrow to write-only (`FOR INSERT/UPDATE/DELETE`); remove their broad SELECT.
- Keep: `Vendors can view own data`, `SAP team views all vendors`, `Sharvi admins can view all vendors`, `Admins can manage all vendors`, `Inviting users view their vendors`.
- Update workflow-write policies (`Finance can update tenant vendors in review`, `Purchase can update tenant vendors in purchase review`) to additionally require the vendor be in the user's scoped list (buyer/approver/SCM helpers), so a buyer can't edit a peer's vendor.

Tighten `vendor_invitations` RLS the same way:

- Drop `Tenant members can view tenant invitations`, `Tenant members can update tenant invitations`, `Finance and purchase view tenant invitations`.
- Add:
  - `Buyers view own invitations` — `created_by = auth.uid()`.
  - `Stage approvers view routed invitations` — `created_by IN (SELECT buyer_user_id FROM buyer_approval_flows WHERE scm_manager_user_id = auth.uid() OR scm_head_user_id = auth.uid() OR finance_1_user_id = auth.uid() OR finance_2_user_id = auth.uid() OR ceo_office_user_id = auth.uid())`.
  - `SCM Managers view mapped buyer invitations` — `created_by IN (SELECT buyer_user_id FROM buyer_scm_mappings WHERE scm_manager_user_id = auth.uid())`.
  - `SAP Team view all invitations` — `is_sap_team(auth.uid())`.
- Keep admin/super-admin policies and the "mark own invitation used" / "create" policies.

No table or column changes. Helper functions already exist; we just rewire policies. `user_can_see_vendor()` will be updated to drop the broad `v.tenant_id IN user_tenant_ids` branch, so dependent tables (`vendor_documents`, `vendor_validations`, `vendor_approval_progress`, `audit_logs`) automatically inherit the tighter scope.

## Frontend changes

`src/pages/AdminInvitations.tsx` — change the invitations query for non-admin, non-SAP-Team users so it explicitly matches the new RLS:

- Buyer: `.eq('created_by', user.id)`.
- Stage approver / SCM Manager: fetch the buyer ids they're configured for (one extra query via `buyer_approval_flows` + `buyer_scm_mappings`) and `.in('created_by', buyerIds)`.
- Admin / Sharvi admin / SAP Team: unchanged (all tenant rows).

Add a `useTenantContext` consumption to know whether the user is `isStageApprover`, `isScmManager`, or `isBuyerRole`; reuse the same scoping the vendors hook already uses.

No changes needed in `VendorList`, `Dashboard`, or `SAPSync` — they already read through `useTenantFilter` whose `scopedVendorIds` path is correct; they were just being overridden by the broad RLS policies.

## Verification

1. Log in as Ajay Babu (Buyer, no invitations created): All Vendors and Vendor Invitations show empty.
2. Log in as Sriusha (Buyer with invitations): sees only her three invitations and the vendors she invited, not Divya bharathi's.
3. Log in as a Finance 1 user mapped to Sriusha's flow: sees Sriusha's vendors only when they reach Finance 1.
4. Log in as SAP Team / Admin: sees everything.
5. Run `supabase--linter` after migration to confirm no new policy warnings.

## Out of scope

- No changes to how approvals are routed or how the approval matrix is configured.
- No UI rework, only the invitations query.
- No new tables, columns, or edge functions.
