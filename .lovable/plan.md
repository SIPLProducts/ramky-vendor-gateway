# Problem

In **User Management → Buyer ↔ SCM**, when the tenant scope is set to "Ramky Infrastructure Limited" (and some other tenants), the SCM Manager / Buyer dropdowns are empty ("No users with Buyer role…") and existing mappings show "No mappings yet", even though users with those roles are assigned to that tenant and mappings exist.

# Root cause

`src/components/admin/BuyerScmMapping.tsx → loadData()` does:

```ts
supabase.from('user_tenants').select('user_id, tenant_id')
```

with no `.range()` and no `.eq('tenant_id', tenantId)` filter. The `user_tenants` table currently holds **1452 rows**, but Supabase/PostgREST caps a single response at **1000 rows by default**. The first 1000 rows (in PostgREST's default order) come back; the remaining ~452 are silently dropped.

The component then builds `tenantUserSet` from that truncated result and uses it to filter the role-bearing users (`filterByTenant`) shown in the SCM Manager and Buyer dropdowns. For any tenant whose `user_tenants` rows fall in the dropped window — Ramky Infrastructure Limited is one of them — `tenantUserSet` ends up empty (or partial), so the dropdowns render empty and previously-saved mappings can't be enriched with profile names either.

This is exactly the same class of bug that was just fixed in `UserManagement.tsx`; it was missed here.

# Fix

Frontend-only change in `src/components/admin/BuyerScmMapping.tsx`:

1. Add a small paginated `fetchAll` helper (page size 1000, loop with `.range(from, from+pageSize-1)` until a short page is returned) — same shape as the one already added to `UserManagement.tsx`.
2. Use it for `user_tenants`. When a specific `tenantId` is selected, also push the filter server-side (`.eq('tenant_id', tenantId)`) so we stay well under 1000 rows in the common case; only fall back to the full paginated fetch when scope is "All Tenants".
3. Use the same `fetchAll` helper for `user_custom_roles` for future-proofing (currently 11 rows, but the same trap will bite later).
4. Replace the existing `userTenantsRes.data` / `ucrRes.data` reads with the helper's return values; rest of the enrichment logic (profile map, `tenantUserSet`, role partitioning, mapping enrichment) stays unchanged.

No database, RLS, edge function, or types changes are needed. After this, Ramky Infrastructure Limited (and any other tenant whose `user_tenants` rows previously fell outside the first 1000) will correctly list its Buyers and SCM Managers, and existing mappings will render with the right names.
