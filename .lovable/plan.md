

## Fix "Access Denied" on Vendor Invitation Link

### Root Cause

When a vendor clicks **Begin Registration** in the invitation email, they land on `/vendor/invite?token=...` **without being logged in**. The page queries `vendor_invitations` directly from the browser to validate the token. However, the table's RLS policies only allow `sharvi_admin`, `admin`, `customer_admin`, `finance`, and `purchase` roles to SELECT rows — there is **no policy for anonymous users**. So the query returns no row, and the UI shows "Invalid invitation link".

The token itself is valid in the database (verified — not expired, not used).

### Fix Approach

We cannot blindly open SELECT to anonymous users (that would expose every invitation, email, and token to the public). Instead, we'll create a **secure database function** that validates one specific token at a time, returning only the minimum data needed (id, email, expires_at, used_at, tenant_id) for that single token.

### Changes

**1. New SECURITY DEFINER database function** (migration)

```sql
create or replace function public.get_invitation_by_token(_token text)
returns table (
  id uuid,
  email text,
  expires_at timestamptz,
  used_at timestamptz,
  tenant_id uuid,
  vendor_name text,
  phone_number text
)
language sql
stable
security definer
set search_path = public
as $$
  select id, email, expires_at, used_at, tenant_id, vendor_name, phone_number
  from public.vendor_invitations
  where token = _token
  limit 1;
$$;

grant execute on function public.get_invitation_by_token(text) to anon, authenticated;
```

This function:
- Accepts only one specific token at a time (no enumeration possible)
- Returns only the fields the registration page needs
- Bypasses RLS safely because it's scoped to a single token lookup

**2. Update `src/pages/VendorRegisterWithInvite.tsx`**

Replace the direct table query:
```ts
supabase.from('vendor_invitations').select('*').eq('token', token).single()
```
with the RPC call:
```ts
supabase.rpc('get_invitation_by_token', { _token: token })
```
and read the first row from the returned array.

The "mark as used" UPDATE after signup stays as-is (runs after `auth.signUp`, so the user is now authenticated; we'll also add an UPDATE policy allowing the just-signed-up user to mark their own invitation used by token match).

**3. Add a narrow UPDATE policy on `vendor_invitations`**

```sql
create policy "Authenticated users can mark own invitation used"
on public.vendor_invitations
for update
to authenticated
using (used_at is null and email = (auth.jwt() ->> 'email'))
with check (email = (auth.jwt() ->> 'email'));
```

This ensures the freshly-created vendor user can flip `used_at` for their own invitation, without giving them write access to anyone else's record.

### Files Touched

- New migration: `get_invitation_by_token` function + UPDATE policy
- `src/pages/VendorRegisterWithInvite.tsx` — swap direct query for RPC call

### Verification

After deploy, opening `https://ramkyvms.netlify.app/vendor/invite?token=9995bc44-9d6c-4f0a-b3a4-4196bbff8ccc` should show the "Create Your Account" form with `bala@sharviinfotech.com` pre-filled, instead of "Access Denied".

