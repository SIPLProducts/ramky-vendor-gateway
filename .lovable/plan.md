## Goal

Restore the simple invite flow: clicking the invitation link (or "Begin Registration") opens the Vendor Registration Form immediately — no second confirmation email, no magic-link verification step. Security hardening against forwarded links is deferred to a follow-up.

## Changes

### 1. `supabase/functions/claim-vendor-invite/index.ts`
Simplify to a lookup + bind function only. Remove:
- `sendVerificationEmail`, `sendInviteAccessVerification`, `provisionUser`, `generateVerificationLink`
- SMTP lookup, nodemailer import, magic-link generation
- `verification_sent` / rate-limit branches (`signin_sent_count`, `last_signin_sent_at` updates)

Keep:
- Token lookup, expiry check
- Prefetch/bot deferral
- If caller is authenticated and email matches → bind `user_id` if unbound, return `{ status: 'verified', redirect: '/vendor/registration?token=...' }`
- If caller is authenticated but email mismatches invited email → `403 email_mismatch`
- If caller is NOT authenticated → return `{ status: 'needs_signin', redirect: '/vendor/invite/accept?token=...' }` (or similar) so the accept page can route them to sign-in / auto-sign-in via existing invite mechanism

### 2. `src/pages/VendorInviteAccept.tsx`
- Remove the "Verification email sent" UI branch and masked-email display
- On invite link click: if user already signed in with matching email → navigate straight to `/vendor/registration?token=...`
- If not signed in → send them to the invite sign-in path (existing sign-in-with-invite flow / auto-provision) that lands them directly on the registration form without a second email

### 3. `src/pages/VendorInviteCallback.tsx`
- Keep it minimal: hydrate session from the magic-link (used only for first-time provisioning via `send-vendor-invitation`), then redirect straight to `/vendor/registration?token=...`
- Remove any secondary claim-verification gating

### 4. `src/pages/VendorRegistration.tsx`
- Remove any block that requires the "verified claim" round-trip before showing the form
- Keep: session email must match invitation email (soft check), allow edits for `returned_to_buyer` / `purchase_rejected`

### 5. Leave in place (no change)
- `send-vendor-invitation` edge function — this is the single email the buyer triggers; its magic link continues to sign the vendor in and land them on the registration form
- `accept-vendor-invite` and `send-invite-signin-link` remain deprecated / unused

## Result

Buyer sends invite → vendor clicks link in email → magic link signs them in → lands on Vendor Registration Form. No extra "confirm mailbox" email, no verification card.

## Follow-up (not in this plan)
Forwarded-link protection (device binding, one-time claim token, or step-up verification) — to be designed once the base flow is confirmed working.
