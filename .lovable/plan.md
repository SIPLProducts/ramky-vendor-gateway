# Plan: Reliable approval routing + per-stage dynamic levels

## Problem
1. Submitted vendor `1c30eb36…` shows `status = scm_manager_review` but `vendor_approval_progress` has 0 rows. The matrix is configured, but `route-vendor-approval` is invoked from the browser after submit — if the call fails, errors out, or the user closes the tab too early, the vendor is orphaned and approvers see "No pending approvals".
2. The matrix UI today only allows multiple levels for `SCM_MANAGER`. `SCM_HEAD`, `FINANCE_1`, `FINANCE_2`, `CEO_OFFICE` are hard-locked to a single approver row. The buyer wants every stage tab to maintain its own independent `L1..Ln` chain.

## Part A — Make seeding authoritative (server-side)

### 1. New `SECURITY DEFINER` function `seed_vendor_approval_progress(_vendor_id uuid)`
- Reads the vendor's tenant + `is_msme_registered`.
- Reads all active `approval_matrix_levels` for the tenant.
- Filters out rows with `requires_msme = true` when vendor is non-MSME.
- Sorts by canonical stage order (`SCM_MANAGER → SCM_HEAD → FINANCE_1 → FINANCE_2 → CEO_OFFICE`) then by `level_number` (so each stage's L1, L2, L3, … are kept in order).
- Deletes existing `vendor_approval_progress` for the vendor (clean re-seed).
- Inserts one row per eligible level with sequential `level_number` 1..N and `status = 'pending'`.
- Updates `vendors.status` to the review status of the first eligible stage.

### 2. AFTER UPDATE trigger on `vendors`
- Fires when `status` transitions into any of `scm_manager_review | scm_head_review | finance_1_review | finance_2_review | ceo_office_review` AND there is no existing `vendor_approval_progress` row for the vendor.
- Calls `seed_vendor_approval_progress(NEW.id)`.
- Result: even if the client never invokes the edge function, submission alone seeds the chain.

### 3. Keep `route-vendor-approval` edge function as the explicit "re-route" entry point
- Rewrite its body to simply call `seed_vendor_approval_progress` via RPC (single source of truth).
- Used by an admin "Re-route approval chain" button when matrix changes after a vendor was already routed.

### 4. Backfill orphan
- One-off insert: call `seed_vendor_approval_progress('1c30eb36-…')` so the vendor enters the chain immediately.

### 5. Surface failures clearly
- In `useVendorRegistration.tsx`, after submit + routing call: query `vendor_approval_progress` count for the new vendor. If 0, write an `audit_logs` row with `action = 'approval_routing_failed'` and show a toast to the admin instead of silently succeeding.

## Part B — Per-stage dynamic levels in the matrix UI

### 6. Schema — no change required
`approval_matrix_levels` already has `(stage, level_number)`. The only constraint blocking multi-level on other stages is in the UI / routing logic, not the DB.

### 7. `route-vendor-approval` ordering update
- Already sorts by `(STAGE_ORDER, level_number)`. Confirm the same is true inside `seed_vendor_approval_progress` so e.g. `SCM_HEAD L1 → SCM_HEAD L2 → FINANCE_1 L1 → FINANCE_1 L2 → …` chain is built correctly.

### 8. `process-approval-action` already advances based on `min(level_number) where status='pending'` after each approval — no change needed; it works for any chain length.

### 9. `ApprovalMatrixConfig.tsx`
- Remove the `SINGLE_APPROVER_STAGES` restriction. Every stage tab now supports an "Add Level" button that appends `L(max+1)` rows.
- Per-stage level number is **independent** (each stage starts at L1) — store `level_number` per `(stage, level)` group, not globally.
- Persist plan: for each stage, iterate its levels in order and write one `approval_matrix_levels` row per (stage, level_number) with the configured approvers underneath.
- Validation: each level requires ≥1 approver; emails unique within a level; level numbers are 1..n contiguous per stage.
- Tabs remain: SCM Manager · SCM Head · Finance 1 · Finance 2 · CEO Office. Each tab shows its own level accordion / sub-tabs.

### 10. `process-approval-action` `STAGE_TO_REVIEW` mapping already covers all five stages — no change.

### 11. Stage-pending-approvals (`list-pending-approvals-by-stage`)
- Already groups by `stage` only and lists every pending progress row for that stage matched to the current approver. With multi-level per stage, approvers added at any level will see only the vendors whose current pending level belongs to their `level_id`. Existing query already correct because it filters by `level_id` from the approver's row.

## Out of scope
- Email/dialog rebrand (Sharvi → Ramky) — separate plan.
- Changing the canonical stage order itself.
- Per-level MSME flag (currently only CEO_OFFICE uses `requires_msme`).

## Files / migrations

**Migration** (Part A):
- `seed_vendor_approval_progress(uuid)` function
- `vendors_status_seed_approval` trigger AFTER UPDATE
- Backfill call for orphaned vendor

**Edge functions:**
- `supabase/functions/route-vendor-approval/index.ts` — thin wrapper around the new RPC

**Frontend:**
- `src/components/admin/ApprovalMatrixConfig.tsx` — drop single-approver restriction; per-stage independent levels; updated save plan
- `src/hooks/useVendorRegistration.tsx` — post-submit verification + `approval_routing_failed` audit log
- (Optional) `src/pages/VendorList.tsx` — "Re-route approval chain" admin action

## Verification
1. Submit a vendor where matrix has SCM_MANAGER L1+L2, SCM_HEAD L1+L2, FINANCE_1 L1, FINANCE_2 L1, CEO_OFFICE L1 (MSME=Yes): `vendor_approval_progress` has 7 rows, ordered correctly; vendor.status = `scm_manager_review`.
2. Submit a non-MSME vendor: CEO_OFFICE row excluded.
3. Manually delete approval progress and toggle vendor status — trigger reseeds.
4. Configure SCM_HEAD with L1+L2 in the admin UI, save, reload — both rows persisted.
5. Approving SCM_HEAD L1 leaves vendor at SCM_HEAD L2; approving L2 advances to FINANCE_1.
6. Existing orphan `1c30eb36…` is seeded after backfill and appears in the SCM Manager L1 approver's queue.
