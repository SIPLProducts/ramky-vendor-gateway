## Goal

When a vendor finishes and submits their registration, send a confirmation email to the person who originally invited them (e.g., Suresh Marreddy), letting them know the vendor has submitted the application.

## Current State

- `submitVendorMutation` in `src/hooks/useVendorRegistration.tsx` already calls an edge function `notify-vendor-submission` after submit — but **no such edge function exists** in `supabase/functions/`. So the call silently fails (caught/logged).
- `vendor_invitations` table tracks `created_by` (auth user id of the inviter) and is linked to the vendor via `vendors.invitation_id`.
- An SMTP sender pipeline already exists via `send-smtp-email` (used by `send-vendor-invitation`).

## Plan

### 1. Create new edge function `supabase/functions/notify-vendor-submission/index.ts`

Responsibilities:
- Accept `{ vendorId }`.
- Use service-role Supabase client to:
  1. Load the vendor row (legal_name, primary_contact_name, primary_email, submitted_at, invitation_id).
  2. Resolve the inviter:
     - If `vendor.invitation_id` exists, look up `vendor_invitations.created_by`.
     - Then fetch `profiles` row for `created_by` to get `full_name` + `email`.
     - Fallback: if no inviter found, log and exit (200, skipped).
  3. Compose a clean HTML email (same enterprise styling as the invitation email — sans-serif stack, blue accent header, white card, footer "Sharvi Vendor Portal", support contact `support@sharviinfotech.com`).
     - Subject: `Vendor "<Legal Name>" has submitted their application`
     - Body: greets inviter by first name, confirms submission, shows vendor name + primary contact + submitted timestamp, and notes that the application is now in Purchase/SCM review.
  4. Send via the existing `send-smtp-email` edge function (invoke with service-role client) so the message goes out from the configured SMTP sender.
  5. Insert an `audit_logs` row `action: 'vendor_submission_notified'` with recipient + vendor id (best-effort).
- Standard CORS headers, OPTIONS handling, JSON response `{ success, sentTo }` or `{ success: false, error }`.
- `verify_jwt = false` (called server-to-server from the client mutation right after submit; it loads its own data via service role so it doesn't need the user JWT).

### 2. No changes needed in `useVendorRegistration.tsx`

It already invokes `notify-vendor-submission` after a successful submit and swallows errors so the user flow isn't blocked.

### 3. (Optional, but included) Re-submit path

Also fire the same notify call inside `resubmitVendorMutation` so the inviter is informed when an edited application is re-submitted. Subject prefix becomes "Vendor "<Legal Name>" has resubmitted their application". Pass `{ vendorId, resubmission: true }` and branch the subject/body in the edge function.

## Files

- **New:** `supabase/functions/notify-vendor-submission/index.ts`
- **Edit:** `src/hooks/useVendorRegistration.tsx` — add the same notify call inside `resubmitVendorMutation` (best-effort, non-blocking).

## Out of scope

- Adding a UI toggle to enable/disable this notification.
- Notifying anyone other than the original inviter (e.g. multi-recipient CC). Can be added later if needed.
