Done — all SCM Manager labels are now SCM CO.

What changed:
- Renamed the custom role in the database from "SCM Manager" to "SCM CO".
- Recreated RLS policies to reference the new role name.
- Updated all user-facing labels (sidebar, approvals page, status badges, filters, admin screens, reports, emails, landing page).
- Updated role-matching code in `useTenantContext`, `BuyerScmMapping`, and `ApprovalMatrixConfig` so the renamed role is still recognized.
- Deployed the updated edge functions.
- Build and type check pass.

Verification:
- Sidebar now shows "SCM CO" instead of "SCM Manager Approval".
- The SCM approval page heading is "SCM CO".
- No remaining "SCM Manager" text in active frontend or edge-function code. Internal identifiers like `SCM_MANAGER`, `scm_manager_review`, and `scm_manager_user_id` were intentionally left unchanged.