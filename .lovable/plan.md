## Fix Buyer ↔ SCM tab — enable dropdowns globally and fix data source

The dropdowns currently disable themselves when "All Tenants (Global)" is selected, which is why they appear greyed out. They also filter the user list down to a tenant, so users created without a tenant assignment never appear. Fixes:

### Changes in `src/components/admin/BuyerScmMapping.tsx`

1. **Remove `disabled={!tenantId}`** from both `<Select>` components and the Save button so the dropdowns are always usable.
2. **Always show all users** that have the `SCM Manager` / `Buyer` custom role (assigned via the Users tab → Change Role dialog), regardless of tenant scope. When a tenant is selected we still narrow the list, but when "All Tenants (Global)" is chosen we show every matching user.
3. When saving without a tenant selected, prompt the admin to pick a tenant in the scope selector first (toast already exists; keep it).
4. Update the empty-state hint to: "No users with SCM Manager / Buyer role. Assign the role in the Users tab."

### Result

- Selecting "All Tenants (Global)" now lists every SCM Manager and every Buyer from the Users tab in the dropdowns.
- Selecting a specific tenant filters to users belonging to that tenant.
- Save still requires a tenant context (mapping is per-tenant) and shows a clear toast if none is chosen.
