# Make password-reset links reliable in every environment

The new email correctly uses the DEV address, so dynamic host selection is working. The failure occurs at token verification: the reset email currently copies the token from the generated `action_link`, while the existing vendor sign-in flow documents that this raw URL token can be rejected as expired/invalid by self-hosted authentication. After rejection, the authentication service sends the browser to its configured fallback site, which is why the obsolete `vendx.ramky.com` address appears.

## Changes

1. **Use the supported hashed recovery token**
   - Read `hashed_token` and `verification_type` returned by password-reset link generation.
   - Build the email link directly to the requesting portal: `<current origin>/reset-password?token_hash=...&type=recovery`.
   - Keep a compatibility fallback only for older authentication versions that do not return `hashed_token`.

2. **Verify the token inside the portal**
   - Extend the Reset Password page to detect `token_hash` and call the authentication client’s OTP verification with recovery type.
   - Open the password form only after a valid recovery session is established.
   - Remove token values from the browser address after verification and show a clear expired-link message when verification fails.

3. **Remove dependence on authentication redirects**
   - The reset email will no longer require the authentication service to redirect from `/auth/v1/verify` to the correct DEV, QA, or PROD host.
   - Continue validating the requesting origin so a reset link cannot be redirected to an arbitrary site.
   - Retain deployment checks for each environment’s authentication URLs as defense in depth.

4. **Validate and deploy**
   - Check the updated function and Reset Password page for type/build errors.
   - Redeploy `send-password-reset` to each self-hosted environment through the existing deployment script.
   - Request a fresh email in DEV, QA, and PROD; confirm its link opens that same environment’s `/reset-password`, accepts a new password, and never visits `vendx.ramky.com`.

## Expected result

One code path works dynamically for DEV, QA, and PROD based on the portal where the reset was requested. Previously issued links remain unusable because recovery tokens are single-use and time-limited.