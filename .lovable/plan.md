# Make all Tenant / Buyer Company dropdowns searchable

User Management already uses the searchable `TenantCombobox` (with a "Search tenant…" input). The same searchable picker should be applied to every other tenant / buyer-company dropdown across the app, so users don't have to scroll through long lists.

## Dropdowns to convert

Replace the current shadcn `Select` (or similar) with `TenantCombobox` (which already provides search, "All Tenants" option, keyboard nav, and a consistent look):

1. **Top header tenant switcher** — `src/components/layout/EnterpriseHeader.tsx`
   - Current: `Select` over `myTenants` with `__all__` option.
   - New: `TenantCombobox` with `allowAll`, bound to `activeTenantId` / `setActiveTenantId`. Keep the compact header sizing (`triggerClassName="h-8 text-xs w-[200px]"`).

2. **SAP Sync — Buyer Company filter** — `src/pages/SAPSync.tsx` (~line 391)

3. **Vendor List — Buyer Company filter** — `src/pages/VendorList.tsx` (~line 347)

4. **Finance Review — Buyer Company filter** — `src/pages/FinanceReview.tsx` (~line 211)

5. **Purchase Approval — Buyer Company filter** — `src/pages/PurchaseApproval.tsx` (~line 272)

6. **Sharvi Admin Console — tenant picker** — `src/pages/SharviAdminConsole.tsx` (~line 42)

7. **Admin Invitations — tenant pickers (2)** — `src/pages/AdminInvitations.tsx` (lines 839, 934)
   - The second one is inside a per-row picker; reuse `TenantCombobox` there too (single-select). For the "All Tenants" filter variant pass `allowAll`; for the per-invite assignment pass it without `allowAll`.

## Component reuse

Use the existing `src/components/admin/TenantCombobox.tsx` as-is. It already supports:
- `allowAll` + custom `allLabel` (e.g. "All Buyer Companies" for the buyer-company filters),
- search input,
- value as tenant id or `null`,
- optional `userCounts`.

For the buyer-company filters, pass `allLabel="All Buyer Companies"` and map current `'all'` ↔ `null` at the call site so existing filter logic keeps working without changing queries/hooks.

## Out of scope

- No changes to data models, hooks, queries, or filter logic.
- No changes to non-tenant dropdowns (status, role, etc.).
- No styling/theme changes beyond making each trigger match its surrounding layout (header stays compact; page filters stay at default height).

## Verification

- Open each screen above, confirm the dropdown shows a "Search tenant…" / "Search…" input, filters as you type, and selecting an option applies the same filter behavior as today.
- Header switcher still toggles tenant scope across the app, including the `__all__` → null path.
