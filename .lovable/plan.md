## Goal
When a user is created with a custom role (e.g. "SAP Team"), the Users list should show **SAP Team** as their role — not the internal `approver` placeholder. Also make Full Name mandatory in the Create User dialog and ensure all 11 system roles exist as selectable custom roles.

## Background
- Built-in `app_role` enum is fixed to: `vendor, finance, purchase, approver, customer_admin, admin, sharvi_admin`. Adding new enum values would require rewriting dozens of RLS policies.
- Custom roles (in `custom_roles` table) already power screen permissions via `custom_role_screen_permissions` and `useScreenPermissions`. This is the right place for Buyer / SCM / Finance 1/2 / CEO Office / SAP Team.
- `CreateUserDialog` currently stores built-in role = `approver` whenever a custom role is selected — that's why the Users table shows "approver" for your SAP Team user.
- Existing custom roles in DB: Admin, Buyer, Finance Approval, SAP Team, SCM Head, SCM Manager. **Missing:** Finance 1, Finance 2, CEO Office.

## Changes

### 1. Seed missing custom roles (data insert)
Insert three rows into `custom_roles` (global, `tenant_id = NULL`, `is_active = true`):
- Finance 1
- Finance 2
- CEO Office

(Sharvi Admin / Vendor / Admin are already covered — Sharvi Admin and Vendor are built-in; an "Admin" custom role already exists.)

### 2. `src/pages/UserManagement.tsx` — show custom role in Users table
- In the **Role** column, if `u.customRoles.length > 0`, render the first custom role name as the primary badge (instead of the built-in `approver` placeholder). Fall back to the built-in role badge only when no custom role is assigned.
- Remove the now-redundant **Custom Roles** column (or keep it for users with multiple custom roles — show only extras beyond the first).
- Update the role-filter dropdown and stats cards to include custom-role names alongside built-in roles, so filtering/counting works for "SAP Team", "Buyer", etc.

### 3. `src/components/admin/CreateUserDialog.tsx` — Full Name required
- Add `*` to the Full Name label.
- In `handleSubmit`, reject submission when `fullName.trim()` is empty with a toast: "Full name is required".
- Keep the placeholder; mark the field visually required.

### 4. (Optional polish) `src/components/admin/ChangeRoleDialog.tsx`
- Same display improvement: when a custom role is assigned, surface that as the user's effective role label in the dialog header.

## Notes
- No enum migration, no RLS changes — built-in role stays `approver` under the hood (purely a placeholder that grants no screen access; the custom role drives all permissions, as already designed).
- After approval I'll insert the 3 missing custom roles, then make the UI edits above.
