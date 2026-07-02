## Goal
When someone opens a forwarded invitation link and enters an email that does not match the invited mailbox, show a clear full-screen "Access Denied" state instead of a small inline red message under the input.

## Current behavior
`src/pages/VendorInviteAccept.tsx` handles an `email_mismatch` response by staying on the confirm form and showing an inline red helper text ("This invitation link is tied to a different email address…"). The user finds this too subtle — a forwarded recipient should be visibly blocked.

## Proposed change (frontend only, one file)

Edit `src/pages/VendorInviteAccept.tsx`:

1. Add a new phase `'denied'` to the `Phase` union.
2. When `accept-vendor-invite` returns `code: 'email_mismatch'`, instead of setting `mismatch=true` and returning to `confirm`, set `phase='denied'`.
3. Render a new full-card state for `denied`:
   - Red circular icon (ShieldAlert / Ban) in a `bg-destructive/10` circle
   - Title: **Access Denied**
   - Description: "This invitation link is tied to a different email address. Only the originally invited recipient can open it. If you believe this is a mistake, please contact the administrator."
   - Support line: mailto link to `support@sharviinfotech.com`
   - No retry button (prevents brute-forcing emails). Optional small secondary "Try a different email" ghost link that resets to `confirm` — omit by default for stronger UX signal.
4. Keep all other phases (`loading`, `confirm`, `validating`, `signing_in`, `error`) unchanged.
5. Remove the now-unused inline `mismatch` red text branch (or keep the state variable but it will no longer trigger since we jump straight to `denied`).

## Out of scope
- No backend / edge function changes. `accept-vendor-invite` already returns `403 { code: 'email_mismatch' }` and logs the `mismatch_attempt` event — that stays as-is.
- No changes to token flow, magic-link generation, or DB schema.

## Files touched
- `src/pages/VendorInviteAccept.tsx` (edit only)
