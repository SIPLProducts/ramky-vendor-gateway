## Root cause

- `sunilakula1919@gmail.com` has **two** rows in `public.user_roles`: `vendor` (auto-inserted by the `handle_new_user` trigger on signup) and `approver` (added later by `admin-create-user`).
- `useAuth.loadRoles()` fetches the role with `.maybeSingle()`, which errors with PGRST116 ("multiple rows returned") — visible in the console logs.
- On error, `userRole` stays `null` and `rolesError = true`. The `Auth.tsx` redirect effect requires `userRole` to be set before navigating, so the user is stuck on `/auth` even though sign-in itself returns 200 (confirmed in auth logs).

Any admin-created non-vendor user is at risk of the same issue.

## Fix

1. **Data cleanup for this user** — delete the stray `vendor` row so only `approver` remains:
   ```sql
   DELETE FROM public.user_roles
   WHERE user_id = '4ccfd629-b769-4fe3-b187-ba1ab1f33b0a'
     AND role = 'vendor';
   ```

2. **Prevent recurrence in `admin-create-user`** — when the edge function assigns a non-vendor role, first delete any existing `vendor` row for that `user_id`, then upsert the target role (so re-runs don't duplicate).

3. **Defensive fix in `useAuth.loadRoles`** — replace `.maybeSingle()` with a `.select('role').order(...).limit(1)` fetch (or read all rows and pick the highest-priority non-vendor role) so a duplicate never blocks login again. Also clear `rolesError` UI gate so a role-fetch failure falls back to `vendor` instead of hanging.

After step 1 the user can log in immediately; steps 2 and 3 stop this class of bug for future admin-created users.