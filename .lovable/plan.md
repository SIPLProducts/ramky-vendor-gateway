# Plan: Vendor identity from invitation + conditional success/failure dialog

## Goal
1. The buyer-sent invitation already captures `vendor_name`, `email`, `phone_number` in `vendor_invitations`. Use these as the authoritative vendor identity in the post-submission email and the "Application Submitted" popup.
2. The popup must show a success message only when notification actually succeeds; otherwise show a failure message.

## Changes

### 1. `supabase/functions/notify-vendor-submission/index.ts`
- Extend the `vendor_invitations` lookup (all fallback paths) to also select `email, phone_number, vendor_name`.
- Build a single `vendorIdentity` object used everywhere:
  - `vendorName`  = invitation.vendor_name || vendors.legal_name || vendors.trade_name
  - `vendorEmail` = invitation.email || vendors.primary_email
  - `vendorPhone` = invitation.phone_number || vendors.primary_phone
  - `contactPerson` = vendors.primary_contact_name (optional, shown only if present)
- In `buildHtml`, replace the current "Primary Contact / Vendor Email" rows with:
  - Vendor Name
  - Vendor Email (from invitation)
  - Vendor Phone (from invitation)
  - Contact Person (only if available)
- Return `vendorIdentity` in the JSON response.
- Email "from" name / subject lines remain as-is (rebrand handled in a separate plan).

### 2. `src/pages/VendorRegistration.tsx` + `src/components/vendor/SubmissionSuccessDialog.tsx`
- Capture `notifyResult` from the `notify-vendor-submission` invoke (success flag + vendorIdentity + error message).
- Pass to `SubmissionSuccessDialog` new props:
  - `status: 'success' | 'failure'`
  - `vendorIdentity?: { vendorName, vendorEmail, vendorPhone, contactPerson? }`
  - `errorMessage?: string`
  - `referenceNumber: string` (already passed)
- Dialog rendering:
  - **Success** (notify ok): title "Application Submitted Successfully", body:
    > Your application has been received successfully. An email has been sent to the respective buyer and configured email IDs.
    >
    > Thank you.
    Followed by a "Vendor details" block (Name / Email / Phone / Reference #).
  - **Failure** (notify threw or returned ok=false): title "Application Submitted — Notification Failed", body:
    > Your application was saved (Ref #XYZ), but we could not send the confirmation email to the buyer. Our team has been notified. Please contact support@sharviinfotech.com if you do not receive a follow-up.
    Show the underlying `errorMessage` in a muted line. Keep reference number visible.
- The vendor's actual DB row is saved regardless of notification result — submission is never rolled back on email failure (current behaviour).

### 3. Resubmission flow
Same dialog component is used → automatically inherits success/failure handling.

### 4. No DB schema changes
`vendor_invitations.email`, `phone_number`, `vendor_name` already exist and are populated at invitation time.

## Files touched
- `supabase/functions/notify-vendor-submission/index.ts`
- `src/pages/VendorRegistration.tsx`
- `src/components/vendor/SubmissionSuccessDialog.tsx`

## Out of scope (separate plans)
- "Sharvi" → "Ramky" rebrand across email + UI.
- Approval-routing trigger fix for orphaned vendors.

## Verification
1. Submit a vendor against an existing invitation → popup shows success message + invitation email/phone/name; email contains same identity.
2. Temporarily break Resend (invalid API key) → popup shows failure message with reference number still visible; vendor row still saved.
3. Resubmit → identical behaviour.
