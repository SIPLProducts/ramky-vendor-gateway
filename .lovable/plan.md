# Prevent Forwarded Invitation Links From Being Used

## Problem
Today, anyone who receives the forwarded invitation URL (`/vendor/invite/accept?token=...`) can open it and get auto‑signed‑in. The `accept-vendor-invite` edge function:
- Looks up the invite by token
- Auto‑creates/uses the auth user for the invited email
- Generates a magic link that signs that email in on any browser that hits the URL

So the token alone = full access. Forwarding the mail effectively shares the account.

## Fix — require the recipient to prove they own the invited email

### 1. Frontend: `src/pages/VendorInviteAccept.tsx`
Replace the auto-accept flow with an email-confirmation gate:
- On load, call a new lightweight endpoint (or existing `get_invitation_by_token` RPC via edge function) to fetch only the **masked** invited email (e.g. `j***@company.com`) plus expiry/used status. Do NOT return the full email.
- Show a small form: "This invitation was sent to `j***@company.com`. Enter your email to continue." + Email input + Continue button.
- Only after the user types an email that matches (case-insensitive) the invited email do we call `accept-vendor-invite`.
- If already signed in as the invited email → skip the gate (current behavior).
- Wrong email → show "This invitation link is tied to a different email address. Please open it from the mailbox it was sent to." No retry counter reveal; just a soft error.

### 2. Edge function: `supabase/functions/accept-vendor-invite/index.ts`
- Require a new body field `confirmed_email`.
- Reject with `code: 'email_mismatch'` (HTTP 403) if `confirmed_email.toLowerCase() !== invite.email.toLowerCase()`.
- Keep all existing magic-link generation logic after the check passes.
- Do not bump `access_count` until the email check passes (change RPC call order — validate first, then record access).

### 3. New tiny edge function: `get-invitation-summary` (or reuse pattern)
- Accepts `{ token }`.
- Uses service role to look up invite; returns `{ masked_email, expires_at, used, invalid }` only.
- Never returns the raw email, vendor_id, tenant_id, or any PII.

### 4. Optional hardening (include in this change)
- If invite is already `used_at` set and `vendor_id` claimed by another user, block with `code: 'already_claimed'`.
- Log mismatched attempts to `invitation_email_events` with `event_type: 'mismatch_attempt'` for audit.

## Files touched
- `src/pages/VendorInviteAccept.tsx` — add email confirmation UI + gated call
- `supabase/functions/accept-vendor-invite/index.ts` — require and validate `confirmed_email`; reorder access-count bump
- `supabase/functions/get-invitation-summary/index.ts` — NEW, returns masked email only
- Deploy both edge functions

## What stays the same
- Token format, DB schema, and the magic-link/OTP sign-in mechanism are unchanged.
- Legitimate recipients see one extra step: confirm their email once.

## Result
A forwarded link no longer grants access — the third party doesn't know the invited mailbox, can't pass the email confirmation, and never receives a magic-link session.
