## Goal
Restore the working vendor invitation behavior: when a vendor clicks **Begin Registration** or opens `/vendor/invite?token=...`, the app should open the Vendor Registration Form directly, without sending the vendor to `/auth` and without the `session_not_found` loop.

## What I will change
1. **Make the invite link the entry point again**
   - Keep `/vendor/invite?token=...` as the only vendor email entry.
   - It will validate the invite token and move the vendor straight to `/vendor/registration?token=...`.
   - It will not depend on the browser’s current/stale auth session before opening the form.

2. **Stop stale sessions from blocking registration**
   - Remove the fragile silent magic-link/session handoff that calls auth user/session endpoints before the form opens.
   - Prevent `session_not_found` from redirecting vendors to `/auth` during invite entry.
   - Keep buyer/admin login behavior unchanged.

3. **Restore registration page access for valid invite tokens**
   - In `VendorRegistration`, validate the token through the backend/database invite lookup.
   - If the token is valid and not expired, allow the form to render.
   - Only show access denied for missing, invalid, expired, or mismatched invite tokens.

4. **Keep the minimum backend binding needed**
   - Keep `claim-vendor-invite` only for safe invite lookup/account preparation where needed.
   - Avoid returning/using one-time OTP magic-link tokens as the page-opening mechanism, because those are what currently cause expiry/session errors.

5. **Verify the flow**
   - Test opening a sample invite URL from a fresh browser context.
   - Confirm it reaches the Vendor Registration Form, not `/auth`.
   - Confirm buyer/admin protected routes still require normal sign-in.

## Expected result
Vendor clicks invite link → sees Vendor Registration Form directly again, matching the flow that was working before 02-07-2026 around 12:00.