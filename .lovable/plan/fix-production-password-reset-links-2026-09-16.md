# Fix Production Password-Reset Links

## Confirmed cause

- The browser already submits the current portal address dynamically as `<current portal>/reset-password`.
- Quality is running the new flow: its email opens `http://10.200.1.7/reset-password?token_hash=...&type=recovery`.
- Production is still receiving the legacy authentication URL: `https://vendx.ramky.com/auth/v1/verify?...`.
- There is no active `vendx.ramky.com` hardcode in the password-reset screen or reset-email function source.
- The current email function falls back to the authentication service's generated URL when an older production authentication version does not return a separate `hashed_token`. If that service still has the former `SITE_URL`, the fallback exposes `vendx.ramky.com`.
- The older bootstrap script also leaves the reset redirect allow-list empty, while the newer deployment scripts set and verify it.

## Changes

1. **Remove the legacy-host fallback from reset emails**
   - Prefer the returned `hashed_token` as today.
   - For older authentication versions, safely extract the equivalent recovery token from the generated action URL.
   - Always construct the customer-facing link from the validated requesting portal origin: `<origin>/reset-password?token_hash=...&type=recovery`.
   - If no usable recovery token is returned, fail the send instead of emailing a foreign or stale hostname.

2. **Make every self-host setup consistent**
   - Update the older setup path to set `<PUBLIC_BASE_URL>/reset-password` as the allowed reset destination.
   - Keep the existing deployment-time checks for the active site, API, and reset URLs.

3. **Prevent stale production function deployments**
   - Add an explicit deployment check that the copied production `send-password-reset` function contains the direct-portal recovery-link implementation before restarting functions.
   - This makes deployment stop rather than silently leaving the old email behavior active.

4. **Validate the complete production-safe behavior**
   - Test both authentication response shapes: modern `hashed_token` and older action-link-only output.
   - Confirm neither generated email contains `vendx.ramky.com` and both point to the supplied environment origin.
   - Verify the reset page accepts the resulting token and reaches the new-password form.

## Production rollout

Deploy the updated function and authentication URL settings with production's real public URL (`https://vyapaar.ramky.com`), then request a brand-new reset email. Existing recovery emails are single-use/short-lived and will not be repaired.
