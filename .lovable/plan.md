## 1. Full approval comment history

### Problem
`vendor_approval_progress` holds ONE row per stage. When a stage is rejected and the buyer re-approves, `buyer-reapprove-rejected` re-seeds the chain (deletes + reinserts rows), so earlier rejection/approval comments on that stage disappear from `ApprovalCommentsDialog`. Result: users only ever see the latest action per stage, not the full trail.

### Fix — append-only history log

**Migration** — new table `public.vendor_approval_history`:
- `id uuid PK`, `vendor_id uuid NOT NULL` (FK vendors, ON DELETE CASCADE)
- `stage text NOT NULL` (BUYER / SCM_MANAGER / SCM_HEAD / FINANCE_1 / FINANCE_2 / CEO_OFFICE / SAP_TEAM)
- `level_number int`
- `action text NOT NULL` — one of `approved`, `rejected`, `returned_to_buyer`, `returned_to_vendor`, `resubmitted`
- `from_stage text` (for return/rejection paths)
- `comments text`
- `acted_by uuid` (nullable — references profiles conceptually)
- `acted_at timestamptz NOT NULL DEFAULT now()`
- `created_at timestamptz NOT NULL DEFAULT now()`

GRANT SELECT/INSERT to `authenticated`, ALL to `service_role`. Enable RLS.
Policies:
- SELECT: `public.user_can_see_vendor(auth.uid(), vendor_id)`
- INSERT: `auth.uid() = acted_by` OR service_role (edge functions use service_role)
- No UPDATE / DELETE policy (append-only). Admin cleanup via service_role only.

Index on `(vendor_id, acted_at)`.

**Edge functions — write history rows (in addition to existing writes)**
- `process-approval-action`: on approve → insert `approved`; on reject → insert `rejected` with `from_stage`.
- `buyer-reapprove-rejected`: BEFORE re-seeding, snapshot any existing rejected/approved rows for that vendor into history (backfill for previous chain); after auto-approving the buyer row, insert `resubmitted` for BUYER.
- `sap-team-return-to-buyer`: insert `returned_to_buyer`.
- `sap-team-reject-vendor`: insert `rejected` (SAP_TEAM).
- Also add a one-time SQL backfill in the migration copying current non-pending `vendor_approval_progress` rows into history (so past comments aren't lost).

**UI — `src/components/sap/ApprovalCommentsDialog.tsx`**
- Query `vendor_approval_history` ordered by `acted_at ASC` instead of `vendor_approval_progress`.
- Columns: Approval Stage, Approver Name, Action (Approved / Rejected / Returned to Buyer / Returned to Vendor / Resubmitted with Badge color), Comments, Date & Time.
- Keep name resolution via `profiles` lookup by `acted_by`.

## 2. Vendor Category & Material Group Proper Case in on-behalf registration form

Verified: `src/components/vendor/steps/OrganizationStep.tsx` renders both fields via `<ClassificationField masterType="material_group_vendor|vendor_category" />`. The previous edit added a Proper Case transform inside `ClassificationField.toOptions`, so the on-behalf registration form already shows `Distributor`, `Manufacturer`, `Import`, `Trader`, etc. No further change needed here.

### Files touched
- New migration for `vendor_approval_history` + backfill
- `supabase/functions/process-approval-action/index.ts`
- `supabase/functions/buyer-reapprove-rejected/index.ts`
- `supabase/functions/sap-team-return-to-buyer/index.ts`
- `supabase/functions/sap-team-reject-vendor/index.ts`
- `src/components/sap/ApprovalCommentsDialog.tsx`