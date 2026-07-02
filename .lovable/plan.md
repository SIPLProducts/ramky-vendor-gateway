## Goal
Restore the previous frictionless flow: clicking **Begin Registration** (or the direct link) auto-signs the vendor in and shows a "Signing you in…" spinner while redirecting to the registration form. Only forwarded / unauthorized opens should see the **Access Denied** screen.

## Why it broke
The last change added a **"Confirm your email"** popup that required every recipient to type the invited email before sign-in could proceed. That step is what the user is calling out — previously there was no typing step, sign-in was automatic on link click.

## How we still block forwarded links
We cannot detect forwarding without either (a) asking the recipient to prove ownership or (b) using a server-side signal. To keep auto sign-in AND block forwarding, we rely on two server-side signals already available on `vendor_invitations`:

1. **`used_at`** — first successful sign-in stamps this. A forwarded second attempt is blocked.
2. **`access_count`** — bumped on every access. If already > 0 and the current browser has no valid session for the invited email, treat as forwarded.

The safest of the two is `used_at`: the very first click auto-signs the intended recipient in; any later click on the same link (forwarded or not) is blocked with Access Denied. This matches the "one-time invitation link" pattern the user expects.

## Change plan (frontend + one edge function tweak)

### 1. `src/pages/VendorInviteAccept.tsx` — revert to auto sign-in
- Remove the `confirm` phase and the `Confirm your email` card entirely.
- On mount, phases are: `verifying` → (`signing_in` → navigate) OR `denied` OR `error`.
- Directly call `accept-vendor-invite` with `{ token, redirectOrigin }` (no `confirmed_email`).
- If the response returns `code: 'already_used'` or `code: 'email_mismatch'` → `denied` (Access Denied card, already built).
- On success → `verifyOtp` → `navigate('/vendor/registration?token=…')`; fallback to `window.location.assign(action_link)`.
- Keep the existing Access Denied card design (red Ban icon, support mailto).

### 2. `supabase/functions/accept-vendor-invite/index.ts` — enforce one-time use
- Drop the required `confirmed_email` check (revert to token-only).
- After the existing `expires_at` check, add:
  ```ts
  if (lookup.used_at) {
    // second+ click on the same link — treat as forwarded / reuse
    return 403 { code: 'already_used' }
  }
  ```
- Keep `record_invitation_access` call.
- Keep magic-link generation, action-link normalization, and OTP token_hash extraction unchanged.
- Note: `used_at` is set by the existing `claim_invitation` RPC that runs after the vendor lands on the registration page and signs in, so first-time clicks continue to work; only subsequent clicks (forwarded) are blocked.

### 3. `supabase/functions/get-invitation-summary/index.ts`
- No longer called by the frontend after this change. Leave the function deployed (harmless) — no edit needed.

## UX summary
- **Valid recipient, first click**: sees "Verifying your invitation" → "Signing you in" → registration form. No typing.
- **Forwarded / second click**: sees the **Access Denied** card with support contact.
- **Expired / invalid token**: sees the existing error card.

## Files touched
- `src/pages/VendorInviteAccept.tsx` (rewrite the phase flow)
- `supabase/functions/accept-vendor-invite/index.ts` (remove email gate, add `used_at` block)
