## Goal
Make `/vendor/invite?token=...` auto sign the invited vendor in and open `/vendor/registration?token=...` directly, without showing `/auth` and without requiring a second email.

## What I will fix
1. **Stop using stale/fragile magic-link URL tokens**
   - Update `claim-vendor-invite` so it returns the generated link’s official `hashed_token` value instead of parsing the `token` query string from `action_link`.
   - Keep the response shape compatible with the existing page (`signin_ready`, `token_hash`, `otp_type`, `redirect`).

2. **Make invite claim idempotent for repeated clicks/retries**
   - If the same invitation is opened multiple times quickly, avoid generating competing magic-link tokens that invalidate each other.
   - Bind the invitation to the intended auth user when possible and return a stable direct sign-in result for that request.

3. **Harden the browser auto-sign-in step**
   - In `VendorInviteAccept`, verify the returned token once, wait for the session to persist, then navigate to registration.
   - If verification returns `otp_expired`/`invalid`, retry the claim once to get a fresh token and verify again before showing an error.
   - Never redirect vendor invitation users to `/auth`; if session is missing, send them back through `/vendor/invite?token=...`.

4. **Improve registration session handoff**
   - Keep the existing registration session polling, but make the invite handler pass a clear “fresh invite sign-in” path so the registration screen does not fire the misleading “Session expired” toast during handoff.

5. **Deploy the edge function**
   - Deploy the updated `claim-vendor-invite` function so the self-hosted URL uses the corrected sign-in behavior.

## Expected result
- Buyer sends invitation.
- Vendor clicks **Begin Registration** or opens `/vendor/invite?token=...`.
- Page silently signs the vendor in.
- Vendor lands directly on `/vendor/registration?token=...` and sees the registration form.
- `/auth` login page is not shown for this vendor flow.