## Problem

On the User Management page, Ajay Babu's Tenant column shows "None" even though many tenants are assigned in the DB.

Root cause: `loadData()` in `src/pages/UserManagement.tsx` does:
```ts
supabase.from('user_tenants').select('user_id, tenant_id')
```
The `user_tenants` table currently has **1452 rows**, but Supabase/PostgREST caps a single response at **1000 rows by default**. The first 1000 rows (ordered by PostgREST's default) are returned, and Ajay Babu's mappings fall outside that window — so the in-memory `utByUser` map has no entries for his user id, and the UI renders "None".

The same risk applies to `user_custom_roles` as the project grows.

## Fix

In `src/pages/UserManagement.tsx`, replace the single-shot fetches of `user_tenants` and `user_custom_roles` with a paginated helper that loops with `.range(from, from+pageSize-1)` until fewer than `pageSize` rows come back, returning the full list. Use a page size of 1000. Apply it to both `user_tenants` and `user_custom_roles` (other tables in `loadData` are safely under 1000 rows today; tenants list is already filtered to active and well below the cap).

No DB / RLS / backend changes — purely a frontend data-fetch fix. The tenant column will then display all assigned tenant names for every user.
