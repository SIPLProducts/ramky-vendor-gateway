
# Role-Based Vendor Visibility

Tighten vendor data scoping so each role sees only the vendors relevant to them. Admins (`sharvi_admin`, `admin`) and SAP Team continue to see everything; cross-tenant approvers lose their blanket access.

## Visibility rules

| Role | Visible vendors |
|---|---|
| `sharvi_admin`, `admin` | All vendors |
| SAP Team (custom role) | All vendors (needed for sync) |
| Buyer | Vendors where `vendor_invitations.created_by = auth.uid()` |
| SCM Manager | Vendors invited by buyers mapped to them (unchanged) |
| SCM Head / Finance 1 / Finance 2 / CEO Office | Vendors where `buyer_approval_flows` assigns them as approver for that stage |
| Other tenant users | Vendors in their assigned tenants (unchanged) |
| Vendor | Their own vendor only (unchanged) |

"Routed to me" = the approver user id on `buyer_approval_flows` matches `auth.uid()` for their stage column. The visible vendor set is every vendor created by any buyer whose flow names this user, regardless of current status (so historical / completed / rejected vendors stay visible).

## Implementation

### 1. New SECURITY DEFINER helpers (migration)

- `public.approver_visible_vendor_ids(_user_id uuid)` — returns vendor ids invited by buyers whose `buyer_approval_flows` row names `_user_id` in any of `scm_head_user_id`, `finance_1_user_id`, `finance_2_user_id`, `ceo_office_user_id`.
- `public.buyer_visible_vendor_ids(_user_id uuid)` — returns `vendor_invitations.vendor_id` where `created_by = _user_id`.
- `public.is_sap_team(_user_id uuid)` — reuses custom role lookup for `'sap team'`.

These are read by both RLS policies and the frontend filter via `useTenantFilter`.

### 2. Extend `useTenantContext` / `useTenantFilter`

Add new derived fields:
- `isBuyer` — built-in role `purchase`/`buyer` or custom role "Buyer".
- `isStageApprover` — has any of `SCM Head`, `Finance 1`, `Finance 2`, `Finance Approval`, `CEO Office` custom roles.
- `isSapTeam`.
- `approverVisibleVendorIds: string[] | null` — fetched via the new helper for stage approvers / buyers (merged with existing `scmManagerVendorIds`).

`useTenantFilter` precedence (top wins):
1. `sharvi_admin` / `admin` / `sap team` → no restriction.
2. `isStageApprover` or `isBuyer` (and not admin) → `vendorIds = approverVisibleVendorIds`. Cross-tenant override is removed for stage approvers so they no longer see "all".
3. SCM Manager → existing `scmManagerVendorIds`.
4. Else → tenant scoping as today.

`CROSS_TENANT_ROLE_NAMES` in `useTenantContext` shrinks to just `sap team` (the only role that legitimately needs cross-tenant read for sync). SCM Head / Finance 1/2 / Finance Approval / CEO Office move into the stage-approver bucket and are filtered by routed-vendor ids.

### 3. Consumers (no UI redesign — only data they read)

All already call `useTenantFilter` / `useVendors`, so they pick up the change automatically:
- `src/pages/VendorList.tsx` (All Vendors + CSV export — export uses `filteredVendors`).
- `src/hooks/useVendors.tsx` — `useVendors`, `useStuckApprovalVendors`.
- `src/pages/Dashboard.tsx` counts.
- `src/pages/SAPSync.tsx` — verify it uses `useVendors`; if it queries directly, switch it to the same filter (SAP Team unaffected since they see all).
- Header tenant switcher: hide it when the user has no tenant choice (stage approvers and buyers now see a vendor-id-scoped list, not a tenant list).

### 4. RLS hardening on `public.vendors`

Update SELECT policies so the database enforces the same rule (defense in depth):
- Keep: admin, own-vendor, tenant-member, SCM Manager via `scm_manager_can_see_vendor`.
- Drop the broad `is_cross_tenant_reviewer` SELECT policy for `vendors`.
- Add: `id = ANY (public.approver_visible_vendor_ids(auth.uid()))`.
- Add: `id = ANY (public.buyer_visible_vendor_ids(auth.uid()))` for buyers (covers buyers in a different tenant than the vendor).
- Add: SAP Team (`has_custom_role(auth.uid(),'sap team')`) keeps full read.

Mirror the same SELECT additions on `vendor_documents`, `vendor_validations`, `vendor_approval_progress`, and `audit_logs` so detail dialogs still load for approvers but block other tenants' rows.

### 5. Edge functions

Audit functions that bypass RLS with the service role and assume cross-tenant access (`list-pending-approvals-by-stage`, `sync-vendors-to-sap-bulk`). They already filter by stage/approver — no change needed, but add a guard: when the caller is not admin/SAP Team, intersect results with `approver_visible_vendor_ids(userId)` so the API matches UI scoping.

## Out of scope

- No changes to approval action permissions (already enforced per stage).
- No UI redesign of All Vendors — only the visible row set changes.
- Legacy vendors with no `buyer_approval_flows` row remain visible only to admins / tenant members / the inviting buyer.

## Verification

1. Sign in as each role (Buyer, SCM Manager, SCM Head, Finance 1, Finance 2, CEO Office, Admin, SAP Team) and confirm:
   - All Vendors row count matches the rule above.
   - CSV export contains only visible rows.
   - Dashboard tiles match.
   - Detail dialog opens for visible vendors and is blocked for others.
2. Run `supabase--linter` after the migration; resolve any new RLS warnings.
