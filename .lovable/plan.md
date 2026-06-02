## Goal
Add a "Create Vendor" path so a buyer can fill and submit the full Vendor Registration Form on behalf of a vendor. Existing vendor-initiated flow, validations, approval chain, and SAP/DMS sync remain untouched.

## UX

### 1. Entry point on `/admin/invitations`
- Add a "Create Vendor" button next to the existing "Invite Vendor" button (buyer / admin roles only).
- Opens a small dialog asking for: Buyer Company (same selector as Invite), Vendor Email (required), Vendor Name (optional), Phone (optional).
- On submit: creates a `vendor_invitations` row marked `created_on_behalf = true` (no email sent), then navigates the buyer to `/vendor/registration?onBehalfOf=<invitationId>`.

### 2. Registration form in "on-behalf" mode
- Reuse the existing `VendorRegistration` page as-is.
- When `onBehalfOf` is present and the user is a buyer/admin, show a header banner: "Filling on behalf of {vendorEmail}".
- All steps, OCR, manual verification, document upload, dynamic tabs, validations, and Review/Submit behave exactly the same.
- Auto-save and resume work via the linked invitation/vendor row.
- On submit, the standard `validation-orchestrator` runs and the existing approval seeding trigger fires. Because the buyer is the submitter, the BUYER stage is auto-approved server-side (recorded with the buyer as actor) so the application moves directly to SCM Manager. Everything from SCM Manager onward — including SAP/DMS sync — is unchanged.

### 3. Invitations list
- On-behalf rows get an "On behalf" badge and a "Resume / Open" action in place of "Copy link" / "Resend email".

## Technical changes

### Database (one migration)
- `vendor_invitations`: add `created_on_behalf boolean not null default false`.
- Update `seed_vendor_approval_progress` so that when the source invitation has `created_on_behalf = true`, the BUYER level row is inserted with status `approved` (actor = `vi.created_by`) and the first pending stage becomes SCM Manager (or whichever stage is next per the existing matrix). No other behaviour changes.

### Frontend
- `src/pages/AdminInvitations.tsx` — add "Create Vendor" button + dialog + mutation; skip email send; update list row badge/actions for on-behalf rows.
- `src/pages/VendorRegistration.tsx` + `src/hooks/useVendorRegistration.tsx` — read `onBehalfOf` query param, load invitation, prefill email/name/phone, set `onBehalfMode` flag, show banner. No changes to step logic, validations, or submit pipeline.
- `src/components/auth/ProtectedRoute.tsx` — allow buyer/admin roles to reach `/vendor/registration` when `onBehalfOf` is present.

### Backend / edge functions
- `notify-vendor-submission` — when on-behalf, send the standard submission notification to buyer/approver recipients only (skip the vendor-facing copy since vendor has no account yet). No other function touched.

### Out of scope
- No changes to OCR, KYC validation, approval matrix, SAP payload builder, DMS payload builder, or existing vendor invite/registration flow.
- No vendor login provisioning in this iteration.

## Files to touch
- `supabase/migrations/<new>.sql`
- `src/pages/AdminInvitations.tsx`
- `src/pages/VendorRegistration.tsx`
- `src/hooks/useVendorRegistration.tsx`
- `src/components/auth/ProtectedRoute.tsx`
- `supabase/functions/notify-vendor-submission/index.ts`
