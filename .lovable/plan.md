## Goal

When any approver (SCM Manager, SCM Head, Finance 1/2, CEO Office, Buyer) rejects an application, the vendor should be sent back to the **inviting Buyer**. The Buyer then resends the link to the vendor (existing "Return to Vendor" action), the vendor edits and resubmits with all prior data and documents intact, and the approval workflow restarts **from the first stage**.

## Current behavior

1. **`process-approval-action`** (reject branch): if the rejecter is not the Buyer, the function reopens the **immediate previous level** in the chain instead of returning to the Buyer. Only when there is no previous level does it set `vendors.status = 'returned_to_buyer'`.
2. **`buyer-return-to-vendor`**: already implemented — sets `vendors.status = 'returned_to_vendor'` and emails the vendor. Buyer triggers it from VendorList "Return to Vendor" button.
3. **`useVendorRegistration.resubmitVendorMutation`**: on resubmit after `returned_to_vendor`, sets `vendors.status = 'scm_manager_review'` (skips Buyer stage and validation), relying on the DB trigger to reseed `vendor_approval_progress`. Documents and form data are preserved (existing dedupe logic).

## Required changes

### 1. `supabase/functions/process-approval-action/index.ts`
In the `action === 'reject'` branch, remove the "send to immediate previous level" path. Behavior becomes:
- Mark the current `vendor_approval_progress` row as `rejected` with remarks (unchanged).
- Mark all other `pending` rows in the chain for this vendor as `cancelled` (or leave — they'll be deleted on reseed).
- Update `vendors.status = 'returned_to_buyer'` with `last_rejection_comments / stage / by / at` regardless of which approver rejected.
- Keep the Buyer-rejects-directly branch as-is (status = `returned_to_vendor`, email vendor) so a Buyer rejection still skips the redundant "buyer returns to buyer" step.
- Audit log action: `vendor_rejected_returned_to_buyer` (carry `from_stage`).

### 2. `src/hooks/useVendorRegistration.tsx` — `resubmitVendorMutation`
On resubmit when `vendorStatus === 'returned_to_vendor'`:
- Set `vendors.status = 'validation_pending'` (not `scm_manager_review`) and set `submitted_at = now()`, clearing rejection metadata (as today).
- After the vendor row update + document upload, explicitly invoke `route-vendor-approval` for this vendor so `seed_vendor_approval_progress` deletes the old rows and rebuilds the chain from level 1. (Today this is only invoked on first submission.)
- Keep the `notify-vendor-submission` call so the Buyer is notified of the resubmission.

### 3. No UI changes
- VendorList "Return to Vendor" dialog already handles `returned_to_buyer → returned_to_vendor` and emails the vendor with the invite link.
- VendorRegistration already loads prior form data + documents for `returned_to_vendor` and lands on the Review step.

## Out of scope

- No changes to approval matrix config, SAP sync, DMS, or KYC flows.
- No schema / RLS / migration changes — `seed_vendor_approval_progress` already deletes and reseeds.
- No changes to email templates beyond what existing functions already send.

## Files to change

- `supabase/functions/process-approval-action/index.ts` — collapse reject branch to always return to Buyer.
- `src/hooks/useVendorRegistration.tsx` — set resubmit status to `validation_pending` and call `route-vendor-approval` to reseed the chain from stage 1.
