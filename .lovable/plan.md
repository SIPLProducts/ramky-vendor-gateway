# Plan: Rename SCM Manager → SCM CO across the application

## Goal
Replace every user-facing display of "SCM Manager" with "SCM CO" consistently, including the sidebar, profile menu, approval screens, status badges, admin screens, reports, and email notifications. Also rename the underlying custom role in the database so the profile menu and role-based lookups stay consistent.

## Decisions from clarification
- **Display label**: Replace the entire label with **SCM CO** (e.g., "SCM Manager Approval" → "SCM CO", "SCM Manager Review" → "SCM CO").
- **Database role**: Rename the `custom_roles` row from "SCM Manager" to "SCM CO" and update all code references.
- **Internal identifiers remain unchanged**: URL paths (`/approvals/scm-manager`), screen keys (`scm_manager_approval`), status enums (`scm_manager_review`), and database column names (`scm_manager_user_id`) are not user-facing and will stay the same.

## Changes

### 1. Database migration (new migration)
- Rename the existing custom role in `public.custom_roles`: `UPDATE public.custom_roles SET name = 'SCM CO' WHERE name = 'SCM Manager'`.
- Recreate the RLS policies that currently check `has_custom_role(auth.uid(), 'SCM Manager')` so they use `'SCM CO'` and have policy names matching the new label. This covers policies on `vendors`, `vendor_validations`, `vendor_documents`, `vendor_approval_progress`, `audit_logs`, and `ocr_extractions`.
- Note: `has_custom_role` is case-insensitive, but updating the literal strings keeps the codebase consistent and avoids future confusion.

### 2. Frontend role matching updates
- `src/hooks/useTenantContext.tsx`: Change the `isScmManager` check from `n === 'scm manager'` to `n === 'scm co'` so the role lookup continues to work after the DB rename.
- `src/components/admin/BuyerScmMapping.tsx`: Change `const SCM_ROLE = 'SCM Manager'` to `'SCM CO'` so the Buyer↔SCM mapping still finds the correct role.
- `src/components/admin/ApprovalMatrixConfig.tsx`: Change `roleNames: ['SCM Manager']` to `['SCM CO']` so the approval matrix loads users with the renamed role.

### 3. Frontend display labels
Update the following user-facing strings from "SCM Manager" to "SCM CO" (replacing the entire label as requested):
- `src/components/layout/Sidebar.tsx` — sidebar menu label.
- `src/pages/approvals/ScmManagerApproval.tsx` — page title and subtitle.
- `src/pages/approvals/ScmHeadApproval.tsx` — subtitle reference.
- `src/pages/approvals/BuyerApproval.tsx` — subtitle reference.
- `src/pages/Dashboard.tsx` — status badge label.
- `src/pages/VendorStatus.tsx` — status badge labels.
- `src/pages/VendorList.tsx` — status badge labels and filter dropdown items.
- `src/pages/RolePermissions.tsx` — screen label in permissions matrix.
- `src/pages/Landing.tsx` — feature description text.
- `src/components/admin/VendorStageCell.tsx` — pipeline labels and stage filter labels.
- `src/components/admin/BuyerScmMapping.tsx` — card title, field labels, table headers, placeholder, and toast messages.
- `src/components/admin/ApprovalMatrixConfig.tsx` — stage label and helper text.
- `src/components/vendor/RegistrationStatusTracker.tsx` — step label and description.
- `src/components/vendor/VendorReviewDialog.tsx` — mapped role label.
- `src/lib/reports/loadVendorReport.ts` — stage label in report output.
- Comments/JSDoc in `src/hooks/useTenantContext.tsx`, `src/hooks/useVendors.tsx`, `src/hooks/useVendorRegistration.tsx`, `src/pages/AdminInvitations.tsx`, and `src/lib/approvalLabels.ts` for consistency.

### 4. Backend / edge functions
- `supabase/functions/list-pending-approvals-by-stage/index.ts` — stage label in response.
- `supabase/functions/process-approval-action/index.ts` — stage label used in rejection emails.
- `supabase/functions/sap-team-return-to-buyer/index.ts` — workflow description in the rejection email.

### 5. Documentation (optional)
- `scripts/selfhost/README.md` — update the reference for clarity.

### 6. Verification
After implementation, run a ripgrep search for "SCM Manager" across `src/`, `supabase/functions/`, and `supabase/migrations/` to confirm no remaining user-facing references. Frozen historical migration files will still contain the old string, but no new migration or active code should reference it.

## Out of scope
- Internal enums, URL paths, screen keys, status values, and database column names remain unchanged.
- No new tables or columns are created; only a data update and label changes.
- No changes to the SCM Head, Finance, CEO, or SAP Team labels.
