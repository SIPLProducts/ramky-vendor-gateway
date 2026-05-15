Root cause found: the latest submitted vendor is linked to an invitation, but that invitation has `created_by = null`. Because there is no stored buyer on the invitation, `notify-vendor-submission` cannot resolve a buyer email and returns `skipped: "no_recipient"`, which is why the dialog says “No invited buyer is linked…” and no mail is sent.

Plan to fix:

1. Make invitation creation self-healing
   - In `src/pages/AdminInvitations.tsx`, ensure newly created invitations always save `created_by` from the logged-in user.
   - Keep the existing validation, but make the error clearer if the logged-in user/session is missing.

2. Fix the backend invitation sender as a fallback
   - In `supabase/functions/send-vendor-invitation/index.ts`, read the authenticated user from the request token.
   - If the invitation row has no `created_by`, update it with the authenticated sender before/after sending the invitation email.
   - This prevents future invitations from being created without the buyer link even if the frontend misses it.

3. Make submission notification resilient for old/bad invitation rows
   - In `supabase/functions/notify-vendor-submission/index.ts`, when `created_by` is missing, resolve the buyer using the SMTP config sender if possible:
     - Use the inviting/sender email if available from invitation sending metadata or matching active SMTP config.
     - If still missing, fall back to tenant users with buyer/approver/admin roles instead of only `customer_admin`.
   - Return the resolved buyer in `inviter` so the success dialog shows the green buyer-notification state.

4. Repair current affected data
   - Backfill `created_by` for the recent affected invitation(s) where the invitation email or sender can be matched to a portal user.
   - For the current screenshot case, the invitation is linked but has no buyer; after backfill, resubmission/notification can resolve correctly.

5. Deploy and verify
   - Deploy `send-vendor-invitation` and `notify-vendor-submission`.
   - Test the latest vendor notification path: buyer is `To`, configured CC recipients are `Cc`, invalid CC values do not block delivery, and the success dialog shows the buyer instead of the warning message.