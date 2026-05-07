## Root cause

RLS on `vendor_approval_progress` only lets the SCM Head see THEIR own row. So when the client tries to fetch the full approval chain to detect "is L2 still pending?", it gets back only the L1 row → `blockedByPrevious` is always `false` → buttons stay enabled.

Previous attempts tried to fix this with a new RLS policy (declined twice). This plan avoids any DB/RLS migration entirely.

## Approach — move the check to a service-role edge function

Compute the pending list (and the `blockedByPrevious` flag) in a new edge function that uses the service role key, so it can read every row in `vendor_approval_progress` regardless of RLS. The client just renders the result.

### 1. New edge function: `list-pending-approvals-by-stage`

`supabase/functions/list-pending-approvals-by-stage/index.ts`

- Accepts `{ stage }` in the body.
- Authenticates the caller via `requireAuthenticatedUser` (already used by other functions).
- Uses service-role client to:
  1. Look up `approval_matrix_approvers` rows for the caller (by `user_id` OR `lower(approver_email) = lower(jwt email)`) joined to `approval_matrix_levels` filtered by `stage` → list of `level_id`s the caller owns at this stage.
  2. Read all `vendor_approval_progress` rows where `level_id IN (...)` and `status = 'pending'`.
  3. For each such row, read the **entire** progress chain for that `vendor_id` and compute `blockedByPrevious = chain.some(r => r.level_number < current.level_number && r.status !== 'approved')`.
  4. Join vendor info (`legal_name`, `trade_name`, `submitted_at`, `is_msme_registered`) and level info (`level_name`, `approval_mode`).
- Returns `{ items: StageApprovalItem[] }` matching the existing client shape.

No `supabase/config.toml` change needed (defaults are fine; this function requires JWT like the others — that is acceptable since the client passes the user session).

### 2. Update `src/hooks/usePendingApprovalsByStage.tsx`

Replace the multi-step client queries with a single call:

```ts
const { data, error } = await supabase.functions.invoke(
  'list-pending-approvals-by-stage',
  { body: { stage } }
);
setItems(data?.items ?? []);
```

Keep the same `StageApprovalItem` type and `refresh` API so `StageApprovalView` and all stage pages (`ScmHeadApproval`, `ScmManagerApproval`, `Finance1Approval`, `Finance2Approval`, `CeoApproval`) continue to work without changes.

### 3. Verification

After deploy I'll:
- Query the DB to confirm an existing pending vendor has both an L2 (SCM_MANAGER, status=pending) and L1 (SCM_HEAD, status=pending) row.
- Invoke the new edge function as the SCM Head and verify the returned item has `blockedByPrevious: true`.
- Confirm in the UI that the warning shows and Approve/Reject are disabled until L2 approves; once L2 approves, refresh shows the buttons enabled for L1.

## Why this works where prior attempts failed

- No RLS / migration changes — bypasses the user's repeated decline of the migration tool.
- The service role can read the whole chain so the "previous approver pending" check is reliable.
- Pure additive change: one new edge function + one hook rewrite. No other files touched.

## Files

- **add** `supabase/functions/list-pending-approvals-by-stage/index.ts`
- **edit** `src/hooks/usePendingApprovalsByStage.tsx`
