

## Source Approver Name & Email dropdowns from all application users

### What's wrong today

The Approver and Email dropdowns only list users already linked to the selected tenant via `user_tenants`. If a user exists in the system but isn't pre-assigned to the tenant, they don't appear — forcing the admin to first open "Assign Users" before they can pick someone.

### Fix

Switch the dropdown source from "tenant users only" to **all profiles in the application**, while keeping role information visible.

**Behaviour after fix**
- Both Name and Email dropdowns list **every user with a profile** (sourced via `useAllProfilesWithRoles()`, which already exists and is used by the `AssignUsersToTenantDialog`).
- Search by name or email continues to work.
- The Role column still shows that user's current role (editable for admins).
- When an approver is selected who isn't yet linked to the chosen tenant, we **auto-create the `user_tenants` link** during Save All so downstream RLS (vendor approval visibility) keeps working.
- "Assign Users" button stays available as a shortcut, but is no longer required upfront.

### Files touched

- `src/components/admin/ApprovalMatrixConfig.tsx`
  - Replace `useTenantUsersWithRoles(tenantId)` with `useAllProfilesWithRoles()` for the dropdown source. Map its `{ user_id, full_name, email, role }` shape into the existing `ApproverCombobox`.
  - Drop the "No users assigned to this tenant" empty state inside the combobox (no longer applicable). Keep a generic "No users found" fallback.
  - In `saveAll`, after upserting approvers, compute the set of selected `user_id`s not present in `user_tenants` for `tenantId` and **insert the missing `(user_id, tenant_id)` rows** so approver RLS still resolves them. Wrapped in the same try/catch with console tracing: `[ApprovalMatrix] auto-linking N users to tenant`.
  - Invalidate `tenant-users-with-roles` and `tenant-user-counts` after save so the rest of the app reflects the new memberships.

### Out of scope

- No DB schema or RLS change.
- No change to `route-vendor-approval` or downstream approval execution.
- No change to the `AssignUsersToTenantDialog` (kept as a power-user shortcut).
- Role dropdown editability rules unchanged.

