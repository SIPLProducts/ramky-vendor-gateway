
## Fix "Access Denied" in Vendor Invitation Flow

### What is actually broken

The invitation flow is still reading `vendor_invitations` directly from the browser in multiple places:

- `src/pages/VendorLogin.tsx`
- `src/pages/VendorRegistration.tsx`
- `src/hooks/useVendorRegistration.tsx`

That table is protected by row-level access rules and does **not** allow vendors/anonymous users to `SELECT` invitation rows directly. So the token is valid in the database, but the browser request is denied.

There is already a safer server-side function available:

- `public.get_invitation_by_token(_token text)` with `SECURITY DEFINER`

But the main invite flow is not using it consistently.

### Implementation plan

#### 1. Replace direct invitation table reads with server-side token lookups
Update all vendor-facing invite pages/hooks to use the existing RPC instead of:

```ts
.from('vendor_invitations').select('*').eq('token', token)
```

Use:

```ts
.rpc('get_invitation_by_token', { _token: token })
```

Apply this in:
- `src/pages/VendorLogin.tsx`
- `src/pages/VendorRegistration.tsx`
- `src/hooks/useVendorRegistration.tsx`

This removes the client-side RLS failure causing the current error.

#### 2. Add a dedicated server-side function for access tracking
The current code also tries to increment `access_count` from the browser before login, which anonymous users cannot update.

Create a new database function such as:
- `public.record_invitation_access(_token text)`

It should:
- validate the token exists
- check expiry / used state
- increment `access_count` safely
- return the same safe invitation payload needed by the UI

Then use this function in `VendorLogin.tsx` instead of client-side `.update()`.

#### 3. Keep authenticated updates, but only after lookup succeeds
For authenticated vendor actions like marking an invitation used after submission, keep the authenticated update path only where policy already supports it.

Review these update calls:
- `src/pages/VendorRegistration.tsx`
- `src/pages/VendorRegisterWithInvite.tsx`

Make sure they only run after the invite was resolved through RPC and the logged-in email matches the invited email.

#### 4. Normalize the invite route flow
The project currently has mixed/legacy invite flows:

- `/vendor/invite` → `VendorLogin`
- `/vendor/registration` → `VendorRegistration`
- `VendorRegisterWithInvite.tsx` exists but is not wired into routing
- `/vendor/register` is a protected internal preview route

Clean this up so the invite journey is unambiguous:

```text
Email link
  -> /vendor/invite?token=...
  -> validate token via RPC
  -> login
  -> /vendor/registration?token=...
  -> continue registration
```

Also remove or rewire the unused `VendorRegisterWithInvite` flow so it does not create confusion.

#### 5. Improve error messaging
Right now the UI collapses multiple backend failures into generic “Access Denied” / “Invalid invitation”.

Update the vendor invite screens to distinguish:
- invalid token
- expired token
- invitation already used
- signed in with wrong email
- temporary backend lookup failure

This makes support easier and avoids false “Access Denied” messages when the real issue is a lookup failure.

#### 6. Verify invitation link generation still points to the correct path
The email function already generates:

```text
{frontendUrl}/vendor/invite?token=...
```

Keep that path, but verify the frontend only expects this one route and does not link vendors to `/vendor/register`.

### Files to update

- `src/pages/VendorLogin.tsx`
- `src/pages/VendorRegistration.tsx`
- `src/hooks/useVendorRegistration.tsx`
- `src/App.tsx`
- `src/pages/VendorRegisterWithInvite.tsx` (cleanup or proper routing)
- new migration for invitation access RPC(s)

### Backend changes needed

Create one migration to add a secure invitation-access function, for example:

- `get_invitation_by_token` stays as the read function
- add `record_invitation_access(_token text)` for anonymous-safe access counting

This is safer than loosening table policies on `vendor_invitations`, because invitation tokens and email data should not become directly queryable from the browser.

### Expected result

After this fix:
- clicking the email invite link will no longer fail with RLS “Access Denied”
- vendors can open `/vendor/invite?token=...` before logging in
- after login, the registration screen can still resolve the same token safely
- the invite flow will consistently use secure server-side token validation instead of direct table reads

### Technical notes

- Do **not** make `vendor_invitations` publicly selectable
- Prefer `SECURITY DEFINER` RPCs for all pre-auth invitation lookups
- Keep sensitive invite data behind server-side functions
- Preserve existing authenticated update policy for marking invites used, unless testing shows it also needs a dedicated RPC
