# Restore "Confirm your email" gate on vendor invite link

## Problem

Currently, anyone who opens the invite URL (including forwarders) instantly sees "Check your inbox" AND the real vendor receives a sign-in email they didn't request. We want forwarders blocked with **Access Denied** before any email is sent.

## Desired flow

1. Vendor (or anyone) opens `/vendor/invite?token=...`.
2. Page shows a **"Confirm your email to continue"** card with an email input, Continue button, and a masked hint (e.g. `s****r@sharviinfotech.com`).
3. On Continue:
   - **Match** → call `send-invite-signin-link`, show "Check your inbox". After they click the mailed magic link, `/vendor/invite/callback` verifies and takes them into registration.
   - **Mismatch** → full-screen red **Access Denied** card, no email is sent to the real vendor, and the attempt is logged for audit.
4. Invalid / expired / already-used token → existing error / denied states (unchanged).

## Changes

### Frontend — `src/pages/VendorInviteAccept.tsx`
- Remove the auto-call to `send-invite-signin-link` on mount.
- New initial phase `confirm_email`:
  - On mount, call existing `get-invitation-summary` to get `masked_email`, `expired`, `used`. If token bad/expired/used → go straight to `error` / `denied`.
  - Render email input, Continue button, masked hint, support link.
- On Continue → call new `verify-invite-email` function:
  - `ok: true` → call `send-invite-signin-link` and transition to existing `sent` ("Check your inbox") phase.
  - `code: 'email_mismatch'` → transition to existing `denied` phase (Access Denied).
  - Other codes → `error` phase.
- Rate-limit clicks locally (disable Continue for a couple of seconds between tries).

### Backend — new edge function `verify-invite-email` (`supabase/functions/verify-invite-email/index.ts`)
- Public function (no JWT), CORS + input validation.
- Input: `{ token, email }`.
- Uses service role to look up `vendor_invitations` by token.
- Returns:
  - `{ ok: true }` when `lower(email.trim()) === lower(invite.email)` and token is valid/not expired/not used.
  - `{ ok: false, code: 'email_mismatch' | 'expired' | 'used' | 'invalid' }` otherwise.
- Never returns the invited email itself — only a boolean + code.
- Logs every attempt into existing `invitation_email_events` with `event_type = 'email_confirm_attempt'` and `event_data = { matched: boolean, attempted_domain }` (domain only, not the full guessed email) for audit / brute-force review.
- Simple rate check: reject if more than 10 attempts for the same `invitation_id` in the last 15 minutes (`code: 'rate_limited'`).

### Backend — `send-invite-signin-link` (harden existing)
- Also accept `confirmed_email` in the body and re-verify it against the invitation before generating/sending the magic link. This ensures the frontend gate can't be bypassed by calling the function directly (forwarder can't script around it).
- Return `{ code: 'email_mismatch' }` if it doesn't match.

### Backend — `verify-invite-session` (unchanged)
- Already enforces that the authenticated email must equal the invited email at callback time. Kept as the last line of defense.

## Out of scope
- No database schema changes. `vendor_invitations` and `invitation_email_events` already have everything needed.
- No changes to the invitation email template or to buyer/admin invite creation.
- `/vendor/invite/callback` route stays as is.

## Result

- Forwarder / copier who doesn't know the exact invited email → **Access Denied** immediately, no email sent to the real vendor, attempt logged.
- Real vendor → types their address → magic link → auto sign-in → registration. Same one-click experience as before.
