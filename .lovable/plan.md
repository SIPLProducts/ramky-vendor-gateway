# Fixes: Dashboard tenant + date filters

## 1. "All Tenants" gets reset to first company

**Cause:** In `src/hooks/useTenantContext.tsx`, the auto-select effect treats `activeTenantId === null` as "no selection" and forces it back to `myTenantIds[0]` for non-admin users. So when a Buyer picks "All Tenants" (null), it immediately snaps to the first tenant.

**Fix (`src/hooks/useTenantContext.tsx`):**
- Track an explicit "user chose All" intent. Simplest: only auto-pick the first tenant on initial mount when `localStorage` has no stored value. Once the user explicitly sets null via the header dropdown, persist a sentinel (`'__all__'`) in localStorage and stop auto-correcting to the first tenant.
- Update `setActiveTenantId(null)` to write `'__all__'` to localStorage; on load, treat `'__all__'` as null and skip the "pick first" branch.

**Fix (`src/hooks/useTenantContext.tsx` → `useTenantFilter`):** for Buyers, when `activeTenantId === null` return `tenantIds: myTenantIds` so the dashboard query spans every assigned tenant (instead of only `scopedVendorIds`, which is invite-scoped). When a specific tenant is picked, intersect: `tenantIds: [activeTenantId]` AND keep `vendorIds: scopedVendorIds` so buyer still only sees their own invited vendors within that tenant.

## 2. Date pickers should be real date inputs, not popover buttons

**Fix (`src/pages/Dashboard.tsx`):** Replace the two `<DatePickerButton>` (Popover + Calendar) instances with native `<Input type="date">` controls labeled "From" and "To". Remove the `DatePickerButton` helper, `Calendar`/`Popover` imports, and the `CalendarIcon` usage in the picker.
- Value bound as `format(dateFrom, 'yyyy-MM-dd')`; onChange parses with `new Date(e.target.value)` → `startOfDay` / `endOfDay`.
- Keep the self-correcting behavior (From > To bumps To, etc.).

## 3. "Clear" not working

**Cause:** Clear currently resets to "last 30 days → today", which often equals the already-selected range, so visually nothing changes and the filter still excludes older/newer rows.

**Fix (`src/pages/Dashboard.tsx`):** Make Clear truly clear the filter:
- Change `dateFrom` / `dateTo` state to `Date | null`.
- When both are null, drop the `.gte` / `.lte` clauses in the query so all vendors load.
- Clear button sets both to `null` and the date inputs render empty.
- Export filename falls back to `vendors_all.xlsx` when either bound is null.

## Out of scope
- No DB / RLS / edge-function changes.
- No changes to Invitations page or other approver screens.
- Header "All Tenants" item stays visible as already implemented.
