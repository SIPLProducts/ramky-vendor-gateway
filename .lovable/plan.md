## Goal

After a vendor submits the registration form, send a notification email:

- **From:** address configured in "No Reply Email Configuration"
- **To:** the buyer who originally sent the invitation
- **Reply-To:** the value configured in "Reply-To (Optional)" in No Reply Email Configuration (now supports multiple comma-separated emails)

## Root cause of the current failure

For the just-submitted vendor (Brickwork Ratings, invitation token …320340), the linked invitation row in `vendor_invitations` has `created_by = NULL`. The `notify-vendor-submission` edge function uses `created_by` to find the inviter — when it is null it returns `skipped: no_inviter`, which is exactly what produces the "No invited buyer is linked to this application" message in your screenshot. Almost every recent invitation row has `created_by = NULL` because:

- `vendor_invitations.created_by` has no database default.
- The frontend insert in `AdminInvitations.tsx` falls back to `null` if `useAuth().user.id` is not yet hydrated when the mutation runs.

## Plan

### 1. Database — guarantee `created_by` is captured on every invitation

Migration:
- Set `vendor_invitations.created_by` default to `auth.uid()`.
- Add a `BEFORE INSERT` trigger on `vendor_invitations`: if `NEW.created_by IS NULL` and `auth.uid() IS NOT NULL`, set it to `auth.uid()`. This covers RPC and edge-function paths too.
- Backfill the single blocking row (the Brickwork Ratings invitation `7996db72…`) so the buyer email can finally be sent. Confirm with you which buyer to attribute it to before running this update.

### 2. Frontend hardening — `src/pages/AdminInvitations.tsx`

- Block the create-invitation mutation if `user?.id` is falsy and show a clear toast ("Please reload — your session is still loading"). Prevents future ghost invitations.

### 3. No-Reply Email Configuration — multiple Reply-To addresses

`src/components/admin/NoReplyEmailConfig.tsx`:
- Replace the single Reply-To input with a tag-style multi-email input (chips with remove). Persist as a comma-separated string in `portal_config.smtp_reply_to` so no schema change is needed.
- Show inline validation per email; reject duplicates.
- Update the helper text to explain that all listed addresses receive replies.

### 4. Outgoing buyer notification email

`supabase/functions/notify-vendor-submission/index.ts`:
- Currently calls `send-smtp-email` with `suppressReplyTo: true`, which is why the configured Reply-To never reaches the buyer. Change to `suppressReplyTo: false` (default) so `send-smtp-email` uses `portal_config.smtp_reply_to` as the Reply-To header on the buyer notification.
- No change to the email body (still contains Vendor Name, Vendor Email, Vendor Phone, Vendor Reference, Vendor Unique ID, Submitted At, "Application Submitted Successfully" heading, etc., as required).

`supabase/functions/send-smtp-email/index.ts`:
- Verify it already reads `smtp_reply_to` from `portal_config` and passes it as the `Reply-To` header. If it currently sends only one address, split the comma-separated value and pass all of them as Reply-To (RFC 5322 allows multiple).

### 5. Re-trigger the missed notification

Once step 1's backfill is applied, invoke `notify-vendor-submission` once for vendor `c4db7c2f…` so the buyer who originally invited Brickwork Ratings finally receives the submission email.

## Out of scope

- Email body/template changes.
- Approval workflow, success dialog wording, vendor-side flow.
- Other invitations with NULL `created_by` (left as-is unless you ask to bulk-backfill).

## Open question

Which buyer should receive the notification for the Brickwork Ratings submission (invitation token ending `…320340`, recipient email `babluammisetty924@gmail.com`)? Tell me the buyer's email or profile and I will:
1. Backfill `created_by` on that one invitation row.
2. Apply the migration + frontend + edge-function changes above.
3. Re-invoke `notify-vendor-submission` so the email is sent now.