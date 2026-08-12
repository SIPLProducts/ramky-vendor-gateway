# Fix "row-level security policy for table tenants" when saving a user

## Why it happens (confirmed in code)

Creating and editing a user take two different paths:

- **Create user** — the browser sends the fetched SAP tenants to the `admin-create-user` backend function, which upserts them into the `tenants` table with admin privileges. That always works.
- **Edit user** — `EditUserDialog` upserts into `tenants` **directly from the browser**, as the logged-in user.

The `tenants` table only allows writes to `sharvi_admin`, the built-in `admin` role, or a user holding the `sharvi_admin_console` screen permission. The account you use in DEV is an admin-type custom role without that permission, so Postgres rejects the write with code 42501. In production the account you edit with is a built-in admin, so it slips through — same code, different account, which is why it looks environment-specific.

## The fix

Make the edit path work like the create path: resolve SAP tenants on the server, never from the browser.

1. **New backend function `resolve-sap-tenants`**
   - Validates the caller's token and requires the same authority as user management (`sharvi_admin`, `admin`, or the `user_management` screen permission); otherwise 403.
   - Accepts `{ sap_tenants: [{ code, name }] }`, upserts them into `tenants` by `code` with admin privileges, and returns the matching tenant ids.

2. **`src/components/admin/EditUserDialog.tsx`**
   - Replace the direct `supabase.from('tenants').upsert(...)` in `resolveSapTenantIds` with a call to the new function, and surface a clear message if it returns 403 instead of the raw Postgres error.

3. **Same-turn deploy** of the new function so DEV picks it up.

No RLS policy is loosened — tenant writes stay restricted, they just happen server-side after an explicit permission check.

## Note on DEV vs PROD

If you also want the DEV account to behave like an admin elsewhere, grant its custom role the `sharvi_admin_console` screen permission — but that is optional; the fix above makes user editing work regardless of which admin-type role saves the record.
