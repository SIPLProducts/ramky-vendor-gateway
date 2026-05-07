## Problem

When the approval matrix has SCM Manager at L2 and SCM Head at L1 (matrix level numbers), the SCM Head currently sees vendors as actionable even though SCM Manager hasn't approved yet (see screenshot — 3 vendors pending for SCM Head). The Approve/Reject buttons should be disabled and a message shown until the prior approver acts.

## Root Cause

Two issues:

1. **Stale data ordering for older vendors.** The router `route-vendor-approval` now renumbers eligible levels in canonical order (SCM_MANAGER → SCM_HEAD → Finance 1 → Finance 2 → CEO Office). New vendor `e159c529…` is correctly ordered (SCM_MANAGER level_number=1, SCM_HEAD=2). But the older vendors `6d652397…` and `a0a0b224…` were routed with the legacy logic where SCM_HEAD got level_number=1 and SCM_MANAGER got level_number=2 — so the SCM Head sees them as the active step.

2. **No client-side safeguard.** `usePendingApprovalsByStage` selects the active level as the lowest pending level_number; if the data ordering is wrong, the wrong stage becomes "active" with full Approve/Reject buttons. There is no defensive gating in `StageApprovalView`.

## Plan

### 1. Backfill stale progress rows

For the two stuck vendors (`6d652397-9400-4efb-9045-d57fae133518` and `a0a0b224-d741-4911-8b89-ee36e5e0003b`), invoke the already-fixed `route-vendor-approval` edge function. It deletes existing progress rows and re-inserts them in canonical order (SCM_MANAGER first, then SCM_HEAD). After the backfill, SCM Head's queue will be empty until SCM Manager approves.

### 2. Add defensive gating in the approver UI

Even with correct data, add a safety net so a misordered matrix never lets a later approver act prematurely.

- **`src/hooks/usePendingApprovalsByStage.tsx`** — return one extra field per item, `blockedByPrevious: boolean`, computed by checking if any lower-numbered progress row for the same vendor is still `pending` or `rejected`. Continue to include the item in the list (don't filter it out) so the SCM Head can see what's coming.

- **`src/components/approvals/StageApprovalView.tsx`**:
  - When `blockedByPrevious` is true:
    - Disable both **Approve** and **Reject** buttons
    - Show an inline alert under the row (or in the action column) with the text: **"The previous approver has not approved yet."**
    - Keep **View** enabled so the approver can still inspect the vendor and documents
  - When false, behave exactly as today.

### 3. Verify in DB after backfill

Re-query `vendor_approval_progress` to confirm SCM_MANAGER rows have `level_number = 1` and SCM_HEAD rows have `level_number = 2` for both backfilled vendors. Confirm the SCM Head queue is empty.

## Technical Details

- The hook already fetches all progress rows per vendor (`allProgress`), so adding `blockedByPrevious` is a one-line derivation: `blockedByPrevious = some progress row with level_number < this.level_number AND status !== 'approved'`.
- No schema changes, no edge function changes, no migration required.
- The approval router already produces correct ordering for newly submitted vendors — no further fix needed there.
