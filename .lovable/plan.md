# Allow Deleting Users When No Replacement Exists

## Problem

Deleting a user is currently blocked in two places:

1. In the app, the Delete User dialog says "No eligible replacement found" whenever the user still owns any work (in the screenshot: 1 approval flow). With no other user holding the same role, the Delete button stays disabled — there is no way out.
2. Deleting the same user directly from the database console fails with a generic server error, because other tables still point at that user.

Since the vendor data has already been cleared and these users will be re-created, a replacement is not needed — the leftover references should simply be cleared.

## What will change

**1. "Delete without replacement" option in the Delete User dialog**

- When the user has leftover work AND there is no eligible replacement, show a checkbox: "Delete anyway and clear this user's assignments".
- Ticking it enables the Delete button (button label becomes "Force Delete") and shows a short warning listing what will be cleared.
- When an eligible replacement does exist, behaviour stays exactly as today (replacement is required and preferred).

**2. Backend support for forced deletion**

`admin-delete-user` accepts a `force: true` flag (admin-only, same permission check as today). With `force`:

- Approval-flow columns pointing at the user (`scm_manager_user_id`, `scm_head_user_id`, `finance_1_user_id`, `finance_2_user_id`, `ceo_office_user_id`) are set to NULL.
- Rows in `approval_matrix_approvers` and `buyer_scm_mappings` for that user are removed.
- `vendor_invitations.created_by` and any pending `vendor_approval_progress.acted_by` references are detached (set to NULL) rather than blocking.
- The auth user, profile, role rows and custom-role rows are then deleted.
- The response reports exactly what was cleared, and the toast shows it.

Force delete is never silent: it only runs when the admin explicitly ticks the box.

**3. Clean database deletion**

Foreign keys from application tables to users are reviewed so a user delete cascades or nulls instead of erroring, which also fixes the failure seen when deleting from the database console.

## Technical notes

- Files: `supabase/functions/admin-delete-user/index.ts`, `src/components/admin/DeleteUserDialog.tsx`, plus a migration for the FK `ON DELETE SET NULL` / `CASCADE` adjustments.
- The existing replacement/reassign path (`reassign-user-work`) is untouched.
- Self-hosted server: the migration and the updated edge function need to be deployed with the usual deploy script for the change to take effect there.
