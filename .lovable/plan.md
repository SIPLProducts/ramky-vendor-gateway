## Problem

On Submit you see `Submission Failed — new row violates row-level security policy for table "vendors"`. The autosave indicator already showed `Draft kept locally — will retry` for a while before that.

## Root cause

`saveVendorMutation` in `src/hooks/useVendorRegistration.tsx` does:

```ts
const { data: { user } } = await supabase.auth.getUser();
const userId = user?.id || null;
...
user_id: userId,
```

If the Supabase session has expired (or wasn't refreshed in the background), `getUser()` returns `null`, `userId` becomes `null`, and the row sent to Postgres has `user_id = null`. The RLS policy on `vendors` is:

```
Vendors can insert own data — WITH CHECK (user_id = auth.uid())
```

`auth.uid()` is also `null` for an unauthenticated request, but `null = null` evaluates to `NULL` (not true), so the policy fails and Postgres returns the RLS error. The logs in Lovable Cloud confirm a long burst of identical `new row violates row-level security policy for table "vendors"` errors from `postgrest` (authenticator role) — meaning the requests are hitting the API without a valid user JWT. That's why every autosave failed silently and the final Submit blew up the same way.

The current `/auth` URL in your preview is the side-effect: the session is gone, so the app sent you to login.

## Fix (frontend only, no DB / RLS change)

1. **`src/hooks/useVendorRegistration.tsx` → `saveVendorMutation.mutationFn`**
   - Replace `supabase.auth.getUser()` with `supabase.auth.getSession()`.
   - If `session` is missing/expired, call `supabase.auth.refreshSession()` once.
   - If still no session, throw a typed error (`AUTH_REQUIRED`) instead of attempting the insert/update with `user_id = null`. This stops the doomed insert and the misleading RLS toast.

2. **Same file → `saveVendorMutation.onError`**
   - Detect the new `AUTH_REQUIRED` error and show a clear toast: *"Your session expired. Please sign in again to continue."* Then `navigate('/vendor/invite?token=...')` (or `/auth`) so the vendor re-authenticates and resumes the saved local draft.

3. **Same file → `submitVendorMutation.mutationFn`**
   - Guard the same way before calling `saveVendorMutation.mutateAsync`. If `AUTH_REQUIRED` bubbles up, swap the destructive "Submission Failed — RLS" toast for the friendly "session expired, please log in" toast and redirect.

4. **`src/pages/VendorRegistration.tsx`**
   - On mount, subscribe to `supabase.auth.onAuthStateChange`. When the session becomes `null` while the form is open, set a banner state and route to the invite/login page with the token preserved, so the user never spends 10 minutes filling a form against a dead session.

5. **No DB migration.** Current policy `user_id = auth.uid()` is correct; we just stop sending bad rows.

## Verification

- Reproduce: open form, wait for session to expire (or sign out in another tab), try to save → expect the new toast + redirect, **no** red "row-level security" error.
- Happy path: sign in fresh, fill form, submit → autosaves succeed, submit succeeds, vendor row appears in `vendors` with correct `user_id` and `tenant_id`.
- Check `postgres_logs`: no more bursts of `new row violates row-level security policy for table "vendors"`.

## Out of scope

- No RLS policy edits.
- No changes to approval flow, GST tab, or other tables.
