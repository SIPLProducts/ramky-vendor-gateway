

## Fix "Cannot coerce the result to a single JSON object" on SCM Approve

### What's actually happening

The Approve button on the SCM Approval page calls `usePurchaseAction`, which directly does:

```ts
supabase.from('vendors').update({ status: 'purchase_approved', ... })
  .eq('id', vendorId).select().single();
```

Two problems:

1. **Wrong status jump.** It sets the vendor to `purchase_approved` (SAP-ready) and skips `finance_review` and the entire SCM matrix (Brijesh L2 → soumendukumar L1). That's why the vendor never actually moved through your matrix.
2. **The error you saw.** Because of RLS, the logged-in user can update the row but cannot SELECT it back, so `.select().single()` returns 0 rows and PostgREST throws **"Cannot coerce the result to a single JSON object"**. That is the red toast in your screenshot.

The correct path already exists: the `process-approval-action` edge function records an approval at the active SCM matrix level for the current user, and only after **level 1** is approved does it flip the vendor to `finance_review`. Finance then moves it to `purchase_approved`.

### Fix

#### 1) Route SCM page approvals through the matrix, not direct status updates

In `src/pages/PurchaseApproval.tsx` and `src/hooks/useVendors.tsx`:

- Replace the `usePurchaseAction` call from the SCM Approval card buttons.
- For the logged-in user, find their **active pending progress row** for that vendor:
  - lowest-numbered pending row in `vendor_approval_progress` for `vendor_id`
  - whose `level_id` is among the levels assigned to the current user (matched by `user_id` OR by `approver_email = auth user email`, case-insensitive)
- If a matching progress row exists, invoke the existing `process-approval-action` edge function with `{ progress_id, action, comments }`.
- If no matching row exists (the user is not the current approver — e.g., Brijesh trying to approve while Soumendukumar's L1 is the active one, or an admin viewing the page), disable the inline Approve / Reject buttons and show a tooltip: "Only the active SCM approver can act. Use the My Approvals page."

#### 2) Stop the direct vendor status update from this page

- `usePurchaseAction` keeps existing for backward compatibility but is no longer called from `PurchaseApproval.tsx`.
- Remove the `.select().single()` chain from any place we still need to update the vendor row, or switch to `.maybeSingle()` so RLS-blocked reads no longer crash.

#### 3) Show whose turn it is

In each card's badge area on `PurchaseApproval.tsx`:

- Use `progressByVendor` already loaded.
- Show the active level's approver name(s) (resolved from `approval_matrix_approvers` for that level): "Pending L1 — soumendukumar".
- Keep the existing dynamic SCM badge for higher-level progress.

#### 4) Acceptance checks

1. Logged in as **Brijesh** (L2), open SCM Approval. The pending RIL vendor card shows "Pending L2 — Brijesh kabra". Approve works without error. Vendor stays in `purchase_review`, progress L2 = approved, L1 = pending.
2. Logged in as **soumendukumar** (L1), the same card now shows "Pending L1 — soumendukumar". Approve works. Vendor moves to `finance_review` and disappears from SCM Approval.
3. Logged in as an admin who is NOT in the matrix: Approve / Reject buttons are disabled with a clear tooltip.
4. No vendor jumps directly to `purchase_approved` from the SCM page anymore. That status only comes from Finance Review.
5. The "Cannot coerce the result to a single JSON object" toast is gone.

### Files to update

- `src/pages/PurchaseApproval.tsx` — wire Approve/Reject to `process-approval-action` for the active progress row; disable buttons when the user isn't the active approver; show approver name in badge.
- `src/hooks/useVendors.tsx` — add a small helper hook (e.g. `useScmMatrixAction`) that resolves the current user's active progress row for a vendor and invokes the edge function. Leave `usePurchaseAction` in place but unused on this page; if kept, switch its `.single()` to `.maybeSingle()` to prevent the coerce error elsewhere.

### Out of scope

- No DB schema or RLS changes (RLS already supports email-based approvers after the last migration).
- No edge function changes — `process-approval-action` already handles user_id and email matching, and already promotes to `finance_review` only after L1.
- No change to Finance Review or SAP Sync flows.

