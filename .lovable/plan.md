# Vendor Confirmation Emails & Post-Submit Screen Cleanup

## 1. Hide the Application Progress diagram for vendors
**File:** `src/components/vendor/SuccessScreen.tsx`

Remove (or conditionally hide) the block that renders:
```
<h2>Application Progress</h2>
<RegistrationStatusTracker ... />
```
(lines ~196–200). The vendor will still see the status header (title, message, reference number) and the "What Happens Next?" section, but the multi-stage progress diagram will no longer be shown after submission.

The `RegistrationStatusTracker` component itself stays available for internal/admin screens (`VendorStatus.tsx`) — only the vendor-facing SuccessScreen loses it.

## 2. Send submission confirmation email to the vendor
**File:** `supabase/functions/notify-vendor-submission/index.ts`

Currently this function emails the buyer/inviter after the vendor submits. Add a second email addressed to the vendor's registered email (`invite.email` / `vendor.primary_email`) with:
- Subject: `Application Submitted Successfully – Ref <reference_number>`
- Body: friendly confirmation that the application has been received, the **Reference Number**, submitted-at timestamp, and a note that the buyer/approvers have been notified and further updates will follow by email.

Implementation notes:
- Reuse the same `send-smtp-email` invoke pattern already in the file.
- Skip sending if `vendorEmail` is empty; wrap in try/catch so a vendor-email failure doesn't break the buyer notification flow.
- Add an `audit_logs` row with `action: "vendor_submission_confirmation_sent"`.

## 3. Also send the "Vendor Created in SAP" email to the vendor
**File:** `supabase/functions/sync-vendor-to-sap/index.ts` (around lines 820–890)

Today the SAP-success email goes only to the buyer. Extend that block so the same HTML email is also delivered to the vendor's registered email:
- Resolve `vendorEmail` from `vendor.primary_email` (fallback to the linked `vendor_invitations.email`).
- Add it to the `to` list (or send a second `send-smtp-email` call) alongside the buyer.
- Keep the existing subject/body (already includes Reference No. and SAP Vendor Code).
- Extend the `sap_sync_buyer_notified` audit entry to record `vendor_email` as well (or add a companion `sap_sync_vendor_notified` entry).

## Technical Details
- No schema changes required — `vendors.primary_email`, `vendors.reference_number`, and `vendor_invitations.email` already exist and are read by these functions.
- No frontend logic changes for submission — the existing `notify-vendor-submission` invoke in `useVendorRegistration.tsx` continues to fire; the vendor email is added inside the edge function.
- SMTP transport is unchanged (uses `send-smtp-email` with configured portal SMTP).
