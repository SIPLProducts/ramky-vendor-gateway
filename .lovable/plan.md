## Why these screens don't appear

Nothing is hardcoded against `sharvi_admin`. The sidebar is fully permission-driven: each item is shown only if `useScreenPermissions().can(screenKey)` returns true, which reads from `role_screen_permissions`.

The bug: the sidebar references screen keys that **don't exist** in the matrix definition (`SCREENS` in `src/pages/RolePermissions.tsx`). Because they're never listed, they're never inserted into `role_screen_permissions` for any role — so `can()` always returns false, for sharvi_admin too.

Keys used by the sidebar but missing from `SCREENS`:
- `sap_api_settings` (SAP API Settings)
- `kyc_api_settings` (KYC API Settings)
- `email_configuration` (Email Configuration)
- `form_builder` (Form Builder)

`custom_roles` is in `SCREENS` but has no sidebar entry — minor gap, fixed in the same pass.

## Fix

### 1. Add the missing rows to `SCREENS`
`src/pages/RolePermissions.tsx` — append:
```
{ key: 'form_builder',        label: 'Form Builder' },
{ key: 'sap_api_settings',    label: 'SAP API Settings' },
{ key: 'kyc_api_settings',    label: 'KYC API Settings' },
{ key: 'email_configuration', label: 'Email Configuration' },
```
So they appear in the Role & Screen Permissions matrix and admins can toggle them per role/tenant.

### 2. Add a sidebar entry for Custom Roles
`src/components/layout/Sidebar.tsx` — add nav item with `screenKey: 'custom_roles'` pointing to `/admin/custom-roles` (route already exists).

### 3. Seed defaults via data insert
Insert `can_access = true` rows in `role_screen_permissions` (tenant_id NULL = global default) using `ON CONFLICT DO NOTHING` so existing admin choices are preserved:
- `sharvi_admin`: all 4 new screens + `custom_roles`
- `admin` / `customer_admin`: `email_configuration`, `form_builder`, `sap_api_settings`, `kyc_api_settings`, `custom_roles`
- Other built-in roles: not granted by default (admins can flip on per tenant)

### 4. Verify on the server
After rebuilding `dist` locally with the fix and deploying:
- Log in as Sharvi Admin → sidebar should now show **SAP API Settings**, **KYC API Settings**, **Email Configuration**, **Form Builder**, **Custom Roles**.
- Open **User Management → Role Permissions** → new rows visible and toggleable.

## Note on your self-hosted server
The seed insert (step 3) runs against the Lovable Cloud database. Your self-hosted backend at `10.200.1.7/supabase` is a separate Postgres — you'll need to apply the same SQL there (or re-run your migration pipeline) for the rows to exist in the self-hosted DB after deploy.
