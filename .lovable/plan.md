Delete user `sunilkumar@sharviinfotech.com` from the Lovable Cloud (dev) database so the email can be re-used in the Add User flow.

## Steps

1. Look up the user id in `auth.users` for that email.
2. Detach / delete all references in this order:
   - `public.vendor_invitations`: set `user_id = NULL` and `created_by = NULL` where they match (preserve invitation history).
   - `public.user_custom_roles`, `public.user_roles`, `public.user_tenants`: delete rows for that user.
   - `public.buyer_approval_flows`: null out `scm_manager_user_id`, `scm_head_user_id`, `finance_1_user_id`, `finance_2_user_id`, `ceo_office_user_id` references; delete rows where `buyer_user_id` matches.
   - `public.buyer_scm_mappings`: delete rows where `buyer_user_id` or `scm_manager_user_id` matches.
   - `public.approval_matrix_approvers`: delete rows for that user.
   - `public.profiles`: delete the row with matching id.
   - `auth.users`: delete the user row.
3. Verify via a read query that the email is gone.

Executed as a single SQL block through the data tool.
