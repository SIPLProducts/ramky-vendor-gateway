## Why the vendor lands on /auth with "Session expired"

Trace of the current flow when the vendor clicks **Begin Registration**:

1. `/vendor/invite?token=…` (`VendorInviteAccept`) calls `claim-vendor-invite` while unauthenticated → server provisions the auth user and returns `status: 'signin_ready'` + `token_hash`.
2. Client calls `supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })`, then immediately `navigate('/vendor/registration?token=…')`.
3. `VendorRegistration` mounts. Two things happen almost simultaneously:
   - The `onAuthStateChange` listener at line 310 fires an early event (INITIAL_SESSION / TOKEN_REFRESHED with `session === null` while the token from step 2 is still being persisted to `localStorage`), matches the `(!session && event === 'TOKEN_REFRESHED')` branch, shows the **"Session expired — Please sign in again to continue your registration"** toast, and — because `invitationToken` state hasn't been populated yet — routes to `/auth`.
   - Even if the listener didn't fire, `validateToken` reads `getSession()` before the token hash is fully persisted, sees no session, and bounces back.

So the vendor sees the login screen instead of the registration form. It is a race between `verifyOtp` finishing and `VendorRegistration` running its session checks — not a real "session expired".

## Fix

### 1. `src/pages/VendorInviteAccept.tsx`
- After `verifyOtp` resolves, confirm the session is actually persisted before navigating:
  - `await supabase.auth.getSession()` in a small poll (up to ~2s) until `session?.access_token` exists.
  - Only then `navigate('/vendor/registration?token=…', { replace: true })`.
- If polling times out, show the existing error card (don't silently redirect).

### 2. `src/pages/VendorRegistration.tsx`
- Harden the `onAuthStateChange` guard (lines 308-326) so the initial mount race can't trigger the "Session expired" toast:
  - Skip the first `INITIAL_SESSION` event.
  - Only act on an explicit `SIGNED_OUT`. Remove the `!session && event === 'TOKEN_REFRESHED'` branch (a token refresh returning no session is transient during hydration, not a real sign-out).
  - When it does trigger, route to `/vendor/invite?token=…` if we have `invitationToken` **or** the `token` query param — never to `/auth` for vendors.
- In `validateToken` (lines 426-434), if `getSession()` returns null, wait briefly and re-check once before redirecting. Redirect target stays `/vendor/invite?token=…`, not `/auth`.

### 3. No backend changes
`claim-vendor-invite` already returns `signin_ready` + `token_hash` correctly; the bug is purely client-side session-hydration timing.

## Result

Vendor clicks the invitation link → they are signed in silently via the magic-link token hash → the registration form opens directly. No `/auth` detour, no "Session expired" toast.

## Not in scope
Forwarded-link protection (device binding / step-up verification) — deferred as previously agreed.
