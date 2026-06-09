## Goals

1. **Reference # search** on Vendor Invitations must only resolve vendors the current user is allowed to see (a Buyer cannot view another Buyer's vendor by guessing a ref #).
2. **Company / tenant pickers** (page filter on All Vendors + Invite / Create-Vendor dialogs) must be restricted to the user's own assigned tenants. Buyers must not see other tenants in any of these dropdowns.
3. **Top-header tenant switcher** must be hidden for all approver roles (SCM Manager, SCM Head, Finance 1, Finance 2, CEO Office). Today it is only hidden for SCM Manager + SAP Team — SCM Head / Finance / CEO still see it (second screenshot).

Admin / Sharvi Admin behaviour is unchanged everywhere.

## Changes

### 1. `src/pages/AdminInvitations.tsx` — secure ref # search
Replace the `handleTrackByReference` lookup so it only navigates when the vendor falls in the user's allowed scope:

- Super-admin / SAP Team: lookup as today (any vendor).
- Buyer: only vendors where `vendor_invitations.created_by = auth.uid()`.
- SCM Manager: vendors invited by buyers in `buyer_scm_mappings`.
- Stage approver (SCM Head / Finance 1 / Finance 2 / CEO Office): vendors invited by buyers in their `buyer_approval_flows` row.

Implementation: reuse the same `creatorIds` derivation that the page's invitations query already computes, then query
```ts
supabase.from('vendor_invitations')
  .select('vendor_id, vendors!inner(id, reference_number)')
  .in('created_by', [...creatorIds])
  .eq('vendors.reference_number', ref)
  .maybeSingle();
```
If no row → existing "Not found / no access" toast. This guarantees a Buyer cannot reach `/vendor-status/:id` for a peer's vendor.

### 2. `src/components/layout/EnterpriseHeader.tsx` — hide switcher for approvers
Extend `hidePicker` to cover every approver role:
```ts
const hidePicker = isCrossTenantReviewer || isScmManager || isStageApprover;
```
`isStageApprover` is already exposed by `useTenantContext` and covers SCM Head, Finance 1, Finance 2, Finance Approval, CEO Office. Sharvi Admin / Admin / Buyer keep the switcher.

### 3. `src/pages/VendorList.tsx` — restrict in-page company filter
Replace the unscoped `buyerCompanies` query (which calls `from('tenants').select(...)` and returns every active tenant — this is what produced "ADIPL-RAMKY JV" in the SCM Manager's All Vendors screenshot) with a role-aware list:
- Super-admin / SAP Team: keep current full list.
- Everyone else: use `myTenants` from `useTenantContext` (i.e. tenants the user is assigned to via `user_tenants`).

The filter dropdown then only renders companies the user actually has rights to filter on.

### 4. Invite / Create-Vendor dialogs (same file `AdminInvitations.tsx`)
No code change required — both dialogs already render `allowedTenants`, which is `myTenants` for non-super-admins. Confirm by re-reading the two `<Select>` blocks at the `company` and `cv-company` fields and leave them as-is. This satisfies "only one company while inviting / creating vendor" for buyers assigned to a single tenant.

## Out of scope

- No DB / RLS / migration changes. RLS on `vendors` and `vendor_invitations` already enforces access; these UI changes prevent the client from even attempting unauthorised lookups and tidy the dropdowns.
- No changes to approval-stage pages, edge functions, or `VendorStatus.tsx`.

## Files touched

- `src/pages/AdminInvitations.tsx` (ref-search scoping)
- `src/components/layout/EnterpriseHeader.tsx` (hide switcher for stage approvers)
- `src/pages/VendorList.tsx` (scope company filter)
