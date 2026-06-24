# Fix: Buyer not receiving email on SAP Team "Reject & Send to Buyer"

## Root cause

`sap-team-return-to-buyer` invokes `send-status-notification`, which is a **simulation-only** function (logs to `audit_logs`, never sends mail). It also has no template for `returned_to_buyer`.

Approval-stage rejections (SCM Manager / Head / Finance) in `process-approval-action` work because they invoke `send-smtp-email` with a rich HTML, treat failure as fatal, and require the caller to retry with `forceReject` to override.

The SAP-team return path must follow the same configuration.

## Changes

### 1. `supabase/functions/sap-team-return-to-buyer/index.ts`
Replace the `send-status-notification` invocation with the same `send-smtp-email` flow used by `process-approval-action` reject:

- Load buyer profile (email, full_name) via `vendor_invitations.created_by` → `profiles`.
- Load rejecter profile and vendor row (legal_name/trade_name, vendor_reference_number, vendor_code) for the email body.
- Build the same HTML template (header "Vendor Application Rejected", stage = "SAP Team", remarks, IST timestamp). NAME1 logic: prefer trade_name when GST exists, else PAN account holder name, else legal_name.
- Call `admin.functions.invoke('send-smtp-email', { body: { to, subject, html } })`.
- Accept a new `forceReject: boolean` body field. If email fails AND `!forceReject`: return `{ ok: false, email_sent: false, requires_confirmation: true, error }` and do **not** update vendor status / clear approval progress.
- If email succeeds OR `forceReject`: perform the existing status update, delete pending `vendor_approval_progress`, and write two `audit_logs` rows (`sap_team_return_to_buyer` and `buyer_notified_rejection_email` / `buyer_rejection_email_failed`).
- Response shape: `{ ok: true, email_sent, email_error }`.

### 2. `src/pages/SAPSync.tsx` — `handleConfirmReturnToBuyer`
Mirror the existing approval-reject UX:

- First call without `forceReject`. If response is `{ ok: false, requires_confirmation: true }`, show a confirm dialog ("Email to buyer failed: <error>. Proceed with rejection anyway?"). On confirm, re-invoke with `forceReject: true`.
- On success, toast includes "Buyer notified" when `email_sent`, otherwise "Vendor returned (email failed)".

## Out of scope

- No changes to `send-status-notification` (still used by other flows in simulation).
- No schema changes.
- No UI changes beyond the SAP Sync return-to-buyer dialog handler.

## Verification

- Trigger "Reject & Send to Buyer" with a valid buyer profile email and an SMTP config present → buyer inbox receives the same rejection email format as SCM/Finance rejects.
- Disable SMTP config → first call returns the confirm prompt; clicking Force completes the rejection and logs `buyer_rejection_email_failed`.
