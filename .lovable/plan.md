## Goal
When a vendor application is rejected at any stage **after the Buyer** (SCM Manager, SCM Head, Finance 1, Finance 2, CEO Office), the application is already routed back to the originating Buyer (`vendors.status = 'returned_to_buyer'`). What is missing is a **rejection email to that Buyer**. Add it, using the No-Reply SMTP sender configured in **Email Configuration → No-Reply Email**.

No changes to the Buyer-stage "Send Back to Vendor" flow (that already emails the vendor).

## Where it changes
Single file: `supabase/functions/process-approval-action/index.ts`, in the `action === 'reject'` branch for the **non-buyer** path (right after `vendors.status = 'returned_to_buyer'` is set and the audit log is written, before returning the response).

## Logic added
1. Look up the originating Buyer from `vendor_invitations.created_by` (already loaded as `invite.created_by`), then fetch their email + full name from `profiles`.
2. Fetch from `vendors`: `legal_name`, `vendor_reference_number` (or `vendor_code` / fallback to vendor id short form — pick the first non-null of `vendor_reference_number`, `vendor_code`, `id`).
3. Fetch the rejecter's name + email from `profiles` using `userId`.
4. Format date/time as `dd MMM yyyy, HH:mm` IST (`Asia/Kolkata`).
5. Invoke `send-smtp-email` edge function (which already reads the No-Reply config from `portal_config.smtp_from_email` / host / password):

   - `to`: buyer email
   - `subject`: `Vendor Application Rejected`
   - `html`: clean table with these rows
     - Vendor Name
     - Vendor Reference Number
     - Rejected By (Name `<email>`)
     - Rejection Stage (human label of `curStage`)
     - Rejection Remarks (the `comments` value)
     - Rejection Date & Time (IST)
     - A short line: "The application has been returned to you for correction. Please log in to the portal to review and resubmit."

6. Wrap the call in `try/catch` and `console.warn` on failure — never block the rejection response on email failure (same pattern already used for the Buyer→Vendor email).
7. Best-effort `audit_logs` insert with `action: 'buyer_notified_rejection_email'` and details `{ buyer_email, stage, vendor_id }`.

## Out of scope (do NOT touch)
- `StageApprovalView.tsx` UI (labels, dialog).
- Buyer-stage rejection (already emails vendor via `send-status-notification`).
- Approval chain / matrix / seeding logic.
- `send-smtp-email` function itself (already reads from `portal_config` No-Reply settings).
- No new tables, no migrations.

## Verification
1. SCM Manager rejects a vendor → Buyer receives email titled "Vendor Application Rejected" with all 5 required fields populated.
2. Finance 1 rejects → same email to the same Buyer.
3. Vendor status flips to `returned_to_buyer` as before; Buyer-stage reject still emails the vendor (unchanged).
4. Edge function logs show `send-smtp-email` invoked with the no-reply From address.
