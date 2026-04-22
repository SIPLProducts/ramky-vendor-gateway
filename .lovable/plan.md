
## Fix missing approvals — align tenant data, seed progress, and support email-based approvers end to end

### What is happening now

I verified three separate issues causing the approvals not to appear:

1. **The approval matrix is still stored under REEL, not RIL**
   - Current DB rows for Brijesh Kabra and soumendukumar exist only under **REEL**
   - **RIL currently has no approval matrix levels**
   - So RIL vendors cannot be routed into the approval workflow

2. **The RIL vendor in `purchase_review` has no approval progress rows**
   - There is at least one active RIL vendor in `purchase_review`
   - `vendor_approval_progress` is empty for RIL
   - Without seeded progress rows, there is nothing to show in approver inboxes

3. **The app still looks up approvers by `user_id`, but the new matrix saves free-text name/email**
   - `ApprovalMatrixConfig` now saves `approver_name` + `approver_email` with `user_id = null`
   - But both:
     - `src/hooks/useMyApprovals.tsx`
     - `src/hooks/useScreenPermissions.tsx`
     still query `approval_matrix_approvers.eq('user_id', user.id)`
   - The RLS policy on `vendor_approval_progress` also still checks only `a.user_id = auth.uid()`

So the current system is half-migrated: saving works, but visibility and access still depend on the old `user_id` model.

### Fix to implement

#### 1) Move or copy the matrix to RIL in the database
Correct the tenant assignment for the two configured levels so the approval matrix matches the tenant where the vendors live.

Plan:
- Reassign the existing approval matrix levels from **REEL** to **RIL** if REEL should no longer use them
- Keep the approver rows attached to those levels
- Verify RIL now has:
  - Level 1 — Brijesh Kabra
  - Level 2 — soumendukumar

If both tenants should keep the same approvers, duplicate instead of move.

#### 2) Re-seed approval progress for existing RIL vendors already in `purchase_review`
Existing vendors submitted before the matrix was correctly attached to RIL were never routed.

Plan:
- Re-run approval routing for RIL vendors currently in `purchase_review`
- This should insert `vendor_approval_progress` rows for the active levels
- Verify each affected vendor gets pending rows for Level 1 and Level 2

#### 3) Update “My Approvals” lookup to match by email as well as `user_id`
Approvers are now stored as free-text email, so the inbox must resolve assignments using the logged-in user’s email.

Update:
- `src/hooks/useMyApprovals.tsx`
  - fetch approver levels where:
    - `user_id = current user id`, **or**
    - `approver_email = current user email` (case-insensitive)
  - then continue loading active pending progress exactly as now

Result:
- Brijesh and soumendukumar will see approvals even when their matrix rows were saved without `user_id`

#### 4) Update sidebar permission logic for the “My Approvals” menu
The menu entry is currently hidden unless `approval_matrix_approvers.user_id = user.id`.

Update:
- `src/hooks/useScreenPermissions.tsx`
  - grant `my_approvals` when the current user matches an approver row by:
    - `user_id`, or
    - email

Result:
- Email-based approvers will actually see the inbox link in navigation

#### 5) Fix RLS on `vendor_approval_progress` for email-based approvers
Even if the UI asks for progress rows, RLS currently only allows access when `approval_matrix_approvers.user_id = auth.uid()`.

Add a migration to update the SELECT policy:
- Extend “Approvers view their level progress” to allow:
  - `a.user_id = auth.uid()`
  - or `lower(a.approver_email) = lower(auth.jwt() ->> 'email')`

This is the key backend fix that makes email-based approvers able to read their assigned progress rows securely.

#### 6) Keep `process-approval-action` as-is, but validate the whole flow
That function already supports email fallback:
- it checks `user_id`
- or matching `approver_email`

After the earlier fixes, this function should work end to end without logic changes.

### Files / assets to update

#### Code
- `src/hooks/useMyApprovals.tsx`
- `src/hooks/useScreenPermissions.tsx`

#### Database
- data update for `approval_matrix_levels.tenant_id` (REEL → RIL) or copy rows to RIL
- data operation to re-route existing RIL `purchase_review` vendors
- new migration updating RLS policy on `vendor_approval_progress`

### Technical details

```text
Current broken path:
Approval matrix saved as name/email only
  -> user_id stays null
  -> My Approvals queries by user_id only
  -> sidebar permission checks by user_id only
  -> RLS on vendor_approval_progress checks user_id only
  -> approver sees no approvals
```

```text
Fixed path:
Approval matrix row has approver_email
  -> approver logs in with same email
  -> UI resolves assigned levels by email
  -> RLS also allows progress visibility by email
  -> routed vendor has pending progress rows
  -> approval appears in My Approvals
```

### Acceptance checks

1. RIL is the selected tenant for the approval matrix
2. RIL has Level 1 Brijesh + Level 2 soumendukumar in DB
3. Existing RIL vendor(s) in `purchase_review` now have `vendor_approval_progress` rows
4. Logged in as Brijesh:
   - “My Approvals” appears in sidebar
   - pending RIL vendor appears in inbox
5. Logged in as soumendukumar:
   - sees the item only when Level 1 is completed, or according to active-level logic
6. Approve action succeeds through `process-approval-action`
7. Vendor advances to the next stage correctly

### Notes
- The console warning in `ApprovalMatrixConfig` about refs is separate from the missing approvals issue
- No change is needed to the free-text approver input model; the missing piece is finishing the read/access side of that migration
