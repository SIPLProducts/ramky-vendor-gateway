## Goal
Trigger an email notification when a vendor is rejected at the SAP Sync stage as a duplicate — both when the SAP Team clicks **Duplicate Reject** manually and when the system auto-rejects on a "PAN Number Duplicated" SAP response.

## Changes

### 1. `supabase/functions/sap-team-reject-vendor/index.ts`
Extend the existing duplicate-reject function to send an email (mirroring the pattern already used in `sap-team-return-to-buyer`):

- After updating `vendors.status = 'sap_team_rejected'`, look up the inviting buyer from `vendor_invitations` (most recent for the vendor).
- Fetch buyer profile (`email`, `full_name`), rejecter profile, and vendor name (using existing `getName1` GST/PAN-holder rule).
- Build an HTML email titled **"Vendor Rejected — Duplicate in SAP"** with rows for Vendor Name, Reference Number, Rejected By, Rejection Stage (SAP Team), Remarks, and Date/Time (IST). Body explains the vendor already exists in SAP and no further action is required.
- Send via `supabase.functions.invoke('send-smtp-email', ...)` (same channel as the return-to-buyer flow).
- Accept an optional `autoTriggered: boolean` flag in the request body so the subject/body can say "automatically rejected due to PAN duplicate in SAP" when set; otherwise use the manual "marked as duplicate" wording.
- Insert an `audit_logs` row (`buyer_notified_duplicate_rejection_email` or `buyer_duplicate_rejection_email_failed`) capturing buyer email and any error.
- Email failure does **not** abort the rejection (unlike return-to-buyer) — duplicate rejection is final; we just log the failure. Response payload includes `email_sent` + `email_error` for the UI.

No DB schema changes. No new secrets (`send-smtp-email` is already configured).

### 2. `src/pages/SAPSync.tsx`
- In the manual **Duplicate Reject** handler (around line 110), surface `email_sent`/`email_error` from the response in the existing toast (e.g. append "Buyer notified by email" or "Buyer email failed: …").
- In both auto-reject paths for PAN-duplicate failures (lines ~242 and ~325), pass `autoTriggered: true` in the invoke body so the email wording reflects the automatic trigger.

No other UI changes; the existing buttons, tabs, and confirmation dialog stay as-is.

## Out of scope
- No changes to approval workflow, vendor list, or other rejection flows.
- No new email template files — HTML is inlined in the edge function, matching the established pattern.