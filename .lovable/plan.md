## Plan: Secure vendor invitation access

### Goal
Allow the invited vendor to click **Begin Registration** and continue normally, while preventing forwarded/copied links from opening the registration for unauthorized people.

### Root cause to fix
The current invitation token acts like a login credential. The edge function creates/signs in the invited account using only the URL token, so whoever clicks the forwarded link first can become the vendor session.

### Secure workflow to implement
1. **Begin Registration link opens invite page**
   - Keep `/vendor/invite?token=...` as the email entry point.
   - Validate the token and invitation status.

2. **Silent email ownership check for first-time access**
   - The invite page will trigger the backend to send a short-lived one-time OTP/magic verification to the originally invited email.
   - The page will show a simple “Check your email to continue” screen.
   - This avoids asking the user to type email again, but proves they control the invited mailbox.

3. **Authorized vendor opens form directly after verification**
   - After the OTP/magic verification succeeds, the app will create/restore the vendor session and navigate to `/vendor/registration?token=...`.
   - Existing form autosave, submit, status tracking, and edit-on-return behavior stays unchanged.

4. **Forwarded/copied link is denied**
   - A forwarded recipient can open the public invite URL, but cannot complete verification because the OTP goes only to the originally invited email.
   - If the invitation is already bound to another user/session, show **Access Denied**.

5. **Submitted vendors can reopen progress**
   - If the original vendor clicks the same invitation later, the same email-ownership check/session restoration will let them view Application Progress.
   - If the application is sent back by Buyer, the existing editable statuses will continue to show the form for editing.

6. **Fix current `provision_failed` issue**
   - Remove the fragile “find user by first 200 auth users” dependency.
   - Provision/recover the invited auth user using a safer backend flow and return detailed error codes when something fails.

### Files/areas to change
- `supabase/functions/claim-vendor-invite/index.ts`
  - Stop signing in users based only on the invite token.
  - Add/adjust backend logic to send verification only to the invited email and bind the invitation to the verified user.
  - Keep reopen behavior for the same verified vendor.

- `src/pages/VendorInviteAccept.tsx`
  - Replace automatic token-login with a verification-pending flow.
  - Handle verified session, denied, expired, invalid, and backend error states cleanly.

- `src/pages/VendorInviteCallback.tsx` if needed
  - Ensure callback returns to `/vendor/registration?token=...` after email verification.

- Database migration if needed
  - Add safe invite binding fields such as claim/verification timestamps if missing.
  - Preserve existing invitation/vendor relationships.

### Important limitation
No system can identify “the original person” from a forwarded link alone without proving mailbox ownership, because the URL itself is shareable. The secure way is to send the login/verification only to the originally invited email and deny anyone who cannot access that mailbox.