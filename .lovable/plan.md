## What I found

- The latest submitted vendor is **Brickwork Ratings India Private Limited** with reference **130dc9ef-70b8-4c05-8f84-12558af5d169**.
- It was submitted successfully at **15 May 2026 06:14 UTC** and status is **SCM Manager Review**.
- The email did not go to the buyer because the submitted vendor row has **no invitation_id**, so the notification function cannot find the buyer who invited the vendor.
- The invitation token shown in the screenshot exists, but its `created_by` is also empty, so even if linked later, the system still cannot know which buyer should receive the mail.
- The current submit flow calls `notify-vendor-submission` **before** the invitation is claimed/linked in one place, and the hook does not include `invitation_id` when creating/updating the vendor.

## Plan

1. **Persist invitation link on vendor save**
   - When vendor opens registration using an invitation token, look up the invitation and save its `id` into the vendor record as `invitation_id`.
   - This ensures the submitted vendor is permanently connected to the invitation.

2. **Fix notification timing**
   - In the vendor submission flow, claim/link the invitation before sending the buyer notification email.
   - Avoid duplicate/non-blocking claim logic in the page and hook so the order is reliable.

3. **Make the notification function more resilient**
   - If `vendors.invitation_id` is missing, fall back to finding an invitation by `vendor_id`.
   - If the invitation has no `created_by`, return a clear skipped reason and log it.

4. **Fix invitation creation ownership**
   - Check the invitation creation function/page and make sure new invitations store the logged-in buyer as `created_by`.
   - This is required because the notification email is sent to the inviter’s profile email.

5. **Add buyer/admin visibility for submitted vendors**
   - Ensure submitted vendors are visible in the normal review lists so you can verify submission even if email fails.
   - Add or surface audit logs/status messages showing: vendor submitted, notification attempted, notification sent/skipped/failed.

6. **Validate with backend data/logs**
   - Confirm a submitted vendor has `invitation_id`.
   - Confirm the invitation has `created_by` and maps to the buyer profile email.
   - Confirm `notify-vendor-submission` invokes `send-smtp-email` and records an audit log.

## Immediate note for this current vendor

For the current submitted vendor, the database confirms the vendor submitted successfully, but the invitation/buyer link is missing. After the fix, new submissions will notify correctly. Existing broken records may need a one-time data correction if you want this specific vendor linked back to the buyer invitation.