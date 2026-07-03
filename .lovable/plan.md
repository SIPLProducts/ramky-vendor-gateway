## Goal
Make the vendor invitation link open the Vendor Registration Form directly again, without sending vendors to the normal login page.

## What I will fix
1. **Stop stale sessions breaking invite login**
   - When `/vendor/invite?token=...` opens, clear any invalid/stale local auth session before attempting silent invite sign-in.
   - This directly addresses the `session_not_found` 403 from `/auth/v1/user`.

2. **Avoid `getUser()` during the invite handoff**
   - The invite handler currently waits for both `getSession()` and `getUser()`.
   - Because `getUser()` returns `session_not_found` when the old JWT session id no longer exists, the page can stay stuck on “Signing you in…” or bounce.
   - I will change the handoff to trust the freshly returned `verifyOtp` session, persist it with `setSession`, then navigate to registration.

3. **Prevent missing vendor role from blocking the form**
   - The `user_roles` request returns `PGRST116` because no role row exists yet for the newly provisioned vendor.
   - I will make role loading tolerate “no row” as vendor instead of treating it as an error, and ensure the backend creates/binds the vendor role where needed.

4. **Keep vendors away from `/auth`**
   - If registration still cannot confirm the invite session, it will route back to `/vendor/invite?token=...`, not the normal login screen.

5. **Verify the flow**
   - Test the invite URL flow in the browser: `/vendor/invite?token=...` → silent sign-in → `/vendor/registration?token=...` → Select Vendor Type / registration form.

## Files expected to change
- `src/pages/VendorInviteAccept.tsx`
- `src/hooks/useAuth.tsx`
- Possibly `supabase/functions/claim-vendor-invite/index.ts` if the invite-created user is missing a vendor role row.

## Expected result
The vendor clicks **Begin Registration** and reaches the Vendor Registration Form directly; the normal login page should not appear for this invite flow.