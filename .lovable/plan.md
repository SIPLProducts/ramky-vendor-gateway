# Fix SMTP Authentication in Quality and Production

## Confirmed diagnosis

- Both environments successfully reach `smtp.gmail.com` on port `587` using TLS.
- Gmail returns an authentication rejection (`535` / bad credentials) before attempting delivery. The recipient, subject, HTML, CC list, and portal URL are not causing this failure.
- The sender already trims the username and removes spaces from the saved password, so spaces copied from Google's grouped app-password display are handled.
- Quality and Production show the same sender mailbox, `ramky.vyapaar@ramky.com`. If the same invalid or revoked credential was saved in both environments, both will fail identically.
- The response does not distinguish between a wrong/revoked app password and a Google Workspace policy that blocks app-password SMTP. That distinction must be checked against the Gmail rejection details and the mailbox settings.
- A normal Google account password cannot be added as a fallback. Gmail no longer accepts normal passwords for SMTP basic authentication, and attempting both would weaken security without fixing the rejection.

## Resolution plan

1. **Confirm the Gmail account requirement**
   - Confirm 2-Step Verification is enabled for `ramky.vyapaar@ramky.com`.
   - Confirm the Google Workspace administrator allows App Passwords for this account.
   - Generate a new Mail app password for this mailbox. Do not use the normal Google password.
   - Keep one password field for the app password only; do not attempt the normal account password automatically.

2. **Replace the saved credential separately in both environments**
   - In Quality, enter the new app password, save the configuration, then send a test.
   - In Production, enter the same new app password only if both environments intentionally use the same mailbox; otherwise use Production's own mailbox credential.
   - Leaving the password field empty keeps the currently rejected password, so a new value must be entered before saving.

3. **Improve diagnosis in the application**
   - Make the test action read and display the safe Gmail response category and code without exposing the password.
   - Distinguish invalid credentials, app-password policy restrictions, connection timeouts, and recipient rejection.
   - Keep the existing friendly instructions for Gmail authentication failures.

4. **Verify both environments**
   - Send one test from Quality and one from Production.
   - Confirm Gmail accepts the authenticated sender and the recipient receives both messages.
   - Confirm normal password-reset and buyer-notification emails also use the corrected no-reply configuration.

## Expected result

Quality and Production authenticate successfully with Gmail. If a newly generated app password is still rejected, the confirmed blocker is the Google Workspace account policy, which must be enabled by the organization's Google administrator rather than changed in portal code.
