

## Simplify Approval Matrix table — drop Level Name & Designation, make Role editable

### New columns (left → right)

| Column | Type | Source / behavior |
|---|---|---|
| **Tenant** | dropdown (toolbar) | `tenants` — unchanged |
| **Level #** | dropdown | 1…max+1 — unchanged |
| **Approver** (User Name) | searchable dropdown | `tenant_users_with_roles` — unchanged |
| **Email** | dropdown | Same user list, searchable by email — selecting it picks the same user (auto-syncs Approver) |
| **Role** | dropdown | `app_role` enum — editable; saving updates `user_roles` for that user |
| **Mode** | dropdown | ANY / ALL per level — unchanged |
| 🗑 | button | Remove row |

**Removed:** Level Name, Designation columns and their inputs.

### Database compatibility

`approval_matrix_levels.level_name` is `NOT NULL`. To avoid a schema migration, I'll auto-fill it on save:
- `level_name` = `"Level {N}"` (e.g. `"Level 1"`)
- `designation` = `null`

This keeps existing data readable and the route-vendor-approval / chain preview working.

### Role dropdown behavior

- Options come from the `app_role` enum: `sharvi_admin`, `admin`, `customer_admin`, `finance`, `purchase`, `approver`, `vendor`.
- Default value = the user's current role (from `tenantUsers`).
- Changing it queues a role update; on **Save All**, after the matrix upsert succeeds, run `user_roles` upsert (`delete` existing rows for that user + `insert` new role) for every changed user. Wrapped in the same try/catch with console tracing.
- Permission: only `sharvi_admin` / `admin` see the Role column as editable; for others it's read-only badge (matches existing RLS on `user_roles`).

### Email column behavior

- Renders as a `Select` showing user emails for the tenant.
- Selecting an email is equivalent to selecting that user in the Approver column (both columns stay in sync via shared `user_id`).
- If no approver chosen yet → placeholder "Select email…".

### Validation changes

- Drop the "Level Name is empty" rule.
- Keep: invalid Level #, missing approver, duplicate approver per level.
- Diagnostics panel & Save All gating updated accordingly.

### Chain preview

- Replace `(unnamed)` with `Level {N}` since names are now auto-generated.

### Files touched

- `src/components/admin/ApprovalMatrixConfig.tsx`
  - Remove Level Name / Designation `<TableHead>` and `<TableCell>` entries.
  - Add Email `<Select>` cell synced to Approver.
  - Convert Role cell from read-only `<Badge>` to `<Select>` (admin only).
  - Track `pendingRoleChanges: Map<user_id, app_role>` in component state.
  - In `saveAll`: set `level_name = "Level ${N}"`, `designation = null`; after matrix save, apply role changes via `user_roles` delete+insert and invalidate `tenant-users-with-roles` query.
  - Update `rowErrors` to drop name check.
  - Update chain preview label.
  - Adjust `min-w-[1100px]` table width down to fit fewer columns.

### Out of scope
- No DB schema change (column stays NOT NULL, auto-filled).
- No change to `route-vendor-approval`, `process-approval-action`, or downstream flow.
- No change to AssignUsers dialog or tenant-user counts.

