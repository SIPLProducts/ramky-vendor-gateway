## Issue

On your self-hosted server, User Management shows **"Failed to load users — column profiles.status does not exist"**.

The cloud database used in preview already has the `status` and `last_login_attempt_at` columns on `profiles`, plus a `login_attempts` table and a `check_user_active` RPC. Your self-hosted Supabase database is missing all of these because the migration was never applied there.

Nothing needs to change in the app code — it already queries `profiles.status` correctly.

## Fix

Apply the existing migration file to your self-hosted Supabase database:

`supabase/migrations/20260702094621_ac1ab483-2cfb-48e5-9baf-8fcb81b62b1d.sql`

It will:

1. Add `status` (default `'active'`) and `last_login_attempt_at` columns to `public.profiles`, with a check constraint restricting status to `active` / `inactive`.
2. Create `public.login_attempts` table with indexes, grants, RLS, and an admin-only SELECT policy.
3. Create the `public.check_user_active(email)` SECURITY DEFINER RPC used during sign-in.

### How to apply on the server

Run the SQL file against your self-hosted Postgres, for example:

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260702094621_ac1ab483-2cfb-48e5-9baf-8fcb81b62b1d.sql
```

Or use `supabase db push` from your self-hosted CLI setup if you have the migrations tracked.

### Verify

After applying, reload User Management. The red "column profiles.status does not exist" error will be gone and users will load.

## Also check

Confirm all other migrations under `supabase/migrations/` are applied on the server — if this one was skipped, others may be too (approval matrix, tenants, etc.). Running `supabase db push` on the server will bring it fully in sync.
