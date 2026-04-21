

## Auto-create vendor account from invite email (no password prompt)

### What changes

Today the invite link drops the vendor on a login screen that asks for a password they were never given. Instead, the invite link should **automatically provision the vendor's account** and sign them straight into the registration form — zero password entry on first visit.

### New flow

```text
Email link
  -> /vendor/invite?token=...
  -> validate token (RPC)
  -> auto-create auth user for invited email (server-side, random password)
  -> generate a magic link / one-time session
  -> sign vendor in silently
  -> redirect to /vendor/registration?token=...
```

The vendor never sees a password field on first visit. On any future visit, they can request a magic link from `/vendor/login` using their invited email.

### Backend work

1. **New edge function `accept-vendor-invite`** (public, `verify_jwt = false`)
   - Input: `{ token }`
   - Uses service-role key to:
     - Call `get_invitation_by_token` to validate token (exists, not expired, not used)
     - Check if auth user exists for invited email; if not, create one via `auth.admin.createUser` with a random password and `email_confirm: true`
     - Generate a magic link via `auth.admin.generateLink({ type: 'magiclink', email })`
     - Return `{ action_link, email, invitation_id }`
   - Tracks access via `record_invitation_access`

2. **New RPC `claim_invitation(_token, _vendor_id)`** (`SECURITY DEFINER`)
   - Validates token + matches `auth.jwt() ->> 'email'`
   - Sets `used_at`, links `vendor_id`
   - Replaces the remaining direct `vendor_invitations.update` calls

### Frontend work

1. **`/vendor/invite` route** (`src/App.tsx`)
   - Point to a new lightweight `VendorInviteAccept` page (or reuse `VendorRegisterWithInvite` rewritten)
   - Page logic:
     - Read `token` from URL
     - Call `accept-vendor-invite` edge function
     - On success: `window.location.href = action_link` (Supabase magic link auto-signs the user in and redirects)
     - Configure the magic link `redirectTo` = `${origin}/vendor/registration?token=...`
   - Show clear states: validating → signing you in → error (invalid/expired/used)

2. **`/vendor/registration`**
   - Already uses `get_invitation_by_token` ✓
   - Replace direct `vendor_invitations.update(...)` with `claim_invitation` RPC after submit

3. **`/vendor/login`** — repurpose as fallback
   - Remove "temporary password from invitation email" copy
   - Offer **"Email me a sign-in link"** (magic link) using the invited email
   - Keep password login only for vendors who set one later

4. **Admin invitation UI** (`AdminInvitations.tsx`)
   - Update help text: "Vendor will be signed in automatically from the email link — no password required"

### Files touched

- new: `supabase/functions/accept-vendor-invite/index.ts`
- new migration: `claim_invitation(_token text, _vendor_id uuid)` RPC
- new: `src/pages/VendorInviteAccept.tsx` (or rewrite `VendorRegisterWithInvite.tsx`)
- edit: `src/App.tsx` (route `/vendor/invite` → `VendorInviteAccept`)
- edit: `src/pages/VendorLogin.tsx` (magic-link fallback, remove password copy)
- edit: `src/pages/VendorRegistration.tsx` (use `claim_invitation` RPC on submit)
- edit: `src/hooks/useVendorRegistration.tsx` (use `claim_invitation` RPC on submit)
- edit: `src/pages/AdminInvitations.tsx` (copy update)

### Expected result

- Vendor clicks the email link → lands on `/vendor/invite?token=...` → sees a brief "Signing you in…" → arrives signed-in on the registration form
- No password prompt, no manual signup
- Returning vendors can request a magic link from `/vendor/login` if their session expires
- All invitation reads/writes go through `SECURITY DEFINER` RPCs or a service-role edge function — no direct browser access to `vendor_invitations`

### Technical notes

- `auth.admin.createUser` + magic-link generation requires `SUPABASE_SERVICE_ROLE_KEY` (already configured)
- Magic link `redirectTo` carries the `token` query param so registration can resume
- If the auth user already exists (returning vendor on a fresh device), skip create and just generate the magic link
- `vendor_invitations` RLS stays locked; only edge function (service role) and RPCs touch it

