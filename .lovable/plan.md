## Diagnosis (verified)

Comments **are** being saved — just not where the dialog reads them.

- Query on `vendor_approval_progress` returns real comments (e.g. `CEO_OFFICE / approved / "hgjkl"`, `FINANCE_1 / "dgfhyjk"`, etc.), written on every approve/reject.
- The `vendor_approval_history` insert is the part that fails (on prod it returns no rows at all — your screenshot shows NULL history for ref `20260730001`). Since the edge functions currently `throw` when that insert fails, it can also break the action itself.

## Plan

1. **ApprovalCommentsDialog reads from `vendor_approval_progress`**
   - Fetch `id, level_number, stage, status, comments, acted_by, acted_at` where `vendor_id = ...` and `comments` is not null.
   - Order **newest first** so the latest comment is always at the top; highlight the top row as "Latest".
   - Also include `vendors.last_rejection_comments` / `last_rejection_stage` / `last_rejected_at` / `last_rejected_by` as a fallback entry when no progress row carries it (covers SAP Team rejections).
   - Keep resolving approver names via `profiles`.
   - Drop all `vendor_approval_history` reads.

2. **Stop history logging from blocking saves**
   - In `process-approval-action`, `sap-team-reject-vendor`, `sap-team-return-to-buyer`, `buyer-reapprove-rejected`: make the `vendor_approval_history` insert best-effort (log a warning) instead of throwing, and guarantee `comments` is always written to `vendor_approval_progress` (and to `vendors.last_rejection_comments` on rejections).
   - For SAP Team actions, ensure the comment is persisted on the vendor row so it can be shown even though there is no progress row.

3. **Immediate refresh after save**
   - After a successful approve/reject in `StageApprovalView`, refresh the list and reopen/refresh the comments source so the newly saved comment shows without a page reload.
   - Show the latest comment inline in the approval row (the existing `rejectionComments` slot is reused / extended to the latest comment of any action).

## Technical notes

- No schema change and no migration needed — `vendor_approval_progress.comments` already exists on dev and prod, so this works on the self-hosted server without a PostgREST cache reload.
- `vendor_approval_history` is left in place but unused by the UI; nothing depends on it after this change.
