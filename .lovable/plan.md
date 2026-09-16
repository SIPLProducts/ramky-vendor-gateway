# Correct the Production password-reset deployment

The link is dynamic in the current code. Quality proves the corrected version is deployed there: it generates `http://10.200.1.7/reset-password?token_hash=...&type=recovery`.

Production proves it is still running the older reset-email function: the current function cannot emit an `/auth/v1/verify` link or reuse `vendx.ramky.com`; it always rebuilds the link on the requesting portal. This is therefore a production deployment mismatch, not a new hardcoded URL in the current source.

## Plan

1. **Deploy the current reset function to Production**
   - Sync the latest repository to the Production source directory.
   - Run the existing Production deployment command with `PUBLIC_BASE_URL=https://vyapaar.ramky.com` and the Production application directory.
   - Do not skip the function deployment.

2. **Enforce the correct Production configuration**
   - Let the deployment update the authentication site URL, public API URL, and allowed reset URL to the Production address.
   - Recreate the authentication and functions services so they load the new values and function source.

3. **Use the built-in deployment checks**
   - Confirm the running authentication service reports `https://vyapaar.ramky.com`.
   - Confirm the deployed reset function contains the direct-portal guard; abort deployment if the older function is still present.

4. **Verify with a fresh email**
   - Discard previously generated reset emails because their tokens are short-lived and single-use.
   - Request a new reset from the Production login page.
   - Confirm both the button and fallback text use `https://vyapaar.ramky.com/reset-password?token_hash=...&type=recovery` and contain neither `vendx.ramky.com` nor `/auth/v1/verify`.
   - Open the new link and confirm the password form appears and accepts the new password.

## Production command

```bash
cd /opt/Ramky_Applications/PROD/VMS/source
sudo PUBLIC_BASE_URL=https://vyapaar.ramky.com \
  APP_ROOT=/opt/Ramky_Applications/PROD/VMS \
  bash scripts/selfhost/deploy-latest.sh --skip-migrations --skip-frontend
```

## Expected result

Production and Quality will use the same environment-aware flow. Each reset email stays on the portal where it was requested, with no dependency on the old `vendx.ramky.com` authentication redirect.
