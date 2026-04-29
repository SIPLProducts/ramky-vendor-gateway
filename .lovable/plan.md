# Fix: Vendor Invitation "Company" dropdown only shows one tenant

## Problem

In **Create Vendor Invitation** dialog (`/admin/invitations`), users like `suresh.mareddy@ramky.com` who are assigned to **5 companies** in User Management see only **one** company — and as a read-only field, not a dropdown.

### Root cause (verified in DB)

`suresh.mareddy@ramky.com` has role `vendor` and is assigned to 5 tenants in `user_tenants`. The current code in `src/pages/AdminInvitations.tsx`:

1. Only renders a tenant **dropdown** when `userRole === 'sharvi_admin'`.
2. For every other role, runs a query with `.limit(1).maybeSingle()` against `user_tenants` and renders the result as a **read-only label**.

So even though Suresh has 5 assigned companies, the UI hard-codes the first one and gives no way to pick another.

## Fix

Replace the single-tenant lookup with the multi-tenant list already maintained by `useTenantContext` (the same source the global tenant switcher in the header uses), and render a real dropdown whenever the user has more than one assigned company.

### Changes in `src/pages/AdminInvitations.tsx`

1. **Remove** the `current-user-tenant` `useQuery` (the `.limit(1).maybeSingle()` block, lines ~81–97).
2. **Import and use** `useTenantContext` to get `myTenants` (the full list of tenants the logged-in user belongs to) and `activeTenantId` (current header selection).
3. Compute the list of tenants to offer in the dialog:
   - `sharvi_admin` / `admin` super-admin: all tenants (`tenants` from `useTenants`) — unchanged behavior.
   - Everyone else: `myTenants` from `useTenantContext` (all tenants they're assigned to).
4. Default `selectedTenantId` when the dialog opens:
   - Prefer the header's `activeTenantId` if it's in the allowed list.
   - Else first entry of the allowed list.
5. Render the **Company** field as a `Select` dropdown for **all** users when the allowed list has 2+ entries; render the existing read-only label only when there is exactly one tenant; keep the "No company assigned" message when the list is empty.
6. `effectiveTenantId` becomes simply `selectedTenantId || null` (single source of truth across roles).
7. Update the invitations list query (`vendor-invitations` queryKey + the client-side `tenant_id` filter) to use the chosen `selectedTenantId` instead of the removed `currentUserTenantId`, so the table filters consistently with the chosen company.

### Files touched

- `src/pages/AdminInvitations.tsx` — only file changed. No backend / migration / edge-function changes required (RLS already permits these inserts because Suresh is in `user_tenants` for each tenant).

## Outcome

Suresh (and any non-super-admin user assigned to multiple tenants) will see a working **Company** dropdown in the Create Vendor Invitation dialog listing all their assigned companies, defaulting to the one currently selected in the header tenant switcher.
