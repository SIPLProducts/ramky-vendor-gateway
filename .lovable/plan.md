
## Point 1 — Save Mapping fails with RLS error on `buyer_scm_mappings`

**Root cause:** The existing INSERT policies on `buyer_scm_mappings` only allow `sharvi_admin`, `admin`, or `customer_admin` app_roles. The "Admin" user in your server (`admin@gmail.com`) was created with the User Management screen permission but does NOT have one of those base roles — so the WITH CHECK fails. The Users / Custom Roles / Role Permissions / Approval Matrix / Buyer-SCM tabs were globalized previously, but the underlying RLS for `buyer_scm_mappings` was never relaxed to match.

**Fix (migration):**
- Drop the three legacy hardcoded policies.
- Add permission-driven policies using a SECURITY DEFINER helper `public.has_screen_permission(_user_id, _screen_key)` (create if it does not already exist) that checks `screen_permissions` / `custom_role_screen_permissions` (whichever table is in use).
- New policies:
  - `SELECT` — `has_screen_permission(auth.uid(),'user-management')` OR mapped user (`buyer_user_id = auth.uid()` OR `scm_manager_user_id = auth.uid()`) OR has app_role admin/sharvi_admin.
  - `INSERT/UPDATE/DELETE` — `has_screen_permission(auth.uid(),'user-management')` OR admin/sharvi_admin.

## Point 2 — Tenant Scope dropdown unification + search + mapped-user counts

**Approval Matrix tab:**
- Remove the internal "Tenant" dropdown inside `ApprovalMatrixConfig.tsx`. Instead, accept `tenantId` as a prop driven by the page-level **Tenant Scope** selector (the existing card in the header).
- Update `src/pages/UserManagement.tsx` to pass `tenantId={scopeTenantId === ALL_TENANTS ? null : scopeTenantId}` to `<ApprovalMatrixConfig />`, mirroring how `BuyerScmMapping` already receives it.
- When `tenantId` is null, show an empty-state prompt: "Select a tenant from Tenant Scope to configure the Approval Matrix."

**Tenant Scope dropdown (header):**
- Convert the plain `<Select>` to a searchable Combobox (using existing `Command` + `Popover` shadcn primitives) so users can type to filter.
- Show the mapped-user count next to each tenant name, e.g. `Ramky Infrastructure Ltd · 6 users`, using `useTenantUserCounts()` (already exists).
- This single Tenant Scope drives both Approval Matrix and Buyer-SCM tabs.

**Buyer ↔ SCM tab:**
- No internal tenant picker exists today; it already uses the Tenant Scope. The new searchable picker with counts automatically applies.

**All other tenant dropdowns across the app:**
- Build a reusable `<TenantCombobox>` component (searchable, optional user-count badge) and replace existing tenant `<Select>` usages in:
  - `UserManagement.tsx` (header scope)
  - `ApprovalMatrixConfig.tsx` (after refactor it inherits via prop — no picker)
  - `BuyerScmMapping.tsx` (no internal picker; n/a)
  - `AssignTenantDialog.tsx`, `AssignUsersToTenantDialog.tsx`, `CreateUserDialog.tsx`, `ChangeRoleDialog.tsx`, `CustomRoleDialog.tsx` — wherever a tenant `<Select>` exists.
  - Vendor invitation / approval-matrix approver tenant pickers where applicable.

## Point 3 — Delete User edge function failed + "all edge functions failing"

**Root cause for Delete User:** `admin-delete-user` throws when a referenced FK still points at the user. Common failures observed on self-hosted:
- `buyer_scm_mappings.buyer_user_id` / `scm_manager_user_id` / `created_by` have no `ON DELETE` action.
- `approval_matrix_approvers.approver_id` references the user.
- `vendor_approval_progress.actor_id` / approver references.
- `smtp_email_configs.created_by`.
- `notifications.user_id`, `screen_permissions.created_by`, etc.

The function only nullifies a few tables, so any leftover FK breaks deletion → toast shows generic "Edge Function returned a non-2xx status code".

**Fix:**
1. Extend `admin-delete-user/index.ts` to also clean up:
   - `buyer_scm_mappings` (delete rows where user is buyer/scm OR nullify `created_by`).
   - `approval_matrix_approvers` (delete rows where `approver_id = user_id`).
   - `vendor_approval_progress` (nullify actor columns).
   - `smtp_email_configs` (nullify `created_by` and delete configs owned by the user's email).
   - `custom_roles.created_by` (nullify).
   - `audit_logs` referencing `target_user_id` in details (skip — JSONB).
   - Any other FK references found via `information_schema`.
2. Return structured `{ ok:false, step, error }` JSON with HTTP 200 so the toast displays the actual cause instead of "non-2xx".
3. Update the UI toast in `UserManagement.tsx` to render the `step` + `error` returned from the function.

**Edge-function audit (broader "edge function failed" issue):**
- Sweep every function under `supabase/functions/*` and apply the same pattern: catch errors, return `200` with `{ ok:false, error, step }`, never throw raw to the client. Concrete functions to harden in this pass (most-used in flows the user mentioned):
  - `admin-create-user`, `admin-delete-user`
  - `send-vendor-invitation` (already done — verify)
  - `process-approval-action`, `route-vendor-approval`
  - `sync-vendor-to-sap`, `sync-vendor-to-dms`
  - `notify-vendor-submission`, `notify-finance-approval`, `send-status-notification`
  - `smtp-config-save`, `smtp-config-test`, `smtp-config-delete`
- Investigate self-hosted edge-function logs for the failing actions and surface the specific root cause for each. Where the failure is RLS-driven (service-role client missing), switch the client to `SUPABASE_SERVICE_ROLE_KEY` for mutations after the user-context client validates the caller's permission.

## Technical Notes

```text
buyer_scm_mappings  RLS (new)
  USING / WITH CHECK = has_screen_permission(auth.uid(),'user-management')
                      OR has_role(auth.uid(),'admin')
                      OR has_role(auth.uid(),'sharvi_admin')
  SELECT also OR buyer_user_id = auth.uid() OR scm_manager_user_id = auth.uid()
```

```text
TenantCombobox (new)
  props: value, onChange, tenants, userCounts?, placeholder?, allowAll?
  uses Popover + Command (cmdk) for search
```

**Open question (please confirm before I build):**
- For Point 3's "fix all edge functions" — should I (a) only fix `admin-delete-user` now plus harden the error-response shape across all functions so any failure shows a readable message (recommended, scoped), or (b) do a deep audit/repair of every edge function's business logic which is a much larger effort? Pick (a) or (b).
