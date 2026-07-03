## Goal

Original vendor clicks **Begin Registration** in the invite email → registration form opens directly (no email-confirmation step). Any forwarded / copied / re-clicked link → **Access Denied**.

## Current state

The flow already matches this behavior end-to-end:

- Invite email button → `/vendor/invite?token=<token>` (`VendorInviteAccept.tsx`).
- That page auto-invokes the `claim-vendor-invite` edge function on mount — no user interaction, no confirm-email screen.
- `claim-vendor-invite` performs an **atomic first-click claim**:
  1. Looks up the invitation by token.
  2. If unused → provisions/updates the invited auth user, stamps `used_at + user_id` in a single `UPDATE ... WHERE used_at IS NULL`, signs the vendor in, returns the session, and redirects to `/vendor/registration?token=...`.
  3. If already used by someone else (forwarded/copied) → returns `status: denied`, `VendorInviteAccept` shows the **Access Denied** card.
  4. Only the same signed-in vendor (matching `user_id` or invited email) can reopen a claimed invite.
- All reuse attempts are logged to `invitation_email_events` as `reuse_attempt`.

So the requested behavior is already implemented. The plan below only tightens loose ends and documents the one residual risk.

## Changes

1. **Remove dead legacy code** — `src/App.tsx` still imports `VendorRegisterWithInvite` but no route uses it. Delete the import and delete `src/pages/VendorRegisterWithInvite.tsx` so no stale confirmation-based flow can be linked to by accident.
2. **Make the Access Denied page copy match the spec** in `src/pages/VendorInviteAccept.tsx`: explicitly say "This invitation was already opened by another device/recipient. If you are the intended vendor, please contact <support>." (Current copy is close; adjust wording only.)
3. **Harden the claim endpoint against non-human prefetch**:
   - Reject `GET` / `HEAD` on `claim-vendor-invite` (already POST-only via `functions.invoke`, but add an explicit method guard so any accidental preflight scanner request is a no-op).
   - Add a lightweight bot/prefetch heuristic: skip the claim (return `status: 'pending'`) when the request carries headers commonly set by mail-security scanners (`X-MS-Exchange-Organization-*`, `X-Barracuda-*`, `X-Proofpoint-*`, or `User-Agent` containing `bot|crawler|preview|scanner|linkcheck`). `VendorInviteAccept` will retry the claim from the real browser click.
4. **Document the residual risk** in `email.md`: aggressive corporate mail scanners that fully execute JS in a real browser context can still consume an invite. Mitigation (short TTL + admin re-issue) is already in place; no code change required beyond (3).

## Out of scope

- No new confirmation UI, OTP, or email-match prompt for the original vendor.
- No changes to the registration form, application-progress screen, or approval flow.
- No changes to `send-vendor-invitation` template or link format.

## Technical notes

- Edge function: `supabase/functions/claim-vendor-invite/index.ts` — add method guard + prefetch header check at the top of `Deno.serve`.
- Frontend: `src/pages/VendorInviteAccept.tsx` — handle a new `status: 'pending'` response by re-invoking the claim after a small delay / on visible user gesture (retain current UX: still no explicit button unless the prefetch heuristic fires).
- Cleanup: delete `src/pages/VendorRegisterWithInvite.tsx`, remove its import from `src/App.tsx`.

## Verification

1. Fresh invite → click from real browser → land on registration form, signed in, `used_at` stamped.
2. Forward same email → recipient clicks → **Access Denied** card; `invitation_email_events` row with `reuse_attempt`.
3. Copy the URL to an incognito window → **Access Denied**.
4. Original vendor re-opens their inbox link after submitting → allowed (already-claimed-same-user branch).
5. Simulated scanner UA (`curl -A "Mimecast-Link-Preview"`) hitting `/vendor/invite?token=...` → no claim written; real browser click after still succeeds.
