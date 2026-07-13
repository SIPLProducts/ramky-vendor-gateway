## Goal
When an admin sets a user to **Inactive** in User Management, force selection of a replacement user of the same role/tenant scope, then reassign all approval routing to the replacement so pending and future work continues without interruption.

## How assignment currently works (context)
- Approval routing per buyer is stored in `buyer_approval_flows` (columns: `scm_manager_user_id`, `scm_head_user_id`, `finance_1_user_id`, `finance_2_user_id`, `ceo_office_user_id`).
- Cross-buyer approval matrix uses `approval_matrix_approvers.user_id` (keyed to `approval_matrix_levels.stage`).
- Buyer ↔ SCM manager mapping uses `buyer_scm_mappings`.
- `vendor_approval_progress` rows do NOT store the approver user id — visibility is derived at query time from the flow tables above. So updating the flow tables automatically re-routes pending vendors, dashboard counts, notifications, and future approvals.

## Changes

### 1. New "Replace User" dialog (frontend)
New file `src/components/admin/ReplaceUserDialog.tsx`:
- Props: inactive user (id, email, role, custom roles, tenant ids), list of eligible replacements, `onConfirm(replacementId)`.
- Shows current user summary + mandatory Replacement dropdown (disabled Confirm until picked).
- Replacement list built from active users filtered by:
  - Same built-in `role` **and** same primary custom role name (e.g. "SCM CO", "SCM Head", "Finance 1", "Finance 2", "CEO Office", "SAP Team", "Buyer"), and
  - Overlapping tenant access (at least one shared `user_tenants.tenant_id`), and
  - `profiles.status = 'active'` and not the user being inactivated.
- Displays a small preview of impacted counts (from step 3 preview query).

### 2. Hook the dialog into `UserManagement.handleSaveEditUser`
In `src/pages/UserManagement.tsx`:
- Detect status transition `active → inactive` inside `handleSaveEditUser`. When detected:
  1. Fetch impact counts + eligible replacements (via new edge function, read-only mode).
  2. Open `ReplaceUserDialog`. If admin cancels, abort the save (status stays active).
  3. On confirm, call the new edge function in `apply` mode with `{ inactive_user_id, replacement_user_id }`, then set profile status to inactive.
- No change to any other edit flow (name, role, tenants, self-edit) — those keep working unchanged.

### 3. New edge function `reassign-user-work`
`supabase/functions/reassign-user-work/index.ts` (admin-only, service role):
- Modes: `preview` (returns counts + eligible replacements) and `apply` (performs reassignment).
- Validates caller is admin (same pattern as `admin-delete-user`).
- Validates replacement user: active, same role set, overlapping tenants.
- In `apply` mode, inside a single logical operation:
  - `UPDATE buyer_approval_flows SET scm_manager_user_id = replacement WHERE scm_manager_user_id = inactive` (repeat for `scm_head_user_id`, `finance_1_user_id`, `finance_2_user_id`, `ceo_office_user_id`, `buyer_user_id` — buyer only when a buyer is being replaced and target is also a buyer).
  - `UPDATE buyer_scm_mappings SET scm_manager_user_id = replacement WHERE scm_manager_user_id = inactive` and same for `buyer_user_id` when applicable (skip rows that would violate the unique pair by deleting duplicates first).
  - `UPDATE approval_matrix_approvers SET user_id = replacement WHERE user_id = inactive` (on unique-constraint conflict for `(level_id, user_id)`, delete the inactive row instead of updating).
  - `UPDATE vendor_approval_progress SET acted_by = acted_by` — NOT changed (history preserved). Pending rows have no user reference, so they auto-route.
- Writes an `audit_logs` row with `action: 'user_inactivated_reassigned'` and details `{ inactive_user_id, inactive_email, replacement_user_id, replacement_email, counts: { buyer_approval_flows, approval_matrix_approvers, buyer_scm_mappings }, updated_by, updated_at }`.
- Returns `{ ok: true, counts }` for the toast.

### 4. Prevent inactive users from being selected anywhere
- `src/components/admin/ApproverPicker.tsx` and any user-picker used in Approval Matrix / Buyer↔SCM / Buyer Approval Flow config: filter out `profiles.status = 'inactive'` when building the options list.
- Notification lookups: no code change needed if they read from the flow tables (already reassigned). Add a safety filter in `send-status-notification` / `notify-finance-approval` to skip sending to a recipient whose profile status is `inactive` (extra guard for stale rows).

### 5. Audit log surfacing
- `src/pages/AuditLogs.tsx`: add a friendly label for the new `user_inactivated_reassigned` action so admins can see the transfer history with counts.

## What is intentionally NOT changed
- Existing vendor registration, SAP sync, dashboards, email templates, and approval processing logic remain untouched.
- History fields (`acted_by`, `rejection_from_user`, `created_by`, `assigned_by`) are preserved as-is.
- Role/tenant edits, self-edit, and the delete flow stay identical.

## Technical notes
- Uniqueness handling: `approval_matrix_approvers(level_id, user_id)` unique — do conflict-safe upsert (delete inactive row when replacement already present at same level). Same idea for `buyer_scm_mappings(buyer_user_id, scm_manager_user_id)`.
- `buyer_approval_flows.buyer_user_id` is UNIQUE — if replacing a buyer whose replacement already has a flow, keep the replacement's existing flow and delete the inactive buyer's flow row.
- All DB writes go through the service-role edge function so RLS doesn't block cross-tenant updates.
- Reactivation later just requires flipping `profiles.status` back to `active`; no reverse migration is performed automatically.

## Files touched
- New: `src/components/admin/ReplaceUserDialog.tsx`, `supabase/functions/reassign-user-work/index.ts`
- Edit: `src/pages/UserManagement.tsx`, `src/components/admin/ApproverPicker.tsx`, `src/pages/AuditLogs.tsx`, `supabase/functions/send-status-notification/index.ts`, `supabase/functions/notify-finance-approval/index.ts`
