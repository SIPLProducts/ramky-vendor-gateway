# User Management — Consolidate Edit, drop Role column, hide vendors

## Changes to `src/pages/UserManagement.tsx`

1. **Hide vendor users** from the Users tab table:
   - In the `filtered` memo, exclude any user where `role === 'vendor'` AND they have no custom roles (matches the existing `isVendor` definition — pure vendors only).
   - Adjust the stats cards accordingly so the Vendor count card is removed (keep the other role counts).

2. **Remove the Role column and Role button:**
   - Delete the `<TableHead>Role</TableHead>` column and its `<TableCell>` (the badge showing primary role).
   - Delete the `<Button>Role</Button>` in the actions cell.
   - Keep the "Custom Roles" column.

3. **Extend Edit into a full Change Role & Access dialog:**
   - Replace `EditUserDialog` usage with a new consolidated dialog `EditUserDialog` that includes:
     - Full Name (text)
     - Status (Active / Inactive)
     - Role (Select of `ALL_ROLES` — same as ChangeRoleDialog)
     - Tenant Access (multi-select checkboxes, same UX as current ChangeRoleDialog)
     - Custom Roles (multi-select, same UX as current ChangeRoleDialog)
   - Disable Role/Tenant/CustomRoles editing when the user being edited is the current logged-in user (matches existing "cannot change own role" guard).
   - On Save: run the full-name + status update, then the existing role/tenant/custom-role diff logic (reuse `handleChangeRole` internals).
   - Retire the standalone `ChangeRoleDialog` mount in this page (component file untouched — just no longer used here).

## Files to touch

- `src/components/admin/EditUserDialog.tsx` — extend props/UI to include role, tenants, custom roles.
- `src/pages/UserManagement.tsx` — remove Role column & button, filter out vendors, wire new dialog to a single save handler.

## Not changing

- `ChangeRoleDialog.tsx` component stays (may be used elsewhere).
- Backend, RLS, login logging, and auto-logout remain untouched.
- Delete button still available in the actions column.
