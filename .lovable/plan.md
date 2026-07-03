## Goal
When a vendor who already submitted clicks **Begin Registration** in the invite email, they should land **directly on the Application Progress screen** — no extra email, no extra click.

## Current behavior
`claim-vendor-invite` marks the invite as used on the first click. On a second click, if the browser has no matching Supabase session (they closed the tab, switched devices, etc.), the function returns `denied / already_used` and the vendor sees the red **Access Denied** card.

## Proposed change

### 1. Edge function `claim-vendor-invite` — allow original vendor to re-enter
Inside the existing `if (invite.used_at)` block, add a new branch **before** the "denied" fallback:

- If `invite.user_id` is set (the auth user we provisioned on first claim) and its email equals `invite.email`, sign that user back in using the stored invite password (`${token}:${invite.id}`) and return `status: 'claimed'` with the fresh session and `redirect: /vendor/registration?token=...`.
- Log the event as `reopen` in `invitation_email_events` (separate from `reuse_attempt`) so we still audit every re-click.
- The prefetch guard and non-POST rejection stay in place, so mail scanners cannot trigger this branch.
- The existing `already_claimed_same_user` shortcut (caller already signed in as invited user) still runs first, so no extra work when the session is already valid.

### 2. Front-end `VendorInviteAccept.tsx`
No new UI phase. Existing `status: 'claimed'` handler already:
- Calls `supabase.auth.setSession(...)`
- Navigates to `/vendor/registration?token=...`

That page already renders the **read-only Application Progress / status tracker** for submitted vendors, so the vendor immediately sees their approval status.

### 3. Routing check
Confirm `/vendor/registration` shows the progress tracker (not an editable form) whenever the vendor's status is `submitted / *_review / approved / rejected`. This is already the behavior (RegistrationStatusTracker + gating we set earlier); no route change required.

## Files to change
- `supabase/functions/claim-vendor-invite/index.ts` — add the "re-open" branch inside the already-used block; log `reopen` audit event.
- No frontend changes required.

## Security trade-off (please confirm)
Because the sign-in is triggered by possession of the invite link, **anyone the vendor forwards the link to after submission could also land on the Application Progress screen** (and, since it signs them in as the vendor, into the vendor account itself). Options:

- **A — Ship as planned above:** smoothest UX, matches your request, but forwarded recipients regain access post-submission.
- **B — Restrict re-open to progress-only, read-only URL:** sign in a limited "viewer" session that can only read this one vendor's status page. More work; still link-holder based.
- **C — Keep magic-link (previous plan):** email a fresh sign-in link to the invited mailbox on re-click. One extra click for the vendor, but forwarded holders cannot open it.

Default in this plan is **A**. Reply with B or C if you want the safer variant instead.
