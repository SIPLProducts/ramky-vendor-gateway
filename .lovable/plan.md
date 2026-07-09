## Goal
1. Fix the SAP Sync tracker so the "SAP Sync" step only reads "Vendor Code Created" and shows the SAP Vendor Code once the vendor is really created in SAP; otherwise show a pending label.
2. On the Buyer Approval screen, show the "Buyer Company" column only when the logged-in Buyer effectively has more than one tenant in scope (assigned or selected).
3. Convert the header tenant picker (used by the Buyer on this screen) to a multi-select, and use that selection to drive both the vendor list filtering and the column visibility above.

Nothing else in the approval/SAP flow changes — no backend logic, RLS, or edge-function payload changes.

## Files to change
- `src/components/vendor/RegistrationStatusTracker.tsx`
- `src/pages/VendorStatus.tsx` (to surface `sap_vendor_code` on the SAP step)
- `src/components/approvals/StageApprovalView.tsx`
- `src/components/admin/TenantCombobox.tsx` (add optional multi-select mode)
- `src/hooks/useTenantContext.tsx` (add `activeTenantIds: string[] | null` while keeping the existing `activeTenantId` for other consumers)
- `src/components/layout/EnterpriseHeader.tsx` (use multi-select mode for Buyer role)
- `src/hooks/usePendingApprovalsByStage.tsx` (respect multi-tenant filter for Buyer stage)

## Change details

### 1. SAP Sync step label
- Extend `RegistrationStatusTracker` to accept an optional `sapVendorCode?: string | null`.
- In `statusSteps`, keep label "SAP Sync"; the description becomes dynamic:
  - if step is `completed` AND `sapVendorCode` present → `Vendor Code Created · {code}`
  - if step is `completed` (fallback) → `Vendor Code Created`
  - if step is `active` → `Syncing to SAP…`
  - otherwise → `Awaiting SAP sync`
- Only mark the SAP step `completed` when `status === 'sap_synced'`, `dms_sync_pending`, `dms_synced`, or `approved` (i.e. when `sap_vendor_code` actually exists). Being merely `pending_sap_sync` / `purchase_approved` / `finance_approved` must render the step as `active`, not `completed`, so the UI no longer claims the code is created prematurely.
- `VendorStatus.tsx` reads `sap_vendor_code` from `vendors` and passes it into the tracker.

### 2. Buyer Approval — conditional "Buyer Company" column
- In `StageApprovalView`, when `stage === 'BUYER'`:
  - Compute `effectiveTenantCount` from `useTenantContext()`:
    - if the Buyer has selected specific tenants → use that count;
    - else use `myTenantIds.length`.
  - Show the `Buyer Company` column only when `effectiveTenantCount > 1`.
  - Column source: `it.vendorCompany` (already available in `StageApprovalItem`).
  - Colspan for empty/skeleton rows is recomputed from the visible columns.

### 3. Multi-select tenant dropdown (Buyer role)
- `TenantCombobox` gains an optional `multi` mode:
  - New props: `multi?: boolean`, `values?: string[]`, `onChangeMulti?: (ids: string[]) => void`.
  - Behaviour: checkbox-style items, trigger shows "All Tenants", "{Name}", or "{n} tenants selected".
  - Single-select behaviour is unchanged when `multi` is not set.
- `useTenantContext`:
  - Add `activeTenantIds: string[] | null` (null = all) and `setActiveTenantIds`.
  - Keep the existing single `activeTenantId` in sync with the first item when the Buyer picks exactly one, so all other consumers keep working unchanged.
- `EnterpriseHeader`: for Buyer role (`isBuyerRole`) render the `TenantCombobox` in `multi` mode bound to `activeTenantIds`. Other roles keep the current single-select combobox.
- `usePendingApprovalsByStage` (BUYER branch only): if `activeTenantIds` is a non-empty subset, filter items by `tenant_id ∈ activeTenantIds`. Otherwise use the current behaviour.
- `StageApprovalView`'s column visibility uses the same `activeTenantIds`/`myTenantIds` counts described in section 2.

## Out of scope
- No DB migrations, RLS changes, edge-function payload changes.
- No changes to non-Buyer approval screens' column layouts.
- SAP sync business logic (edge function `sync-vendor-to-sap`) is not modified — DB already sets `sap_vendor_code` only on real SAP success, so this is purely a UI display fix.

## Verification
- `bunx tsgo --noEmit` passes.
- Preview: for a Buyer with 1 tenant, column hidden; with multiple tenants, column shows and multi-select filter works.
- Vendor Status page for a vendor still in `pending_sap_sync` shows "Awaiting SAP sync" (not "Vendor Code Created"); after real SAP success it shows "Vendor Code Created · {code}".
