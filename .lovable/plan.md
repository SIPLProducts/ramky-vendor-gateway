## Problem

Today the server generates the magic-link URL and returns it to whoever's browser opened the invitation link. That URL itself carries the auth token, so a forwarder who clicks it gets signed in as the invited email. Nothing about "who is in the invited inbox" is ever checked.

## Fix: inbox-based verification + server-side email match

Instead of handing the magic-link URL back to the browser, we trigger Supabase to **email** the sign-in link to the invited address. Only someone with access to that inbox can complete sign-in. After sign-in, an edge function double-checks `auth.jwt().email === vendor_invitations.email` — mismatch = Access Denied.

### Flow

1. Vendor clicks **Begin Registration** → `/vendor/invite/accept?token=…`
2. Frontend calls new edge function `send-invite-signin-link({ token, redirectOrigin })`:
   - Validates token (exists, not expired, not `used_at`)
   - Ensures the auth user exists for `invite.email` (create if needed, email_confirm=true)
   - Calls `admin.auth.admin.generateLink({ type: 'magiclink', email: invite.email, options: { redirectTo: `${origin}/vendor/invite/callback?token=…` } })` and **sends the email itself** via the existing Resend/SMTP path (subject: "Sign in to complete your vendor registration")
   - Does NOT return the action link to the browser
   - Returns `{ masked_email }`
3. Page swaps to a "Check your inbox — we sent a sign-in link to `s•••l@sharviinfotech.com`" card with a Resend button (30s cooldown). Forwarder is stuck here.
4. Real recipient opens their inbox, clicks the link → Supabase auth completes → browser lands on `/vendor/invite/callback?token=…` with an active session.
5. Callback page calls new edge function `verify-invite-session({ token })` with the user's JWT:
   - Reads `invite.email` for the token
   - Compares `lower(auth.jwt().email) === lower(invite.email)`
   - Also enforces `used_at IS NULL` (one-time)
   - On match: stamps `used_at`, `user_id`, `vendor_id` (via existing `claim_invitation` RPC), returns `{ ok: true }`
   - On mismatch: calls `supabase.auth.signOut()` on the client after receiving `{ code: 'email_mismatch' }`, and shows the existing red **Access Denied** card
6. On success, navigate to `/vendor/registration?token=…` (existing flow)

### Why this is the strongest option without typing

- The auth token never appears in a URL the forwarder's browser can reach — it lives in the invited mailbox.
- Even if a forwarder somehow obtains a session (e.g. via another route), the callback verifies `jwt.email === invite.email` server-side and signs them out.
- One-time `used_at` stamping prevents replay.

## Technical details

**New edge function** `supabase/functions/send-invite-signin-link/index.ts`:
- Input: `{ token, redirectOrigin }`
- Validate token; ensure auth user for `invite.email`
- `admin.auth.admin.generateLink({ type: 'magiclink', email: invite.email, options: { redirectTo: `${origin}/vendor/invite/callback?token=${token}` } })`
- Normalize the action link the same way `accept-vendor-invite` does today (proxy host rewrite, `/supabase` prefix, `redirect_to` param rewrite)
- Send email via existing send path (mirror `send-vendor-invitation`) — HTML with a big "Sign in" button pointing at the normalized action link, plus the raw URL as fallback
- Return `{ masked_email }` only

**New edge function** `supabase/functions/verify-invite-session/index.ts`:
- Input: `{ token }` (Authorization: Bearer <user jwt>)
- Decode JWT via `admin.auth.getUser(jwt)` — reject if no user
- Read `vendor_invitations` by token; reject `expired`, `already_used`, or `email_mismatch` with distinct `code`s
- On match: call existing `claim_invitation` RPC to stamp `used_at`/`user_id`
- Return `{ ok: true, vendor_id }`

**Frontend** `src/pages/VendorInviteAccept.tsx`:
- Phases: `verifying` → `sent` → (external inbox click) → done. Plus existing `denied` / `error`
- On mount: call `send-invite-signin-link`, then render "Check your inbox at `masked_email`" card with a Resend button (calls the same function, 30s cooldown, 5 sends/hour cap enforced server-side)
- Remove the current call to `accept-vendor-invite` and the `verifyOtp` / auto-navigate logic from this page — sign-in now happens when the user clicks the mailed link

**New frontend route** `/vendor/invite/callback` → `src/pages/VendorInviteCallback.tsx`:
- Waits for `supabase.auth.onAuthStateChange` (SIGNED_IN) or a live `getSession()`
- Calls `verify-invite-session({ token })`
- On `ok` → `navigate('/vendor/registration?token=…', { replace: true })`
- On `code: 'email_mismatch'` → `supabase.auth.signOut()` then show Access Denied card (reuse the component from `VendorInviteAccept`)
- On `already_used` / `expired` / `invalid` → matching error state

**Router** `src/App.tsx`:
- Add `<Route path="/vendor/invite/callback" element={<VendorInviteCallback />} />`

**Rate limiting** (small, on `vendor_invitations`):
- Add `signin_sent_count int default 0`, `last_signin_sent_at timestamptz` — reject 6th send within an hour with `code: 'rate_limited'`

**Existing edge functions** — leave `accept-vendor-invite` and `get-invitation-summary` deployed but no longer called from this page (harmless).

## Files touched

- `supabase/migrations/<new>.sql` — add `signin_sent_count`, `last_signin_sent_at` columns
- `supabase/functions/send-invite-signin-link/index.ts` — new
- `supabase/functions/verify-invite-session/index.ts` — new
- `src/pages/VendorInviteAccept.tsx` — swap to "Check your inbox" phase
- `src/pages/VendorInviteCallback.tsx` — new
- `src/App.tsx` — add callback route

## Deploy note

Run the migration and deploy the two new edge functions on your self-hosted server. Also confirm `Site URL` / `Additional Redirect URLs` in your self-hosted GoTrue include `<origin>/vendor/invite/callback`, otherwise the mailed link will refuse to redirect.
