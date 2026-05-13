## Problem

When an admin adds a new email under **Approvers by Stage**, that person logs in but their Approval inbox is empty.

Root cause: in `list-pending-approvals-by-stage` we use a PostgREST `.or()` filter:

```ts
.or(`user_id.eq.${auth.userId},approver_email.ilike.${email}`)
```

Three fragile things happen here:

1. `approver_email` is saved with `user_id = null` (see `ApprovalMatrixConfig.tsx` line 352), so the lookup depends entirely on the email leg of the `.or()`.
2. PostgREST `.or()` parses the value string and certain emails (dots, plus-aliases, percent signs, commas if present) can silently fail the filter. The match also goes through `ilike` without wildcards, which is slower and easier to mis-build.
3. The new user logs in with the SAME email that was typed in the matrix, but if the admin saved the matrix with even a stray space or different casing in the row that's still on screen (vs what's persisted), there's no second chance to match by `user_id`.

The flow is already dynamic — no hardcoded roles or emails exist. The fix is making the email match bullet-proof and stitching `user_id` in once we know who the email belongs to.

## Plan

### 1. Replace fragile `.or()` with two clean queries (server-side)

In `supabase/functions/list-pending-approvals-by-stage/index.ts`:

- Drop the `.or()` filter entirely.
- Query 1: `approval_matrix_approvers` where `user_id = auth.userId`.
- Query 2: `approval_matrix_approvers` where `lower(approver_email) = lower(auth.email)` using `.eq('approver_email', email)` after normalizing to lowercase (the matrix already saves lowercase at line 354 of `ApprovalMatrixConfig.tsx`).
- Merge the two row sets and dedupe by `level_id`.

Apply the same two-query pattern in `supabase/functions/process-approval-action/index.ts` for consistency (it already does both checks in JS — keep that, just normalize email comparison with `trim().toLowerCase()` on both sides).

### 2. Auto-link `user_id` when an email matches an existing auth user

Add a tiny helper in `list-pending-approvals-by-stage` and `process-approval-action`: when we find approver rows by email and `user_id IS NULL`, write `user_id = auth.userId` back to those rows (service-role update). This makes future lookups exact and lets us drop the email leg over time.

No schema change needed.

### 3. Add a one-shot "Re-link approvers" button (optional but cheap)

In `ApprovalMatrixConfig.tsx`, next to **Save All**, add a **Resolve Users** button that, for every approver row with `user_id IS NULL`, looks up `profiles` by email and patches `user_id`. Pure UI + one bulk update; no migration.

### 4. Keep nothing else hardcoded

Confirm — no other code change required:

- Stages, level numbers, modes, MSME-only flag → all read live from `approval_matrix_levels`.
- Approver identity → resolved live from `approval_matrix_approvers` on every request.
- Stage → vendor.status mapping is a small literal `Record` inside the edge function (`SCM_MANAGER → scm_manager_review`, etc.) and is keyed by the stage value stored on the level row, so reassigning who acts at a stage requires zero code change.
- Sidebar/page access uses `role_screen_permissions` + `custom_role_screen_permissions`, both DB-driven.

## Files touched

- `supabase/functions/list-pending-approvals-by-stage/index.ts` — replace `.or()` with two queries + merge; auto-link `user_id`.
- `supabase/functions/process-approval-action/index.ts` — normalize email comparison; auto-link `user_id`.
- `src/components/admin/ApprovalMatrixConfig.tsx` — add **Resolve Users** action that backfills `user_id` from `profiles` by email.

No DB migration. No changes to the routing logic, stages, or RLS policies.

## How to verify after build

1. Add a brand-new email in **Approvers by Stage**, save.
2. Sign in as that email.
3. Open the matching Approval page — pending vendors should now appear.
4. Reassign the same level to a different email, save. Sign in as the old email — inbox empty. Sign in as the new email — pending vendors visible. No deploy or code change required.
