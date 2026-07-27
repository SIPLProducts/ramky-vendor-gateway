## Goal

Prevent data loss when deleting an approver. Before any delete, force the admin to reassign that user's active workload (approval flow slots, approval matrix, buyer↔SCM mappings, and any in-flight pending approval steps) to another eligible active user — mirroring the existing Inactivate flow.

## Current behavior (verified from code)

- `supabase/functions/admin-delete-user/index.ts` nullifies references on `vendor_invitations`, `vendors.finance_reviewed_by/purchase_reviewed_by`, `portal_config`, `audit_logs`, then deletes rows from `buyer_scm_mappings`, `approval_matrix_approvers`, `user_custom_roles`, `user_tenants`, `user_roles`, `profiles`, and the auth user.
- Nothing rewires `buyer_approval_flows.*_user_id` or in-flight `vendor_approval_progress` rows whose `acted_by`/next-approver identity depends on this user via `buyer_approval_flows`. Result: after delete, pending approvals point at a removed user and get stuck.
- `reassign-user-work` already implements the exact preview + apply logic we need (eligible replacements, flow columns, matrix dedupe, mapping dedupe) for the Inactivate flow.

## Plan

### 1. Backend — new required reassignment step in delete

Edit `supabase/functions/admin-delete-user/index.ts`:

- Accept a new required body field `replacement_user_id` (uuid).
- Before any destructive work, verify the replacement is:
  - active, not the caller, not the target,
  - eligible under the same rules used by `reassign-user-work` (shared custom role if target has one, else shared built-in role).
  - If missing/invalid → return `{ ok:false, error, code:'replacement_required' | 'replacement_invalid' }` with the same structured shape used today.
- Run the same reassignment logic used by `reassign-user-work` apply-mode against the target user, in this order, before existing cleanup:
  1. `buyer_approval_flows` — update each of the 5 approver columns.
  2. `approval_matrix_approvers` — reassign with dedupe on `(level_id, user_id)`.
  3. `buyer_scm_mappings` — reassign both `scm_manager_user_id` and `buyer_user_id` with dedupe.
  4. `vendor_approval_progress` — reassign in-flight rows (`status='pending'` and `acted_by = target`) `acted_by → replacement`. Also cover any historical rows where `acted_by = target` only if `status='pending'`; keep completed history intact.
- Keep existing nullify + delete steps for the target user afterward. Remove the current unconditional `buyer_scm_mappings.delete_as_buyer/as_scm` and `approval_matrix_approvers.delete` — those rows should already have been reassigned; only rows that couldn't move (none, since reassignment is exhaustive) would remain. Safer: leave the deletes in place as a final safety net so residual rows can't block user delete.
- Write an `audit_logs` entry `action='user_deleted_with_reassignment'` including `replacement_user_id`, replacement email, and per-table counts.

### 2. Frontend — force reassignment picker before delete

Edit `src/pages/UserManagement.tsx` (delete trigger) and reuse the existing `ReplaceUserDialog.tsx` pattern (already used for Inactivate).

- Replace the current confirm-and-delete with a two-step dialog:
  1. Call `reassign-user-work` in `preview` mode for the target to fetch `counts` + `eligible` list.
  2. Show an "eligible replacement" dropdown (same UX as inactivate). Disable Delete until a replacement is selected.
  3. If `counts` are all zero AND target holds no approver seats, allow "Delete without reassignment" (still pass no `replacement_user_id`; backend will accept when workload is empty).
- On confirm, invoke `admin-delete-user` with `{ user_id, replacement_user_id }`.
- Surface backend structured errors (`code:'replacement_required' | 'replacement_invalid'`) as toasts and keep the dialog open.

### 3. No DB migration required

All tables and columns already exist; changes are purely in the edge function and UI.

## Verification

- Delete a Finance 2 approver who has: a seat in `buyer_approval_flows.finance_2_user_id`, a pending `vendor_approval_progress` row at FINANCE_2, an `approval_matrix_approvers` row, and a `buyer_scm_mappings` row. After delete:
  - Replacement user appears in the flow slot, the pending progress row's `acted_by` = replacement (still `pending`), matrix + mapping rows reassigned with no unique-constraint errors.
  - Vendor list still shows the request; replacement can act on it.
  - `audit_logs` has `user_deleted_with_reassignment` with counts > 0.
- Delete a user with zero workload → proceeds without requiring a replacement.
- Attempt delete without a replacement while workload > 0 → blocked with clear error.

## Files touched

- `supabase/functions/admin-delete-user/index.ts` — add replacement validation + reassignment steps + new audit action.
- `src/pages/UserManagement.tsx` — swap plain delete confirm for reassignment dialog.
- Reuse `src/components/admin/ReplaceUserDialog.tsx` (or a small variant) for the picker; no schema changes.
