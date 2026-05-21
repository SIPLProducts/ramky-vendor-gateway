## Simplify Users table actions

The **Change Role & Access** dialog already updates both role and tenant access, so the separate per-row **Tenant** button is redundant. The Tenants column stays as display-only (chip + popover with inline ×‑remove).

### Changes in `src/pages/UserManagement.tsx`

1. **Remove the Tenant action button** in the Actions cell (lines ~499–501). Keep **Role** (opens Change Role & Access) and **Delete**.

2. **Remove now-unused Assign Tenant wiring:**
   - Delete `tenantDialog` state and `setTenantDialog` references.
   - Delete `handleAssignTenant`.
   - Delete the `<AssignTenantDialog ... />` JSX at the bottom of the file.
   - Remove the `AssignTenantDialog` import.

3. **Keep as-is:**
   - Tenants column with the "N tenants" chip popover and × inline remove (`handleRemoveTenant`).
   - Custom Roles column.
   - `ChangeRoleDialog` + `handleChangeRole` (role + tenant access updates flow through here).

### Out of scope
No changes to `ChangeRoleDialog.tsx`, schema, RLS, or business logic. `AssignTenantDialog.tsx` file is left in the repo, simply unused.

### Verification
At `/admin/users`: each row's Actions cell shows only **Role** and **Delete**. Clicking **Role** opens **Change Role & Access** which updates role and tenant access. The "N tenants" chip still opens its popover and × still removes a tenant inline.
