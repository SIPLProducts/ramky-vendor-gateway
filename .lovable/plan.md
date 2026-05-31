## Plan: fix rejection workflow reflection end-to-end

### Goal
Make rejection move backward to the immediate previous approver, show rejection remarks at each handoff, let the original Buyer return it to the Vendor, and let the Vendor edit/resubmit the same saved application without losing documents.

### What I found
The reverse approval logic is partly present, but it is not fully reflected because:
- The Vendor registration route still treats every non-draft submitted vendor as read-only, so `returned_to_vendor` does not reopen the form from the invite link.
- The Vendor form hydration list does not include the new workflow statuses consistently.
- Resubmission currently sets `validation_pending`, while the approval trigger only reseeds/continues workflow when the status moves into an approval review status.
- The Buyer list has a return action, but the remarks are only shown inside the dialog, not clearly surfaced in the row/details.
- Status tracking does not explicitly handle `returned_to_buyer` / `returned_to_vendor`, so users may not see the correct workflow state.

### Implementation steps
1. **Vendor invite/form reopening**
   - Update `VendorRegistration.tsx` token validation so `returned_to_vendor` behaves like an editable status, not like a completed/submitted status screen.
   - Include `returned_to_vendor` in the editable hydration logic so existing form data is loaded back into the same application.
   - Keep uploaded documents intact by preserving the existing `vendor_documents` flow and only replacing files if the vendor uploads a new file.

2. **Vendor rejection remarks display**
   - Add a prominent semantic alert/banner on the Vendor registration page when status is `returned_to_vendor`.
   - Display `last_rejection_stage`, `last_rejection_comments`, and rejection date from the existing vendor record.
   - Change the submit CTA context to resubmission where applicable.

3. **Correct vendor resubmission routing**
   - Update `resubmitVendor` so when a returned vendor resubmits, status moves back into the approval workflow (`scm_manager_review` or the first routed approval status), not `validation_pending`.
   - Clear stale return metadata only after resubmission is accepted, while preserving historical progress/audit data.
   - Ensure approval progress is reseeded via the existing trigger/route logic so the updated application continues through approvals.

4. **Buyer returned queue visibility**
   - In `VendorList.tsx`, make `returned_to_buyer` vendors visibly show the rejection stage/remarks in the table/details.
   - Keep the existing “Return to Vendor” action, but make the dialog clearly include approver remarks and buyer remarks before sending to vendor.
   - Refresh vendor list after successful return so the status change is immediately reflected.

5. **Approval-stage reverse routing robustness**
   - Adjust `process-approval-action` rejection branch so reopening the previous approver clears stale approval comments and carries the new rejection metadata reliably.
   - Keep the current dynamic previous-level lookup, so it works even if SCM stages are skipped or the matrix changes.

6. **Status tracker/type cleanup**
   - Add the missing approval statuses to `src/types/vendor.ts` so frontend logic handles the current workflow statuses consistently.
   - Update `RegistrationStatusTracker` handling for `returned_to_buyer` and `returned_to_vendor` to show action-required/returned states instead of falling through.

### Validation
- Verify code paths for these scenarios:
  - Finance 2 reject → Finance 1 pending with remarks.
  - Finance 1 reject → SCM Head pending with remarks.
  - SCM Head reject → SCM Manager pending with remarks.
  - SCM Manager reject → Buyer sees returned vendor and remarks.
  - Buyer sends to Vendor → Vendor sees remarks, existing data/documents remain, form is editable.
  - Vendor resubmits → approval workflow starts again with updated data.

### Files expected to change
- `src/pages/VendorRegistration.tsx`
- `src/hooks/useVendorRegistration.tsx`
- `src/pages/VendorList.tsx`
- `src/components/vendor/RegistrationStatusTracker.tsx`
- `src/types/vendor.ts`
- `supabase/functions/process-approval-action/index.ts`

No new database schema should be needed unless the current backend does not actually contain the previously added rejection columns/status values.