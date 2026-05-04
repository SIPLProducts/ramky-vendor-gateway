# Fix "Delete failed: Edge Function returned a non-2xx status code"

## Root cause

`auth.admin.deleteUser(user_id)` is failing with a foreign-key violation. Several `public` tables reference `auth.users(id)` **without** `ON DELETE CASCADE`, so when the user (e.g. a vendor like `priyakunchala77@gmail.com`) has rows pointing to them, Postgres blocks the auth delete and the function returns 400.

Blocking FKs found:
- `vendors.user_id → auth.users(id)` (no cascade)
- `vendors.finance_reviewed_by → auth.users(id)` (no cascade)
- `vendors.purchase_reviewed_by → auth.users(id)` (no cascade)
- `vendor_invitations.created_by → auth.users(id)` (no cascade)
- `audit_logs.user_id → auth.users(id)` (no cascade)
- `portal_config.updated_by → auth.users(id)` (no cascade)

The current edge function only cleans `user_custom_roles`, `user_tenants`, `user_roles`, `profiles` — it never touches the tables above, so the auth delete blows up.

## Fix

Update `supabase/functions/admin-delete-user/index.ts` to handle these references **before** calling `auth.admin.deleteUser`:

1. **Vendors owned by the user** (`vendors.user_id = user_id`): delete those vendor rows (including their dependent rows: `vendor_validations`, `vendor_documents`, `vendor_workflow_history`, `vendor_invitations` linked by `vendor_id`, etc., relying on existing cascades where present; otherwise delete in order). Keeping orphan vendor records belonging to a deleted auth user is not useful.
2. **Vendor reviewer references** (`vendors.finance_reviewed_by` / `purchase_reviewed_by = user_id`): set to `NULL` (preserve vendor history, just clear the reviewer pointer).
3. **vendor_invitations.created_by = user_id**: set to `NULL` (preserve invitation audit trail).
4. **portal_config.updated_by = user_id**: set to `NULL`.
5. **audit_logs.user_id = user_id**: keep history but set `user_id = NULL` so the FK no longer blocks (audit row stays, with the original `details` JSON). After this we can still write the new `user_deleted` audit row using the caller's id.
6. Then run the existing cleanup (`user_custom_roles`, `user_tenants`, `user_roles`, `profiles`) and call `auth.admin.deleteUser(user_id)`.
7. Improve error reporting: if `auth.admin.deleteUser` returns an error, return its `message` in the response body (already done) **and also** log it via `console.error` with the FK-related hint so future failures are visible in edge logs.

Order matters: do app-table cleanup → nullify reviewer/audit references → delete vendors-owned-by-user → delete profile/roles → finally delete auth user.

Also add a small `console.log` at each step (`step: 'vendors'`, `step: 'auth.delete'`, etc.) so logs make the failing step obvious next time.

## Out of scope

- No DB migration / schema change. We are not adding `ON DELETE CASCADE` to the FKs because that would alter business semantics (e.g. blowing away vendors when an auth user is removed). Instead we handle it explicitly in the edge function so the behavior is deliberate.
- No UI change in `UserManagement.tsx`. The error toast already surfaces the message; with the fix it will succeed.
