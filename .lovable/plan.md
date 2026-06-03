## Root Cause

The user logged in as `admin@gmail.com` has built-in role `approver` (the placeholder assigned when a user is created with a custom role) plus the `Admin` custom role. The RLS write policies on admin-managed tables only check `has_role(uid,'admin')` or `has_role(uid,'sharvi_admin')` — neither matches a custom-role user — so every insert/update/delete is blocked. The "new row violates row-level security policy for table buyer_scm_mappings" error in the screenshot is exactly this.

On top of that:
- The four `buyer_scm_mappings` policies do try a screen-permission fallback, but pass `'user-management'` (hyphen). Every screen key in the system is underscored (`user_management`), so the fallback never matches.
- Two policies on `public.vendors` and `public.tenants` allow only `sharvi_admin` and don't include `admin` at all.

## Dynamic Fix (no user-specific updates, no code changes)

One migration that rewrites the affected RLS policies so they accept **any** user the app already considers an admin, via three predicates:

1. `has_role(uid, 'sharvi_admin')` — Sharvi Admin built-in role
2. `has_role(uid, 'admin')` — Admin built-in role
3. `has_screen_permission(uid, '<relevant_screen_key>')` — any custom role granted access to that admin screen (this is how the `Admin` custom role and any future custom role with the same screen access will pass)

This is fully dynamic: nothing references a specific user id, and any custom role configured on the Role Permissions screen automatically gets the matching write access — no further migration needed.

### Tables touched and screen key used for the fallback

| Table | Screen key |
|---|---|
| `buyer_scm_mappings` (fix hyphen → underscore) | `user_management` |
| `vendors` (add admin + screen fallback) | `vendors` |
| `tenants` (add admin + screen fallback) | `sharvi_admin_console` |
| `approval_matrix_levels`, `approval_matrix_approvers` | `user_management` |
| `custom_roles`, `custom_role_screen_permissions`, `user_custom_roles` | `custom_roles` |
| `role_screen_permissions` | `role_permissions` |
| `vendor_invitations` (Super admins policy) | `vendor_invitations` |
| `vendor_approval_progress` | `user_management` |
| `form_step_configs` | `admin_configuration` |
| `sap_api_configs`, `sap_api_credentials`, `sap_api_request_fields`, `sap_api_response_fields`, `sap_default_fields`, `sap_payload_templates` | `sap_sync` |

For each policy listed above:
- Drop the existing `sharvi_admin (+ admin)`-only policy.
- Recreate it with `USING` and `WITH CHECK` set to `has_role(uid,'sharvi_admin') OR has_role(uid,'admin') OR has_screen_permission(uid,'<key>')`.
- Preserve any extra predicates already in the policy (e.g. `buyer_user_id = auth.uid()` on `buyer_scm_mappings` SELECT).

All `customer_admin` policies, vendor-self policies, and tenant-scoped policies remain untouched.

`kyc_api_settings` is intentionally **not** included in this list — KYC-related tables keep their existing policies, so the Admin role can't gain KYC access via this change.

## Out of scope

- No row updates on `user_roles` or any other table.
- No frontend code changes.
- No changes to `customer_admin` policies or vendor-self policies.
- No changes to KYC tables or `kyc_api_settings` permissions.

## Verification

After applying, signing in as any user whose custom role grants `user_management` (e.g. the existing `Admin` custom role) will be able to save the Buyer ↔ SCM mapping and perform every other admin write action, while users without those screen permissions remain blocked.