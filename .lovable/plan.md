## Fix Buyer Approval — Buyer Company data + tenant filter UX

### 1. Populate `Buyer Company` for the BUYER stage (edge function)

File: `supabase/functions/list-pending-approvals-by-stage/index.ts`

The BUYER branch currently returns items without `tenantId` / `vendorCompany`, so the column always shows `—` and the header multi-select cannot filter rows.

Update the BUYER branch to:

- Also select `tenant_id` on the pending `vendors` query and on the `rejectedVendors` query.
- Also fetch `tenant_id` on the invitation lookup (`invsForBuyer`).
- Load matching rows from `tenants (id, name, code)` for the union of vendor + invitation tenant ids.
- On every returned pending and rejected item add:
  - `tenantId`: `v.tenant_id ?? inv.tenant_id ?? null`
  - `vendorCompany`: `"<name> (<code>)"` from the vendor tenant, else null
  - `invitationCompany`: same shape from the invitation tenant, else null
  - `companyMismatch`: true when both exist and differ

No schema, RLS, or business-logic changes — purely additive fields for display + filtering.

### 2. Add "Select all / Clear all" to the tenant multi-select

File: `src/components/admin/TenantCombobox.tsx`

In `multi` mode only, add a compact action row above the tenant list inside the popover with two text buttons:

- `Select all` → `onChangeMulti(tenants.map(t => t.id))`
- `Clear all` → `onChangeMulti(null)` (equivalent to "All Tenants")

Keep the existing `All Tenants` row and per-tenant toggles unchanged. Trigger label stays as-is (`All Tenants` when empty, tenant name when 1, `N tenants selected` otherwise).

### 3. Ensure the header multi-select actually filters Buyer Approval

Already wired in `StageApprovalView.tsx` (lines 44–46) via `activeTenantIds` on `item.tenantId`. With step 1 in place the filter starts working automatically; no code change needed here beyond verifying it.

### Verification

- Redeploy `list-pending-approvals-by-stage`.
- As a buyer assigned to multiple tenants: Buyer Company column shows the tenant name (e.g. `FOSS INDIA... (CODE)`), and selecting one tenant in the header filters the table to just that tenant's rows. Select all / Clear all work as expected.
- As a buyer with a single tenant: column stays hidden (unchanged behaviour).
- `bunx tsgo --noEmit` clean.

### Out of scope

- No changes to non-Buyer stages, RLS, or approval flow.
- No renaming of existing fields.
