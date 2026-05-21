## What's happening

Rajaman (SCM Manager) shows Pending (0) because he currently has zero rows in `buyer_scm_mappings` and zero invited vendors from any mapped buyer — the list is correctly empty. The bigger UX issue you're pointing at is the **tenant picker** in the header ("Pithampur IWM Pvt Ltd …") that still appears for SCM Manager / SCM Head / Finance 1 / Finance 2 / CEO Office / SAP Team. For these roles, data should not depend on tenant selection at all.

Right now:
- SCM Head / Finance 1 / Finance 2 / CEO Office / SAP Team: `useTenantFilter` already returns `tenantIds: null` (no filter), but the header still shows a tenant dropdown that *can* narrow data when they pick one.
- SCM Manager: `useTenantFilter` already returns `vendorIds` (buyer-mapped) and ignores the picker, but the dropdown is still visible.

## Fix (UI-only, no RLS / no edge function changes)

### 1. Hide the tenant picker for these roles

In `src/components/layout/EnterpriseHeader.tsx` and `src/components/layout/MobileHeader.tsx`:

- Pull `isCrossTenantReviewer` and `isScmManager` from `useTenantContext()`.
- Set `showSwitcher = false` when `isCrossTenantReviewer || isScmManager`.

Sharvi/customer admin and the built-in `purchase` (Buyer) role keep the picker exactly as today.

### 2. Force "All" while picker is hidden

Same two files: on mount, if `(isCrossTenantReviewer || isScmManager) && activeTenantId !== null`, call `setActiveTenantId(null)` once so any previously-stored tenant id from `localStorage` is cleared and queries truly run across all tenants.

`useTenantContext` already defaults to "All" for cross-tenant reviewers; we just need to guarantee it for SCM Manager too (today an SCM Manager could have a stale `localStorage` value pinning them to one tenant — even though `useTenantFilter` ignores it for them, clearing it prevents confusion and keeps the rest of the app consistent).

### 3. No data-layer change required

- `useTenantFilter` already returns `tenantIds: null` for cross-tenant reviewers and `{ vendorIds }` for SCM Manager — both are tenant-agnostic.
- RLS already allows: cross-tenant reviewers → all rows; SCM Manager → buyer-mapped rows; buyer/customer-admin/vendor unchanged.
- Edge function `list-pending-approvals-by-stage` already enforces buyer-mapping for SCM Manager and is matrix-based (no tenant filter) for the other reviewer roles.

## Verification

- Login as Rajaman (SCM Manager): no tenant dropdown in header. All Vendors lists every vendor invited by any buyer mapped to him, across all tenants. Pending list at `/approvals/scm-manager` shows only those vendors at SCM-Manager stage.
- Login as an SCM Head / Finance 1 / Finance 2 / CEO Office / SAP Team user: no tenant dropdown; All Vendors / SAP Sync / dashboards show vendors from every tenant.
- Login as a Buyer / Customer Admin / Sharvi Admin / Vendor: behavior and header unchanged.
- Approval flow itself: unchanged.

## Out of scope

- No RLS changes.
- No changes to approval matrix, SAP sync, master data, buyer-company assignment.
- No change for any role outside the six listed.
