

## Rebuild Approval Matrix screen — single row-per-approver with dropdowns

### New layout

A flat editable table where each row represents **one approver assignment**. All inputs are dropdowns sourced from existing data, except the level name/designation text fields.

| Column | Source | Type |
|---|---|---|
| **Tenant** | `tenants` (active) | dropdown |
| **Level #** | 1..N (auto-suggested, editable) | dropdown |
| **Level Name** | free text (e.g. "SCM Manager") | text |
| **Designation** | free text (optional) | text |
| **Approver Name** | `profiles.full_name` filtered by users belonging to selected tenant (`user_tenants` join) | dropdown (searchable) |
| **Email** | `profiles.email` — auto-filled when Approver chosen, read-only | display |
| **Role** | `user_roles.role` for chosen user — auto-filled, read-only badge | display |
| **Mode** | `ANY` / `ALL` | dropdown |
| **Actions** | Remove row | button |

Top toolbar: **Tenant filter** (default = first active tenant), **+ Add Row** button, **Save All** button, **Approval Chain** preview strip below toolbar (unchanged behaviour, grouped by level_number desc → 1).

### Behaviour

- Selecting a **Tenant** filters the **Approver Name** dropdown to users in `user_tenants` for that tenant. Email + Role auto-populate from `profiles` and `user_roles`.
- Multiple rows can share the same **Level #** + **Level Name** — they become co-approvers for that level (mode applies per level).
- On **Save**, rows are grouped by `(tenant_id, level_number)`:
  - Upsert one `approval_matrix_levels` row per group (level_name, designation, approval_mode taken from the first row of the group; UI will warn if mode/name differ within a group).
  - Replace `approval_matrix_approvers` for each level with the union of `user_id`s in that group.
  - Remove levels no longer present.
- Validation before save: tenant, level #, level name, and approver required on every row; no duplicate (level#, user) pairs.
- Audit log entry `approval_matrix_saved` (existing).

### Data sources (read-only joins, no schema changes)

- `tenants` → tenant dropdown.
- `user_tenants` joined with `profiles` and `user_roles` → approver dropdown showing "Full Name · email · role".
- `approval_matrix_levels` + `approval_matrix_approvers` → existing rows hydrated into the flat table on tenant change.

### UX details

- Approver dropdown uses a searchable `Command`/`Popover` combobox (already used in `ApproverPicker`). Shows name, email, role badge in each option.
- Level # dropdown lists 1..max(existing)+1 with a "+ New level" option that increments.
- Empty state: "No approvers configured for this tenant. Click + Add Row to start."
- Compact responsive layout: horizontal scroll on small screens; key columns (Approver, Level #, Mode) sticky-left on mobile.

### Files touched

- `src/components/admin/ApprovalMatrixConfig.tsx` — full rewrite to the flat-row model described above.
- `src/components/admin/ApproverPicker.tsx` — extend the option renderer to also surface email + role badge (used inside the new combobox cell). No API change.
- New small helper hook `useTenantUsersWithRoles(tenantId)` in `src/hooks/useTenant.tsx` — returns `{ user_id, full_name, email, role }[]` by joining `user_tenants` → `profiles` → `user_roles` (single tenant scope, RLS already permits).

### Out of scope

- No changes to approval execution flow (`process-approval-action`, `route-vendor-approval`).
- No schema migration (table structure stays one-level / many-approvers; UI just presents it flat).
- No change to the Approval Chain preview semantics.

