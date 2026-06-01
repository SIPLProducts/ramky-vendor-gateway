## Problem

After submission, the **Application Progress** tracker on the Success Screen does not reflect the real-time approval stage. The active step does not blink/say "In Progress" for the current approver, and earlier stages do not flip to "Completed" as approvers act.

Root causes:

1. The tracker only looks at `vendors.status` (a single enum). When the matrix has more than two approval levels (SCM Manager → SCM Head → Finance 1 → Finance 2 → CEO), advancing through them is reflected only by the next stage's `*_review` value — but skipped/optional stages, custom matrices, or out-of-order statuses break the 1:1 mapping.
2. There is **no realtime subscription on `vendor_approval_progress`**. Even when the buyer-side approvers act, the vendor's tracker doesn't refresh — only `vendors.status` changes trigger refresh, and only if the vendor row is updated.
3. The "Document Verification" step is rendered as `active` whenever status is `submitted` / `validation_pending`, and stays active even after the chain moves into SCM Manager review on tenants where validation is auto-skipped.

## Fix

Make the tracker compute step state from the **actual approval chain**, not just one enum.

### 1. Tracker becomes data-driven

Update `RegistrationStatusTracker` to accept an optional `approvalProgress` prop:

```ts
type ApprovalProgressRow = {
  stage: 'SCM_MANAGER' | 'SCM_HEAD' | 'FINANCE_1' | 'FINANCE_2' | 'CEO_OFFICE';
  status: 'pending' | 'approved' | 'rejected';
  level_number: number;
};
```

When `approvalProgress` is provided, compute step state per approver step:
- approved row → `completed`
- earliest pending row → `active` ("In Progress" + pulse)
- later pending rows → `pending`
- rejected row → `failed`

Fallback to the existing `status`-enum logic only when `approvalProgress` is empty (e.g., draft/submitted phase).

Also stop forcing Doc Verification to `active` once any approval row exists (i.e., chain has been seeded → validation is done → mark Doc Verification `completed`).

### 2. Subscribe to the live approval chain

In `SuccessScreen` (or a new `useVendorApprovalChain(vendorId)` hook):

- Initial fetch:
  ```sql
  select id, level_id, level_number, status,
         approval_matrix_levels!inner(stage)
  from vendor_approval_progress
  where vendor_id = :vendorId
  order by level_number;
  ```
- Realtime channel on `vendor_approval_progress` filtered by `vendor_id=eq.<id>` for `INSERT | UPDATE | DELETE` → refetch on any change.
- Also keep the existing `vendors` row subscription for `status` (covers SAP sync, returned_to_buyer/vendor).

The hook returns `{ rows, loading }` which `SuccessScreen` passes into `<RegistrationStatusTracker status={status} approvalProgress={rows} />`.

### 3. RLS

`vendor_approval_progress` must be readable by the vendor that owns the row. If a SELECT policy for `auth.uid() = vendors.created_by` (joined via `vendor_id`) is missing, add a migration:

```sql
create policy "Vendor reads own approval chain"
on public.vendor_approval_progress
for select
to authenticated
using (
  exists (
    select 1 from public.vendors v
    where v.id = vendor_approval_progress.vendor_id
      and v.created_by = auth.uid()
  )
);
```

(Verify against existing policies before adding; only create if missing.)

### 4. Files touched

- `src/components/vendor/RegistrationStatusTracker.tsx` — accept `approvalProgress`, compute step state per row, fix Doc Verification completion.
- `src/components/vendor/SuccessScreen.tsx` — use new hook, pass chain to tracker.
- `src/hooks/useVendorApprovalChain.tsx` (new) — fetch + realtime subscription on `vendor_approval_progress`.
- (Conditional) new migration to allow vendor SELECT on `vendor_approval_progress`.

### 5. Validation

- Submit a fresh vendor → tracker shows Submitted ✓ Completed, Doc Verification ✓ Completed, SCM Manager pulsing "In Progress".
- SCM Manager approves → SCM Manager flips to Completed, SCM Head pulses.
- Continue through Finance 1, Finance 2, CEO — only the current approver pulses.
- Final approval → all approver steps Completed, SAP Sync pulses, then Completed on sync.
- Reject at any stage → that step shows Action required; earlier steps stay Completed.

No business logic changes — purely presentation + realtime hook.
