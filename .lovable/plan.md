## Goal
In the Create User dialog (User Management), make the Tenants selection optional when the chosen role is `sharvi_admin` or `admin`. For all other roles it stays mandatory as today.

## Changes
File: `src/components/admin/CreateUserDialog.tsx`

1. Add a derived flag:
   ```ts
   const tenantOptional = selectedRole === 'sharvi_admin' || selectedRole === 'admin';
   ```

2. In `handleSubmit`, skip the "at least one tenant" check when `tenantOptional` is true:
   ```ts
   if (!tenantOptional && selectedCodes.length === 0) { ...toast... return; }
   ```

3. Update the Tenants label so the asterisk only shows when required:
   - `Tenants *` → `Tenants{tenantOptional ? '' : ' *'}` with helper text "(optional for admin roles)" when `tenantOptional`.

4. No backend / edge function changes — `admin-create-user` already receives `sap_tenants` and can accept an empty array.

## Out of scope
- No changes to the role list, other dialogs, or backend logic.