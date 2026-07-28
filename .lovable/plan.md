## Problem

On the Vendor Invitations screen, an invitation stays as **Pending** even after the vendor clicks the email link and starts filling the form. It only moves to **Used / In Progress** once the vendor finally hits **Submit**.

## Root cause

Status in `AdminInvitations.tsx` (`getInvitationStatus`) is derived from two fields on `vendor_invitations`:

- `used_at` → drives **Used**
- linked `vendor.status = 'draft'` (via `vendor_id`) → drives **In Progress**

But today both fields are only written at final submit:

- `useVendorRegistration.tsx` calls `supabase.rpc('claim_invitation', { _token, _vendor_id })` **inside `submitVendorMutation`** (line ~1241). Never during autosave / draft creation.
- `VendorInviteCallback.tsx` and `VendorInviteAccept.tsx` do not call `claim_invitation` after the vendor signs in — they just redirect to `/vendor/registration?token=…`.

Result: while the vendor is filling the form, `used_at` is null and `vendor_invitations.vendor_id` is null, so the row keeps evaluating to **Pending**.

## Fix

Stamp the invitation as soon as the meaningful events happen, not only at submit:

1. **When vendor lands on the form after signing in** — mark it **Used**
   In `VendorInviteCallback.tsx` (and `VendorInviteAccept.tsx` where it also lands the vendor into the app), after the Supabase session is confirmed and before navigating to `/vendor/registration`, call:
   ```ts
   await supabase.rpc('claim_invitation', { _token: token });
   ```
   `claim_invitation` (SECURITY DEFINER) is idempotent — it sets `used_at = COALESCE(used_at, now())` and enforces the JWT email match. `_vendor_id` is omitted here because no draft exists yet.

2. **When the vendor's first autosave creates the draft row** — link `vendor_id` so status flips to **In Progress**
   In `useVendorRegistration.tsx` `saveVendorMutation`, right after the first successful INSERT into `vendors` (the branch that produces `savedVendor` for a brand-new vendor), if `options?.invitationToken` is set and the invitation is not yet linked, call:
   ```ts
   await supabase.rpc('claim_invitation', {
     _token: options.invitationToken,
     _vendor_id: savedVendor.id,
   });
   ```
   Wrap it in try/catch with a `console.warn` so autosave never breaks on a claim failure (mirrors the existing submit-time pattern). Only run it when we just created the vendor row (not on every subsequent update) to avoid unnecessary writes.

3. **Leave the submit-time `claim_invitation` call in place** as a safety net (it's already idempotent).

4. **On-behalf flow is unchanged.** Invitations created via "Create Vendor" already carry `created_on_behalf = true`, and `getInvitationStatus` already renders those as **In Progress** immediately. No edit needed.

## Files to change

- `src/pages/VendorInviteCallback.tsx` — call `claim_invitation({ _token })` after session verification, before the final `navigate(target)`.
- `src/pages/VendorInviteAccept.tsx` — same call at the point it hands the signed-in vendor off to `/vendor/registration`.
- `src/hooks/useVendorRegistration.tsx` — inside `saveVendorMutation`, after the initial vendor INSERT succeeds and only for a brand-new vendor, call `claim_invitation({ _token, _vendor_id })` when `options.invitationToken` is present. Non-blocking on error.

## Verification

- Send a fresh invitation → row shows **Pending**.
- Vendor clicks the email link and completes sign-in → row flips to **Used** (blue badge).
- Vendor edits any field so autosave fires and creates the draft → row flips to **In Progress** (amber badge).
- Vendor submits → row disappears from Invitations (status becomes `submitted`, filtered out) and appears on Dashboard / All Vendors, as today.
- On-behalf "Create Vendor" flow still shows **In Progress** immediately after creation.
