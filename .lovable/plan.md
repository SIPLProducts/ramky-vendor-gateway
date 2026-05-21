# Cross-tenant visibility for approver roles

## Problem

Vendors / buyers spanning 30+ tenants (companies) can't be reviewed end-to-end because RLS on `vendors` and friends restricts the `approver` placeholder role to tenants the user is mapped into via `user_tenants`. The frontend (`useVendors`, `useTenantContext`) also forces a tenant filter on every query.

Approval listing (the edge function `list-pending-approvals-by-stage`) already runs with service role and is unaffected — but once the user clicks into a vendor, opens "All Vendors", "SAP Sync", dashboards, etc., they hit RLS + frontend tenant filters and rows disappear.

## Target rules

| Custom role | Visibility |
|---|---|
| SCM Head, Finance 1, Finance 2, Finance Approval, CEO Office, SAP Team | **All vendors, all tenants** |
| SCM Manager | **Only vendors invited by a buyer mapped to this SCM Manager** in `buyer_scm_mappings` |
| Buyer (existing) | Unchanged — tenant restricted as today |
| Vendor / Customer Admin / Sharvi Admin / built-in finance/purchase | Unchanged |

## Backend (single migration)

1. New SECURITY DEFINER helpers in `public`:
   - `has_custom_role(_user_id uuid, _name text) returns boolean` — checks `user_custom_roles → custom_roles.name` (active only).
   - `is_cross_tenant_reviewer(_user_id uuid) returns boolean` — true if user has any of the 6 names above.
   - `scm_manager_can_see_vendor(_user_id uuid, _vendor_id uuid) returns boolean` — true if there exists a row in `buyer_scm_mappings` where `scm_manager_user_id = _user_id` and `buyer_user_id` = `vendor_invitations.created_by` for that vendor (latest invite).
2. Add SELECT policies (additive, do NOT remove existing ones — vendors keep seeing their own row, finance/purchase/customer_admin keep their tenant scope):
   - `vendors` — `Cross-tenant reviewers view all vendors` USING `is_cross_tenant_reviewer(auth.uid())`.
   - `vendors` — `SCM Manager views mapped buyer vendors` USING `has_custom_role(auth.uid(),'SCM Manager') AND scm_manager_can_see_vendor(auth.uid(), id)`.
   - Same two policies replicated for: `vendor_validations`, `vendor_documents`, `vendor_approval_progress`, `audit_logs`, `ocr_extractions` (joining on `vendor_id`).
3. No table or schema changes; no removal of existing policies; SAP/master/config tables untouched.

## Frontend

1. `src/hooks/useTenantContext.tsx` — extend `isSuperAdmin` concept: add `isCrossTenantReviewer` (loaded once from `user_custom_roles` join `custom_roles.name`). When true, tenant picker becomes optional and `useTenantFilter()` returns `{ tenantIds: null }` (no filter), exactly like sharvi_admin today. When the user picks a specific tenant from the dropdown, the filter still applies (so they can narrow voluntarily).
2. `src/hooks/useVendors.tsx` — no logic change needed; it already respects `tenantIds === null` as "no filter". The change in `useTenantFilter` propagates automatically to dashboards, lists, SAP Sync, etc.
3. SCM Manager scoping in the UI: extend `useTenantFilter` so that when the user only has the `SCM Manager` custom role, instead of returning tenant ids it returns a new `vendorIds` array sourced from `buyer_scm_mappings → vendor_invitations.vendor_id`. Apply this in:
   - `useVendors` (`.in('id', vendorIds)` when present)
   - `useVendors` status counts (line ~659)
   - `VendorList.tsx`, `SAPSync.tsx` lists — they consume the same hook, so no per-page edit needed beyond the hook change.
   RLS already blocks anything outside the allowed set, so this is purely a UX/perf filter.
4. Buyer-company filter (`getBuyerCompanyName` etc.) keeps working — those reviewers now see every tenant in the dropdown via the existing `tenants` table SELECT policy (`is_active = true` already allows all authenticated users).

## Out of scope

- No change to how vendors / buyers / customer_admin see data.
- No change to approval routing or the edge function listing pending approvals.
- No change to SAP payload, DMS sync, or master data.
- No change to the buyer-company assignment requirement during vendor registration.

## Verification

- As an SCM Head mapped to tenant A only: open All Vendors → see vendors from tenants A, B, C…; open a vendor from tenant C → detail loads; SAP Sync list shows cross-tenant rows.
- As Finance 1 / Finance 2 / CEO Office / SAP Team: same as above.
- As an SCM Manager mapped to Buyer X (who invited vendors V1, V2): All Vendors shows only V1, V2 even if those vendors live in different tenants; vendors invited by other buyers are hidden.
- As an existing Buyer / Customer Admin / Finance (built-in) / Purchase: behaviour unchanged, still tenant restricted.
- As a Vendor: still sees only their own record.
