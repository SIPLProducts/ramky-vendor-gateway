
## Goal

Restore a true single-click invitation experience for the original vendor while keeping forwarded/reused links blocked. No "Confirm your email" screen. No extra DB columns — reuse `vendor_invitations.used_at` and `vendor_invitations.user_id`.

## Important technical honesty (please read)

There is a hard limit on what's possible with a link-based invitation:

- **After the original vendor has claimed the invite** → we can perfectly block anyone else (forwarders, re-clicks, copied links). This is enforceable server-side using `used_at` + `user_id`.
- **Before the original vendor has clicked even once** → the link is just a URL. If the vendor forwards the email *before* they themselves click, the server has no way to tell the forwarded recipient apart from the real vendor. The only way to block this case is to require the opener to prove they own the invited inbox (magic link to that inbox, OTP, or type-your-email gate) — which breaks the single-click UX you want.

Given your instruction to keep it single-click and skip the confirm-email screen, the plan treats **first click = claim**. Forwarded-before-first-click cannot be blocked under those constraints; every other forward/reuse case is blocked.

## Behavior

1. Buyer sends invite → vendor gets email with `.../vendor/invite?token=XYZ`.
2. Vendor clicks **Begin Registration**:
   - Page shows a brief "Signing you in…" spinner.
   - Client calls `claim-vendor-invite` edge function with the token.
   - Server logic:
     - Look up invitation by token. If missing/expired → error card.
     - If `used_at IS NULL`:
       - Ensure an auth user exists for `invitation.email` (create if missing, email_confirm=true).
       - Set `used_at = now()`, `user_id = <that auth user id>`.
       - Generate a one-shot magiclink for that email, normalized for the caller's origin (same normalization already in `accept-vendor-invite`).
       - Return `{ action_link, status: "claimed" }`.
     - If `used_at IS NOT NULL`:
       - If the caller is already authenticated **and** their `auth.uid()` matches `invitation.user_id` → return `{ status: "already_claimed_same_user", redirect: "/vendor/registration?token=..." }` (lets the original vendor reopen from the same email later).
       - Otherwise → return `{ status: "denied" }` (Access Denied card, no email sent, no session created).
3. Client:
   - `claimed` → `window.location.href = action_link` (auto sign-in → lands on registration form).
   - `already_claimed_same_user` → navigate straight to registration.
   - `denied` / `expired` / `invalid` → render the existing full-screen red Access Denied / error card. No email is triggered.

## Return-to-vendor (approval workflow) flow — unchanged behavior, no new invitation

- The approval "returned to vendor" notification email should link to `/vendor/registration?token=<original invite token>` (what it already does).
- Because `used_at` is set and `user_id` matches the original vendor, `claim-vendor-invite` returns `already_claimed_same_user` and the vendor is routed straight in. If their session has expired, we fall through to a normal sign-in prompt on `/vendor/login` (existing page), then back to the form.
- Nothing about the approval workflow, statuses, or vendor record changes.

## Files to change (reuse existing pieces)

- `supabase/functions/claim-vendor-invite/index.ts` **(new, but replaces the current two-step `send-invite-signin-link` + `verify-invite-session` roundtrip for the first-click case).** Uses existing `used_at`, `user_id`, `expires_at` columns. Reuses the action-link normalization already present in `accept-vendor-invite`.
- `src/pages/VendorInviteAccept.tsx` — remove the "Confirm your email" phase entirely; on mount, call `claim-vendor-invite` and branch on the response. Keep the existing Access Denied and error UIs.
- `src/pages/VendorInviteCallback.tsx` — keep only as a thin passthrough (magiclink lands here → redirect to `/vendor/registration?token=...`). No further server verification needed since the claim already happened.
- `src/App.tsx` — no route changes.
- `supabase/config.toml` — add `[functions.claim-vendor-invite] verify_jwt = false`.
- Leave `send-invite-signin-link`, `verify-invite-email`, `verify-invite-session`, `accept-vendor-invite`, and the `signin_sent_count` / `last_signin_sent_at` columns in place so nothing else breaks. They simply stop being called by the vendor invite page.

## What is explicitly NOT changed

- No database migration.
- No changes to vendor registration form logic, approval workflow, SAP sync, or email templates.
- No changes to buyer / admin / finance login flows.
- No changes to `/vendor/login` (still available as the manual fallback).

## Summary of the trade-off

| Scenario | Blocked? |
|---|---|
| Original vendor clicks once | ✅ Signed in automatically |
| Original vendor re-opens later (same account) | ✅ Allowed |
| Same link re-clicked by anyone else after claim | ✅ Access Denied |
| Link copied/forwarded after claim | ✅ Access Denied |
| Link forwarded **before** original vendor's first click | ❌ Not blockable without breaking single-click UX |

If the last row is unacceptable, the only fix is to reintroduce an inbox-proof step (magic link or OTP to the invited email) — say the word and I'll switch to that variant instead.
