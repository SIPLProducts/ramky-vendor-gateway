Delete the user `sunilkumar@sharviinfotech.com` from the local/dev database so the email can be re-used for testing the "Add User" flow.

## What will run

A single SQL block that removes the user and all rows that reference them, in dependency order:

1. Look up the user id from `auth.users` where `email = 'sunilkumar@sharviinfotech.com'`.
2. Delete dependent rows in this order:
   - `public.user_custom_roles` where `user_id = <id>`
   - `public.user_roles` where `user_id = <id>`
   - `public.user_tenants` where `user_id = <id>`
   - `public.custom_role_screen_permissions` — not user-scoped, skip
   - `public.vendor_invitations` where `user_id = <id>` or `created_by = <id>` (set to null instead of delete to preserve invitation history)
   - `public.profiles` where `id = <id>`
3. Delete from `auth.users` where `id = <id>`.

All wrapped in a `DO $$ ... $$` block using the resolved id.

## Notes

- This is destructive and only intended for the local/dev environment as you stated.
- If any FK still blocks deletion, we'll add that table to the cleanup list and retry.
- After deletion, the email is free to re-invite / re-create from the Add User screen.
