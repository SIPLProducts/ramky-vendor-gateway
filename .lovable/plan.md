## Issue

The 5 new approval tabs (SCM Manager, SCM Head, Finance 1, Finance 2, CEO Office) are coded and routed, but in `role_screen_permissions` every role has `can_access = false` for `scm_manager_approval / scm_head_approval / finance1_approval / finance2_approval / ceo_approval`, so the sidebar filter (`useScreenPermissions`) hides them. The legacy "SCM Approval" and "Finance Review" items are still showing instead.

You also asked to confirm: SCM Manager step supports multiple levels (L2…Ln), and only after the **last** SCM Manager approves does the vendor move to SCM Head. That already works in `route-vendor-approval` (it orders eligible levels by stage, then by `level_number`, so all `SCM_MANAGER` rows run before `SCM_HEAD`) and in `process-approval-action` (advances to the next pending row by lowest `level_number`).

## Changes

### 1. Grant screen access to the 5 new approval pages
Update `role_screen_permissions` so:
- `scm_manager_approval`, `scm_head_approval`, `finance1_approval`, `finance2_approval`, `ceo_approval` → `can_access = true` for `purchase`, `finance`, `approver`, `admin`, `sharvi_admin`, `customer_admin`.
- (Vendor stays false.)

Edge functions already gate the actual data per user via `approval_matrix_approvers`, so showing the pages to these roles is safe — non-approvers just see an empty list.

### 2. Hide legacy sidebar items
In `src/components/layout/Sidebar.tsx`, remove the two legacy entries (lines 75–76):
- "SCM Approval" → `/purchase/approval`
- "Finance Review" → `/finance/review`

Keep the routes mounted in `App.tsx` so any deep links still work, but they no longer clutter the sidebar.

### 3. No backend changes
- `route-vendor-approval` already supports L2…Ln SCM Managers in order before SCM Head.
- `process-approval-action` already advances to the next pending level only after the current one is approved.
- "Previous approver hasn't approved yet" disabled-button + message already implemented in `StageApprovalView`.

## Verification

1. Reload the app → sidebar shows: SCM Manager Approval, SCM Head Approval, Finance 1 Approval, Finance 2 Approval, CEO Office Approval (legacy "SCM Approval" / "Finance Review" gone).
2. Configure 3 SCM Manager levels (L2, L3, L4) in Approval Matrix. Submit a vendor → only the L2 approver sees it on SCM Manager page; SCM Head page shows it as blocked. After L2 approves, L3 sees it; after L3, L4; after L4, vendor moves to SCM Head.
3. SCM Head, Finance 1, Finance 2, CEO Office continue to be single-approver pages.
