Root cause identified: the email link itself is generated as `http://10.200.1.7/vendor/invite?...`, which matches the React route, but the app then calls `accept-vendor-invite` and redirects to a generated magic sign-in link. On self-hosted deployments this can fail if the auth verification link is normalized incorrectly or if the direct link text is not an actual clickable anchor in Gmail.

Plan:

1. Make the email direct link clickable
   - In `send-vendor-invitation`, change the “Direct Link” block from plain text to a real `<a href="...">` link.
   - Keep the `Begin Registration` button unchanged, but make both button and direct link point to the same invite URL.

2. Harden self-hosted invite redirect
   - In `accept-vendor-invite`, make magic-link normalization support both self-hosted URL forms:
     - `/auth/v1/verify?...`
     - `/supabase/auth/v1/verify?...`
   - Ensure the final redirect goes back to `/vendor/registration?token=...` after verification.

3. Add a safer fallback in the invite page
   - In `VendorInviteAccept`, if magic-link generation/redirect fails, show a clear error instead of silently staying/loading.
   - Preserve existing behavior for valid invitations.

4. Deployment/validation steps after code change
   - Rebuild and deploy the frontend/functions on the self-hosted server.
   - Open the email link in a new tab.
   - Confirm `/vendor/invite?token=...` opens first, then redirects to registration.
   - If it still does not open, check nginx routes for `/supabase/auth/v1/verify` and SPA fallback for `/vendor/invite`.