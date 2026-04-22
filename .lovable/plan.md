

## Fix empty Approver dropdown — surface the cause and fix it inline

### Why the dropdown looks empty
The Approver combobox queries `user_tenants` for the selected tenant and joins to `profiles`/`user_roles`. For most tenants in your DB, **zero users are assigned** (only "Ramky Infrastructure Limited" has 1 user — Brijesh Kabra). So the dropdown correctly returns no items.

This is not a code bug — it is missing tenant-user assignments. The current screen does show a small warning at the bottom, but it's easy to miss and there's no way to fix it without leaving the page.

### What I'll change

**1. Make the empty state loud and actionable inside the Approver combobox**
- When the combobox opens and `tenantUsers.length === 0`, replace the "No users found" text with a clear message:
  > "No users assigned to this tenant. Click below to assign users."
  followed by an **"Assign Users"** button that opens a dialog (option A) or links to **User Management** filtered to this tenant (option B). I'll go with **option A — inline dialog** so the admin never leaves the screen.

**2. New inline "Assign Users to Tenant" dialog**
- File: `src/components/admin/AssignUsersToTenantDialog.tsx` (new).
- Lists **all profiles** (RLS allows admins/customer_admins to see them) with: full name, email, current role badge, and a checkbox indicating whether they are already in `user_tenants` for this tenant.
- Searchable input.
- "Save" performs a diff: insert new `user_tenants` rows, delete unchecked ones. Invalidates the `tenant-users-with-roles` query so the Approver dropdown refreshes immediately.

**3. Promote the missing-users banner**
- In `ApprovalMatrixConfig.tsx`, move the dashed warning banner to the **top of the card** (above the table) and add an **"Assign Users"** button right inside it that opens the same dialog.

**4. Tenant dropdown — show user counts**
- Annotate each tenant option in the top toolbar as `Tenant Name · N users` so admins can see at a glance which tenants are unconfigured. The count comes from a single grouped query (one extra lightweight `user_tenants` select).

### Files touched
- `src/components/admin/ApprovalMatrixConfig.tsx` — promote empty state, wire up the new dialog, annotate tenant dropdown with user counts, update the `ApproverCombobox` empty-state UI.
- `src/components/admin/AssignUsersToTenantDialog.tsx` — **new**: searchable list of profiles with checkboxes, save = diff `user_tenants`.
- `src/hooks/useTenant.tsx` — small helper `useAllProfilesWithRoles()` returning every profile + primary role for the dialog list (single query, admin-only via RLS).

### Out of scope
- No schema change.
- No change to approval execution, Finance, or SAP sync.
- No change to the User Management page itself.

