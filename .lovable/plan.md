# Fix login validation + user creation errors

## Issue 1 — Non-vendor login shows "Vendor accounts must use invitation link"

**Root cause:** In `src/hooks/useAuth.tsx`, `loadRoles()` falls back to `setUserRole('vendor')` whenever the `user_roles` query returns an error OR when `maybeSingle()` returns null. On a slow/transient response the auth state briefly reads `userRole = 'vendor'` + `hasCustomRole = false`, so `isVendor` becomes `true`. `Auth.tsx`'s effect then signs the user out and shows the vendor-only error, even though the account is `sharvi_admin`.

Contributing factor: `loading` in `useAuth` is initialized `true` but only set back to `false` inside `loadRoles()`'s `finally` (or the "no session" branch). After a fresh sign‑in, `authLoading` can already be `false` from the initial `getSession()`, so `Auth.tsx`'s guard `if (!user || authLoading || !userRole) return;` no longer waits for roles to reload — it races.

**Fix (frontend only):**
1. `src/hooks/useAuth.tsx`
   - Add a dedicated `rolesLoading` boolean (true while `loadRoles` is in flight, including after a new sign-in).
   - Do NOT default `userRole` to `'vendor'` on error. Keep it `null` and surface a flag `rolesError`. Only set a real role when the query succeeds.
   - Set `rolesLoading = true` when `onAuthStateChange` sees a new user, reset to `false` in `loadRoles` finally.
   - Export `rolesLoading` from the context.

2. `src/pages/Auth.tsx`
   - Change the redirect guard to `if (!user || authLoading || rolesLoading || !userRole) return;` so the vendor check never runs against a null/default role.
   - Keep the existing `isVendor` branch unchanged.

3. `src/components/auth/ProtectedRoute.tsx`
   - Also wait on `rolesLoading` before evaluating `isVendor`, so the same race can't bounce a non-vendor to the vendor screen.

No DB, RLS, or edge-function changes.

## Issue 2 — Create User shows "Edge Function returned a non-2xx status code"

**Root cause:** `admin-create-user` now returns HTTP 409 with a friendly JSON body when the email already exists (recent change). But `supabase.functions.invoke()` throws a generic `FunctionsHttpError` for any non-2xx response, and `CreateUserDialog.handleSubmit` does `if (error) throw error;` — so the toast shows the generic SDK message instead of the server's message.

**Fix (frontend only):** In `src/components/admin/CreateUserDialog.tsx` `handleSubmit`:
- When `error` is present, attempt `await error.context?.json?.()` (or `.text()` fallback) to read the server's `{ error, code }` body and show that message in the toast.
- Special‑case `code === 'email_exists'` (or a message match) with: "A user with this email already exists. Edit the existing user or use a different email." and keep the dialog open.
- Leave the successful path untouched.

No backend change needed — the edge function already returns the right payload.

## Out of scope
- No changes to auth signup flow, RLS, tenants, SAP fetch, or approval workflows.
- No visual/design changes.

## Files touched
- `src/hooks/useAuth.tsx`
- `src/pages/Auth.tsx`
- `src/components/auth/ProtectedRoute.tsx`
- `src/components/admin/CreateUserDialog.tsx`
