# Reverse Rejection Workflow

Today a rejection at any stage sets the vendor to a terminal `*_rejected` status and stops the chain. We will change rejection to step **one stage back** along the existing approval chain, carry the rejection remarks, and let the buyer/vendor act on it without losing data.

## Behavior

Rejection direction along the chain:
- Finance 2 reject → Finance 1
- Finance 1 reject → SCM Head
- SCM Head → SCM Manager
- SCM Manager → Buyer (the inviting buyer)
- Buyer (after review) → Vendor (with remarks) for edit + resubmit
- CEO Office reject → previous stage in that vendor's chain (Finance 2 or whichever was just before)

At every step the **rejection remarks are stored** on the progress row and surfaced in the next approver's / buyer's / vendor's UI.

## Backend changes

### 1. `supabase/functions/process-approval-action/index.ts` (reject branch)
Replace the current "set vendor to *_rejected and stop" logic with:

1. Mark current `vendor_approval_progress` row: `status='rejected'`, `acted_by`, `acted_at`, `comments` (already done).
2. Find the **immediate previous level** for this vendor: the row in `vendor_approval_progress` with the largest `level_number < current.level_number`.
3. If a previous level exists:
   - Reopen it: set that row to `status='pending'`, clear `acted_by`/`acted_at`, store `comments` of the rejecter into a new column (see migration) so the previous approver sees *why* it came back.
   - Reset the current row's downstream rows (anything with `level_number > current`) that were already approved? They stay as-is for history but become irrelevant; we leave them.
   - Update `vendors.status` to the review status of the previous stage (`scm_manager_review`, `scm_head_review`, `finance_1_review`, `finance_2_review`).
4. If no previous level exists (current is the first stage, e.g. SCM Manager rejecting):
   - Set vendor status to a new value `returned_to_buyer`.
   - Store rejection remarks on vendor (`last_rejection_comments`, `last_rejection_stage`, `last_rejected_by`).
5. Insert an `audit_logs` entry describing the reverse step.

### 2. Migration
- Add `rejection_comments TEXT` and `rejection_from_level_id UUID` to `vendor_approval_progress` (carry remarks when row is reopened).
- Add `last_rejection_comments TEXT`, `last_rejection_stage TEXT`, `last_rejected_at TIMESTAMPTZ` to `vendors`.
- Extend `vendor_status` enum with `returned_to_buyer` and `returned_to_vendor`.
- Update `EDITABLE_STATUSES` server-side checks accordingly.

### 3. New edge function `buyer-return-to-vendor`
Called from the Buyer's "Return to Vendor" action:
- Validates the caller is the inviting buyer (or has buyer role on this vendor).
- Sets `vendors.status = 'returned_to_vendor'`, copies remarks into `last_rejection_comments`.
- Sends an email to the vendor via existing Resend setup (`send-status-notification` style) including the remarks.
- Logs `audit_logs`.

### 4. Resubmission
When the vendor saves & submits an application that is currently `returned_to_vendor`:
- All previously entered data and uploads are already preserved (we never delete on rejection).
- On submit, reset `vendors.status` to the first stage status (`scm_manager_review` or first eligible per matrix). Reset all `vendor_approval_progress` rows to `pending` *in order*, OR keep approved upstream rows and only reopen from the originally rejected stage — we will reopen from the **first** stage so the full chain re-runs with the corrected data (clearer audit story; can be flipped later if needed).

## Frontend changes

### Approver UI (`StageApprovalView`)
- When an item arrives because a downstream stage rejected it back, show a yellow banner: "Returned by {stage} — {rejecter name}: {comments}" using new fields on the item from `list-pending-approvals-by-stage`.

### `list-pending-approvals-by-stage` edge function
- Include `rejection_comments`, `rejection_from_stage`, `rejected_by` in returned items so the banner can render.

### Buyer view
- New "Returned vendors" section (or new status filter on the existing buyer dashboard / vendor list) showing vendors with status `returned_to_buyer`.
- Row action: **View remarks** + **Return to Vendor** (calls `buyer-return-to-vendor`) with optional additional message.

### Vendor side (`VendorRegistration.tsx` + `useVendorRegistration.tsx`)
- Add `returned_to_vendor` to `EDITABLE_STATUSES`.
- On load, if status is `returned_to_vendor`, show a prominent banner with `last_rejection_comments` + stage name and which fields/documents the reviewer flagged (free-text remarks for v1).
- Submit button label changes to "Resubmit application" and POSTs to existing submit path; backend resets approval chain as described.

### Vendor notification email
- Reuse `send-status-notification` (or `send-smtp-email`) to email the vendor when buyer returns the application, including remarks.

## Out of scope (v1)
- Per-field "what to fix" markup — remarks are free-text only.
- Partial chain re-run (we restart approvals from stage 1 after vendor resubmit for a clean audit).

## Technical summary
Files touched:
- `supabase/functions/process-approval-action/index.ts` — rewrite reject branch.
- `supabase/functions/list-pending-approvals-by-stage/index.ts` — expose new rejection metadata.
- `supabase/functions/buyer-return-to-vendor/index.ts` — new.
- `supabase/functions/send-status-notification/index.ts` — handle `returned_to_vendor`.
- New migration: enum values + columns on `vendor_approval_progress` and `vendors`.
- `src/components/approvals/StageApprovalView.tsx` — returned-from-downstream banner.
- `src/hooks/usePendingApprovalsByStage.tsx` — pass through new fields.
- New buyer screen action: `src/pages/VendorList.tsx` (or buyer dashboard) — Return to Vendor button + remarks dialog.
- `src/hooks/useVendorRegistration.tsx`, `src/pages/VendorRegistration.tsx` — allow editing in `returned_to_vendor`, show remarks banner, resubmit flow.
