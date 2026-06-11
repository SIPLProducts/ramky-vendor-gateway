## Why the save fails

The toast says `new row violates row-level security policy for table "user_roles"`. The Change Role dialog calls `supabase.from('user_roles').insert(...)` from the browser. The current RLS policy on `user_roles` is:

```
INSERT WITH CHECK ( has_role(auth.uid(), 'sharvi_admin') OR has_role(auth.uid(), 'admin') )
```

`has_role` only looks at the **built-in** `user_roles` table. The user who is logged in (left sidebar "Admin") is set up with the **custom role named "Admin"**, not the built-in `admin` app_role — so `has_role(...)` returns false and the insert is blocked. The same gap exists on `user_tenants` (only built-in `sharvi_admin` / `customer_admin` can manage rows), which would fail the very next step the same way once you change tenants.

The edge function `admin-create-user` already treats the custom roles "Admin", "Sharvi Admin" and "Customer Admin" as admin-equivalent. The database policies haven't been updated to match, so direct client writes fail.

## Fix

One migration:

1. Add a security-definer helper:

```sql
public.is_admin_like(_user_id uuid) RETURNS boolean
-- true when the user has built-in admin / sharvi_admin / customer_admin
-- OR an active custom role named 'Admin' / 'Sharvi Admin' / 'Customer Admin'
```

2. Replace the INSERT/UPDATE/DELETE policies on `public.user_roles` to use `public.is_admin_like(auth.uid())` (plus self-protection so users can't elevate themselves — keep current behavior).

3. Replace the manage policies on `public.user_tenants` so admin-like users can insert/update/delete rows (built-in `sharvi_admin` / `customer_admin` policies stay).

4. `user_custom_roles` already allows `has_screen_permission(auth.uid(), 'user_management')`, so it works for the Admin custom role and needs no change — but I'll align it to also use `is_admin_like` for consistency.

No frontend changes needed; the dialog flow is correct.

## Validation

Log in as the user with the custom "Admin" role, change another user's role and tenant access, save — the update succeeds and the audit log entry is written. Built-in `sharvi_admin` users continue to work unchanged.
