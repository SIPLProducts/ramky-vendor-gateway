## Problems

1. **Create User → Tenant validation still fires for Admin.** Screenshot shows Role = "Admin" with the "Tenant required" toast. `CreateUserDialog` only marks `tenantOptional` when `selectedRole === 'sharvi_admin' || selectedRole === 'admin'`, but the dialog's built-in `ROLES` list is only `['vendor', 'sharvi_admin']`. "Admin" is being selected as a **custom role** (`custom:<id>`), so `tenantOptional` stays false and the tenant selector is enforced.
2. **Admin / Sharvi Admin users don't appear when filtering by those options.** The Users table has no built-in-role column, and when a user has role `admin` / `sharvi_admin` with no custom role, nothing in the row shows their role. Additionally, `admin-create-user` may assign `approver` as built-in when a custom role is used, so a user shown as "Admin" (custom role) has `u.role === 'approver'` — filtering by the Admin/Sharvi Admin dropdown option (built-in keys) won't match them.

## Fix (scope: two files)

### A. `src/components/admin/CreateUserDialog.tsx`
- Add `admin` to the built-in `ROLES` list so it can be picked as a real built-in role: `['vendor', 'admin', 'sharvi_admin']`.
- Extend `tenantOptional` to also cover custom roles whose name is "Admin" or "Sharvi Admin" (case-insensitive). Match by looking up the selected `custom:<id>` in the `customRoles` prop.
- When `tenantOptional` is true, skip the SAP tenant fetch UI enforcement (already handled) and don't require `selectedCodes.length > 0` on submit (already handled — this just extends the trigger).

### B. `src/pages/UserManagement.tsx`
- Add a **Role** column to the Users table (between Custom Roles and Tenants) showing a Title Case label for the built-in role (`Admin`, `Sharvi Admin`, `Approver`, etc.) or `—` when null. Bump `colSpan` from 8 to 9 on the loading / empty rows.
- Update the role filter to also match users whose **custom role name** equals the built-in label when a built-in option is selected. Concretely: if `roleFilter === 'admin'` keep users where `u.role === 'admin'` OR any `u.customRoles[].name` equals "Admin" (case-insensitive); same for `sharvi_admin` ↔ "Sharvi Admin". This covers users created via a custom "Admin" role that internally maps to `approver`.
- Dropdown list stays as approved earlier (Buyer, SCM CO, SCM Head, Finance 1, Finance 2, CEO Office, SAP Team, Admin, Sharvi Admin).

No backend or edge-function changes. No changes to other screens.
