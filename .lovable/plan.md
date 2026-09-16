# Correct password-reset redirects in DEV and QA

The email’s first URL is correctly using the environment that requested the reset. The failure occurs after the authentication service processes the token: both DEV and QA still redirect errors to the obsolete `https://vendx.ramky.com` site address.

The `otp_expired` result means the specific token can no longer be used. Recovery links are short-lived and single-use; after correcting the server configuration, verification must use a newly requested email.

## Changes

1. **Apply the correct address to each environment**
   - On DEV, set `PUBLIC_BASE_URL` to the DEV portal address (currently `http://10.200.1.7`).
   - On QA, set `PUBLIC_BASE_URL` to the actual QA portal address.
   - Write that address into the authentication site URL, public API URL, and reset-password allow-list.
   - Recreate the authentication service so it loads the changed values; changing the environment file without recreating the service is insufficient.

2. **Redeploy the reset-email function in both environments**
   - Deploy the current `send-password-reset` function, which validates the requesting portal and generates `/supabase/auth/v1/verify` links for that same host.
   - Keep DEV, QA, and production independent so no environment can inherit `vendx.ramky.com` from another server.

3. **Add deployment verification**
   - Make the deployment check the active authentication container values after restart.
   - Fail clearly if the active site URL, public API URL, or redirect allow-list does not match the supplied environment address.
   - Document separate DEV and QA commands using each environment’s own `PUBLIC_BASE_URL`.

4. **Test with brand-new emails**
   - Discard all previously generated reset emails.
   - Request one new reset email from DEV and one from QA.
   - Confirm the email link, successful destination, and error destination all remain on the originating environment.
   - Confirm each fresh link opens `/reset-password`, changes the password once, and cannot be reused afterward.

## Expected flow

```text
DEV login
  -> DEV /supabase/auth/v1/verify
  -> DEV /reset-password

QA login
  -> QA /supabase/auth/v1/verify
  -> QA /reset-password
```

No part of either flow should redirect to `vendx.ramky.com`.
