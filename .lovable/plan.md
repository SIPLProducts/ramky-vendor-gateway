## Goal

Insert **Buyer Approval** as the first stage of every vendor approval chain. After the vendor submits the form, the inviting buyer must verify and approve. Only after the buyer approves does the application move on to SCM Manager (or the next configured stage). Buyer rejection sends the application back to the vendor.

## Behavior

1. Vendor submits → status becomes `buyer_review` (new) instead of jumping straight to SCM Manager / Document Verification.
2. The **inviting buyer** (`vendor_invitations.created_by`) sees the vendor in a new "Buyer Approval" inbox and opens the standard StageApprovalView to verify details/documents.
3. On **Approve** → status advances to the next configured stage (SCM Manager, or whichever stage is first per existing matrix logic).
4. On **Reject** → status becomes `returned_to_vendor` with buyer remarks (mirrors today's `buyer-return-to-vendor` flow); vendor edits and resubmits.
5. A new `buyer_scm_mappings.skip_buyer_stage` flag lets admins bypass the buyer stage per buyer (default `false` = always require buyer approval).
6. Status tracker shows a new **Buyer Approval** node between Document Verification and SCM Manager.

## Changes

### Database (migration)

- Add `'BUYER'` to the `approval_matrix_levels.stage` CHECK constraint so the stage column accepts it (used only conceptually by the tracker; we don't create matrix rows for it).
- Add column `buyer_scm_mappings.skip_buyer_stage boolean NOT NULL DEFAULT false`.
- Add enum value `'buyer_review'` to `vendor_status` (and `'buyer_rejected'` is **not** needed — reject path reuses `returned_to_vendor`).
- Update `seed_vendor_approval_progress(_vendor_id)`:
  - Resolve `v_buyer` (inviting buyer) and a new `v_skip_buyer` flag from `buyer_scm_mappings.skip_buyer_stage`.
  - When `v_buyer` is set AND NOT `v_skip_buyer`: **insert a synthetic level-1 row** in `vendor_approval_progress` with `level_id = NULL`, `stage = 'BUYER'`, `status = 'pending'`. Renumber subsequent matrix levels starting at 2.
  - Set `vendors.status = 'buyer_review'` when the first row is the buyer row; otherwise keep current behavior.
- Allow `vendor_approval_progress.level_id` to be NULL (already nullable? confirm; if not, drop NOT NULL). Add a `stage` text column to `vendor_approval_progress` so synthetic buyer rows carry their stage without joining `approval_matrix_levels`.
- Update `trg_vendors_seed_approval` status check to include `'buyer_review'`.

### Edge function `process-approval-action`

- When the current pending row has `stage = 'BUYER'` (or `level_id IS NULL`):
  - Authorise approver = inviting buyer of this vendor (lookup `vendor_invitations.created_by`) instead of `approval_matrix_approvers`.
  - On **approve**: mark row approved, then advance to the next pending row using existing logic (sets `vendors.status` to the next stage's review status).
  - On **reject**: mark row rejected, set `vendors.status = 'returned_to_vendor'`, store remarks on `vendors.last_rejection_*`, audit log, and trigger `send-status-notification` to the vendor (reuse `buyer-return-to-vendor` logic inline).
- Update `STAGE_TO_REVIEW` to include `BUYER: 'buyer_review'`.
- Auto-extend block: keep buyer row out of the "matrix-grown" recompute (synthetic rows have no level_id).

### Edge function `list-pending-approvals-by-stage`

- Accept `stage = 'BUYER'`. For BUYER stage: return pending rows where the caller's `userId` matches `vendor_invitations.created_by` for that vendor.
- Existing `blockedByPrevious` logic stays — buyer row is always `level_number = 1` so never blocked.

### Frontend

- **New page** `src/pages/approvals/BuyerApproval.tsx` cloned from `ScmManagerApproval.tsx`, passing `stage="BUYER"` and label "Buyer Approval".
- **App route** `/approvals/buyer` registered in `src/App.tsx`.
- **Sidebar** (`src/components/layout/Sidebar.tsx`) and any approver nav: add "Buyer Approval" item visible to any user who has at least one vendor where they're `vendor_invitations.created_by` (or just gate by `purchase` / `customer_admin` roles, matching how SCM Manager is gated today — confirm during implementation).
- **`usePendingApprovalsByStage` / `useVendorApprovalChain`**: widen `ApprovalStage` type to include `'BUYER'`.
- **`RegistrationStatusTracker.tsx`**:
  - Insert a new step `{ id: 'buyer', label: 'Buyer Approval', icon: <UserCheck /> }` after `verification` and before `scm_manager`. Shift `STAGE_TO_STEP` indexes for SCM_MANAGER → 3, SCM_HEAD → 4, FINANCE_1 → 5, FINANCE_2/CEO_OFFICE → 6, SAP → 7. Add `STAGE_TO_STEP.BUYER = 2`.
  - Extend `getActiveStepIndex` to map `'buyer_review'` → 2.
  - Add `'buyer_review'` to `FAILED_STEP` mapping where appropriate (no — buyer reject = returned_to_vendor; existing mapping `returned_to_vendor → 0` keeps the tracker showing the vendor as the action owner).
- **Status badges / labels**: extend any `STATUS_LABELS` maps (e.g. `src/pages/VendorList.tsx`, `AdminInvitations.tsx`) with `buyer_review: 'Buyer Review'`.
- **`SubmissionSuccessDialog`**: copy update so vendors see "Your application has been sent to the buyer for verification" when buyer stage is active.

### Admin UI

- **`BuyerScmMapping.tsx`**: add a "Skip buyer approval" switch per row, bound to the new `skip_buyer_stage` column.
- **`ApprovalMatrixConfig.tsx`**: no change — Buyer is not a configurable matrix stage; show a read-only "Buyer Approval" badge at the top of the matrix preview describing that it always runs first unless skipped per buyer.

## Non-changes

- OCR / DMS / SAP sync logic unchanged.
- Existing SCM/Finance/CEO stages, their RLS, and `approval_matrix_*` rows stay intact; buyer stage is layered in front of them.
- `buyer-return-to-vendor` edge function stays for the legacy "return after any rejection" use case.

## Technical notes

```text
Submitted vendor
     │
     ▼
buyer_review  ──(buyer rejects)──►  returned_to_vendor ──► vendor edits & resubmits
     │
  (buyer approves)
     │
     ▼
scm_manager_review (or next configured stage) → SCM Head → Finance 1 → Finance 2 → SAP Sync
```

`vendor_approval_progress` row shapes:

```text
buyer row : { level_id: NULL, stage: 'BUYER',       level_number: 1, status: pending }
matrix    : { level_id: <uuid>, stage: 'SCM_MANAGER', level_number: 2, status: pending }
...
```

## Validation

1. Buyer sends invitation → vendor submits → vendor status = `buyer_review`; tracker shows Buyer Approval as active.
2. Buyer logs in → sees vendor in `/approvals/buyer` → approves → status moves to `scm_manager_review` (or next stage); SCM Manager inbox shows it.
3. Buyer rejects with comment → vendor status = `returned_to_vendor`; vendor receives email; tracker shows "Action required".
4. Vendor edits and resubmits → buyer sees it again (chain reseeded).
5. Admin toggles `skip_buyer_stage` for a buyer → new submissions from that buyer's vendors skip buyer stage and go straight to SCM Manager.
6. Regression: existing rejection flow at SCM/Finance still returns to previous stage; SAP sync still fires after final approval.
