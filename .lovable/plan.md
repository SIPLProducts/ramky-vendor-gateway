## Goal
Fix the buyer-rejection email so it actually sends, and add clear UI feedback (toast + a "force reject" confirmation popup if email fails).

## 1. Edge function fix — `supabase/functions/process-approval-action/index.ts`

Root cause: the rejection email block references `(invite as any)?.created_by`, but `invite` is declared only inside the authorisation `if (isBuyerRow) { ... } else { ... }` blocks. After those blocks close, `invite` is out of scope → `ReferenceError` → no email sent (vendor still flips to `returned_to_buyer`, which is why it appears in the Buyer Rejected tab).

Changes:
- Hoist a single `let invitingBuyerId: string | null = null;` before the authorisation branches.
- Inside both branches, assign `invitingBuyerId = invite?.created_by ?? null;` from the existing query (no extra DB call).
- In the post-rejection email block, use `invitingBuyerId` instead of `(invite as any)?.created_by`.
- Add a new request flag `force?: boolean` (default `false`). For non-buyer rejections:
  - Attempt `send-smtp-email` first (before flipping vendor status).
  - If it succeeds → proceed with status update, audit log `buyer_notified_rejection_email`, return `{ ok: true, email_sent: true }`.
  - If it fails AND `force !== true` → DO NOT update vendor status, DO NOT cancel pending rows. Return `{ ok: false, email_sent: false, requires_confirmation: true, error: '<smtp message>' }` with HTTP 200.
  - If it fails AND `force === true` → proceed with rejection anyway, audit log `buyer_rejection_email_failed`, return `{ ok: true, email_sent: false }`.
- Buyer-stage "Send Back to Vendor" flow is unchanged.

## 2. UI — `src/components/approvals/StageApprovalView.tsx`

In `submit()` for non-Buyer rejection:
- Call `process-approval-action` and read the JSON response (use `data` from `functions.invoke`).
- If `data.requires_confirmation === true`:
  - Open a new `AlertDialog` (or `Dialog`) titled "Rejection email could not be sent" with body "Rejection email could not be sent. Do you still want to continue with the rejection?" and buttons **Yes** / **No**.
  - **No** → close popup, keep action dialog open, vendor stays in current stage. Toast: `Unable to send the rejection email due to a mail service issue.` (destructive).
  - **Yes** → re-invoke `process-approval-action` with `force: true`. On success show toast `Rejected (email could not be delivered).`
- If `data.ok === true && data.email_sent === true` → toast `Rejection email sent successfully to the Buyer.` (success).
- Approve flow and Buyer "Send back to vendor" flow keep their existing toasts.

New local state: `pendingForceReject: { progressId, comments } | null` to drive the confirmation popup.

## Out of scope
- Email template content (already correct per previous turn).
- Buyer-stage rejection-to-vendor flow.
- Approval matrix, seeding, SMTP config screens.
- No DB schema changes, no new tables, no migrations.

## Verification
1. SCM Manager rejects with SMTP working → success toast "Rejection email sent successfully to the Buyer.", vendor moves to Buyer Rejected tab, edge logs show `send-smtp-email` invoked, audit log `buyer_notified_rejection_email`.
2. Temporarily break SMTP (wrong password) and reject → destructive toast + confirmation popup appears. Click **No** → vendor stays in SCM Manager queue (status unchanged). Click **Yes** → vendor moves to Buyer Rejected tab, audit log `buyer_rejection_email_failed`.
3. Buyer "Send Back to Vendor" still works exactly as before.
