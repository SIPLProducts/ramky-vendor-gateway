I found why this is still happening:

- The configured emails do exist in Email Configuration (`vidyasagar.atla@ramky.com` and `suresh.mareddy@ramky.com`).
- Vendor invitation creation currently checks `smtp_email_configs` directly from the browser before saving.
- That table is protected so only admin/customer-admin roles can read it directly. If the logged-in sender is an approver/vendor or any non-admin tenant member, the browser query returns no row even when their email is configured, causing the false `Email Not Configured` message.

## Plan

1. Add a safe backend check for the current user’s email configuration
   - Create a `SECURITY DEFINER` database function named `check_my_smtp_configured()`.
   - It will return only `true/false`, not SMTP credentials.
   - It will compare the logged-in user’s auth email against active email configuration rows case-insensitively.
   - It will require `app_password` to be present.
   - Grant execute permission only to authenticated users.

2. Update vendor invitation creation
   - In `src/pages/AdminInvitations.tsx`, replace the direct browser read from `smtp_email_configs` with `supabase.rpc('check_my_smtp_configured')`.
   - If the function returns `false`, show the existing `Email Not Configured` message and stop before inserting the vendor invitation.
   - If the function returns `true`, continue creating the invitation and sending the email.

3. Keep the email sending function protected
   - Leave `send-vendor-invitation` using its backend service-role SMTP lookup as the final enforcement layer.
   - This ensures users cannot spoof another sender from the browser.

## Expected result

- `vidyasagar.atla@ramky.com` and `suresh.mareddy@ramky.com` will be treated as configured when they are logged in and create vendor invitations.
- Users without their own active email configuration will still be blocked.
- Vendor details will not be saved if the user is not configured.
- SMTP passwords remain hidden and are never exposed to the frontend.