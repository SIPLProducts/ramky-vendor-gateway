
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

create policy "Authenticated users can mark own invitation used"
on public.vendor_invitations
for update
to authenticated
using (used_at is null and email = (auth.jwt() ->> 'email'))
with check (email = (auth.jwt() ->> 'email'));
