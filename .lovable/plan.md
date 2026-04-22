

## Approval Matrix — replace user dropdowns with free-text Name & Email inputs

### What changes

Drop the user-picker dropdowns entirely. Admins type the approver's **Name** and **Email** directly into each row. No lookup against `profiles`, no auto-link to tenant, no role editing from this screen.

### New row layout (left → right)

| Column | Input | Notes |
|---|---|---|
| Level # | dropdown | unchanged |
| Approver Name | text input | free text, required |
| Email | email input | free text, required, validated as email format |
| Mode | dropdown | ANY / ALL — unchanged |
| 🗑 | button | remove row |

**Removed from row:** Approver combobox, Email combobox, Role dropdown.

### Storage

`approval_matrix_approvers` currently keys approvers by `user_id` (FK to `profiles`). Since we're no longer picking a registered user, we need to store name + email instead.

Plan:
- Add two nullable columns to `approval_matrix_approvers`: `approver_name text`, `approver_email text`.
- Make `user_id` nullable (existing rows keep their `user_id`; new rows use name + email).
- On Save All, insert rows with `user_id = null`, `approver_name`, `approver_email`.
- `level_name` continues to auto-fill as `"Level {N}"`; `designation` stays null.

### Downstream impact

`route-vendor-approval` and `process-approval-action` currently resolve approvers by `user_id` to look up emails. After this change they'll prefer `approver_email` directly when `user_id` is null — single conditional in those edge functions. No change to vendor approval state machine.

### Validation

- Name: required, trimmed, max 100 chars.
- Email: required, must match standard email regex, max 255 chars.
- Per level: no duplicate emails.
- Diagnostics panel updates to show "Row X · Name required" / "Row X · Invalid email" / "Row X · Duplicate email at Level Y".

### Files touched

- **DB migration** — add `approver_name`, `approver_email` columns; make `user_id` nullable on `approval_matrix_approvers`.
- `src/components/admin/ApprovalMatrixConfig.tsx` — remove `useAllProfilesWithRoles`, `ApproverCombobox`, role column, auto-link logic; add two `<Input>` cells; update `rows` state shape (`approver_name`, `approver_email` instead of `user_id`); update validation, save payload, and chain preview ("Level N — name <email>").
- `supabase/functions/route-vendor-approval/index.ts` — when reading approvers, fall back to `approver_email` if `user_id` is null.
- `supabase/functions/process-approval-action/index.ts` — same fallback for notification recipients.

### Out of scope

- No change to `AssignUsersToTenantDialog` or `user_tenants`.
- No change to `user_roles` (role editing removed from this screen — manage in User Management).
- No migration of existing rows; both shapes coexist.

### After the change — quick check

1. Open Approval Matrix → pick tenant → add a row.
2. Type any name and email directly in the cells.
3. Save All → top strip shows new counts.
4. Approval emails route to the typed address when that row's level becomes active.

