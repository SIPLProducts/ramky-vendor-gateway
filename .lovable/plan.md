# Fix password-reset links to use the current portal URL

The email template does **not** hardcode `vendx.ramky.com`. The forgot-password screen already sends the current browser address (`window.location.origin/reset-password`), but the self-hosted authentication service generates the final verification link from its configured site/API URL. The screenshot confirms that this server configuration is still producing the old `vendx.ramky.com` host and replacing the requested redirect with the same old host.

## What will be changed

1. **Make reset-link generation environment-aware**
   - Update the password-reset function to use the portal origin that initiated the request.
   - Validate the origin and always build the final destination as `<current portal origin>/reset-password`.
   - Normalize both the Reset Password button URL and the visible fallback URL, including the self-hosted `/supabase/auth/v1/verify` path.

2. **Correct the self-hosted authentication configuration**
   - Ensure the deployment configuration writes the active `PUBLIC_BASE_URL` into the authentication site URL and public API URL.
   - Add the corresponding `/reset-password` URL to the allowed redirect list so the authentication service does not silently fall back to an old domain.
   - For production, deploy with `PUBLIC_BASE_URL=https://vyapaar.ramky.com`; DEV can continue using its own address without code changes.

3. **Deploy the affected server pieces**
   - Redeploy `send-password-reset`.
   - Apply the refreshed authentication environment on the self-hosted server and restart the authentication service so the old `vendx.ramky.com` value is removed from generated links.
   - No database table change is required.

4. **Verify the complete flow**
   - Request a reset from `https://vyapaar.ramky.com/auth`.
   - Confirm both the email button and copied fallback URL use `vyapaar.ramky.com`, never `vendx.ramky.com`.
   - Confirm clicking either link verifies the recovery token, opens `/reset-password`, accepts a new password, and returns to the login page.

## Technical scope

- `src/components/auth/ForgotPasswordDialog.tsx` already supplies the current origin; preserve that behavior.
- Update `supabase/functions/send-password-reset/index.ts` with validated origin handling and generated-link normalization, following the existing self-hosted normalization pattern used by vendor invitation links.
- Update the self-host deployment auth URL/redirect configuration and its deployment guidance so every environment uses its own `PUBLIC_BASE_URL`.
