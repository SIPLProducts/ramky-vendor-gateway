## Goal
Restore the vendor invitation flow so clicking **Begin Registration** or opening `/vendor/invite?token=...` silently signs in the invited vendor and opens `/vendor/registration?token=...` without showing `/auth`, second emails, or a false “Session expired” toast.

## Root cause to address
The current flow is getting stuck between the invite auto-sign-in page and the registration page. The registration page can still decide the session is missing before the newly verified invite session has fully hydrated, then redirects back to `/vendor/invite` and shows the “Session expired” toast. This creates the visible loop shown in your screenshot.

## Implementation plan
1. **Stabilize invite auto sign-in**
   - Update `VendorInviteAccept` so after `verifyOtp()` succeeds it explicitly calls `setSession()` when session tokens are returned.
   - Wait for both `getSession()` and `getUser()` to confirm the signed-in user before navigating.
   - Keep retry only for real expired/invalid OTP failures, not for successful-but-slow hydration.

2. **Make registration wait for auth readiness**
   - Update `VendorRegistration` token validation to wait longer and trust the fresh invite handoff flag before redirecting.
   - During a fresh invite handoff, do not show “Session expired” and do not send the vendor to `/auth`.
   - If auth is still not ready, send the user back through `/vendor/invite?token=...` only after a controlled timeout.

3. **Prevent stale signed-in users from breaking vendor links**
   - In `VendorInviteAccept`, if the browser already has a different logged-in user, sign out locally before processing the invite token.
   - This keeps buyer/admin testing sessions from blocking a vendor invite link.

4. **Keep backend behavior simple**
   - Keep `claim-vendor-invite` in the direct-sign-in mode: provision/find invited auth user, generate link, return `hashed_token`, and let the client verify it immediately.
   - Do not reintroduce secondary verification emails.

5. **Deploy and verify**
   - Deploy the updated `claim-vendor-invite` function if backend code changes are needed.
   - Verify the path: invitation link → signing screen → registration form, with no `/auth` and no second email.
   - Also verify direct `/vendor/registration?token=...` without a session routes back through invite handling rather than generic login.