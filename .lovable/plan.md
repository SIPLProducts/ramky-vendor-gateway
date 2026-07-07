## Updated plan (incorporating your clarifications)

- Item 2 (Vidyasagar buyer dashboard) is dropped — you confirmed it's working now.
- Item 3 gains a routing rule: when an approval stage is **not selected** (user_id = null and skip = false), the workflow must **skip that stage and move to the next approver**, exactly the same way it does for an explicitly skipped stage.

## 1. Save & display "Is Aadhaar Linked" everywhere

**Save path** — the DB column `vendors.pan_aadhaar_linked` already exists, and `useVendorRegistration.finalize` already writes `formData.statutory.panAadhaarLinked`. The gap is that when the PAN Comprehensive result resolves, the value must always propagate into `formData.statutory` before submit, so drafts and re-hydrated sessions keep it.

Fixes:
- `src/components/vendor/steps/DocumentVerificationStep.tsx` — after each PAN Comprehensive resolution (around lines 852 and 882), ensure the `apiData` written on `panDoc` includes `panStatus` + `aadhaarLinked` (already done), and continue persisting to `vendors` when `vendorId` exists (already done). Add a safety net that also pushes the value through `onStageChange` immediately, not only on the next reactive render.
- `src/hooks/useVendorRegistration.tsx` — verify `pan_aadhaar_linked` is written in `finalize()` (already true, keep).

**Display audit** — add "PAN Status" and "Is Aadhaar Linked" rows using the shared `formatAadhaarLinked` / `formatPanStatus` helpers everywhere PAN details are shown.

Already correct:
- `ReviewStep` (registration Review), `VendorList` (View Details), `VendorReviewDialog` (approvals + SAP Sync View Details), `DocumentVerification` page, `FinanceReview`, `PurchaseApproval`, `Reports` export.

Screens to update:
- `src/components/vendor/VendorSubmissionPreviewDialog.tsx` — the shared Preview dialog used by Vendor List, SAP Sync, and every approval screen (via `StageApprovalView`). Currently only shows `PAN`; add `PAN Holder Name`, `PAN Status`, `Is Aadhaar Linked` in the Compliance & Statutory section.
- `src/pages/Reports.tsx` — the on-screen table currently omits both fields (only the CSV export has them). Add "PAN Status" and "Is Aadhaar Linked" columns/rows so the UI matches the export.

Because SAP Sync and every approval screen open PAN details through `VendorReviewDialog` + `VendorSubmissionPreviewDialog`, updating just those two components covers SAP Sync View Details/Preview and all approval screens in one change.

## 2. Vidyasagar dashboard

Dropped — confirmed working.

## 3. Approval Matrix — "not selected" must skip forward

**Root cause of the mislabelling:** in `src/components/admin/ApprovalMatrixConfig.tsx` the summary table (line ~450) currently prints "skipped" whenever `skip_<stage> = true` in the DB. Existing rows (e.g. Viplava's SCM Head / Finance 2) have `skip = true` written explicitly, so the label is technically correct, but the label is misleading vs. an unselected stage. There is no auto-toggle in the current save path — `handleSave` spreads `flow` which is initialised to all `skip_* = false`; the DB column defaults are also `false`.

**Fixes**

A. Display in `ApprovalMatrixConfig.tsx`
- Keep the tri-state cell renderer:
  - `skip = true` → "skipped"
  - `user_id` set → approver name
  - otherwise → "—"

B. Routing (the important change) — treat "not selected" the same as "skipped"
- Edge function and DB routine that iterates the stages (`supabase/migrations/20260608080354_*.sql` — `route-vendor-approval` / pending-approvals query at lines 65-83) currently uses:
  ```
  IF v_flow.scm_head_user_id IS NOT NULL AND NOT v_flow.skip_scm_head THEN
      queue stage
  ```
  A stage with `user_id = null` and `skip = false` is silently ignored, which stalls the chain.
- Update the condition (across every stage in that function and any sibling functions/edge functions that iterate the flow — `route-vendor-approval`, `list-pending-approvals-by-stage`, `useVendorApprovalChain`) to:
  ```
  IF v_flow.<stage>_user_id IS NOT NULL AND NOT v_flow.skip_<stage> THEN
      queue stage       -- run it
  ELSE
      skip to next      -- both "explicitly skipped" and "not selected" fall through
  ```
- Effect: whether a stage is toggled "Skip" or simply left unselected, the workflow advances to the next configured approver in the same way. CEO Office stays governed by the existing MSME rule.

C. Client-side helpers
- `src/pages/AdminInvitations.tsx` (line ~471) currently gates the invitation flow on `(!!user_id && !skip)`. Keep the OR chain but simplify: treat any stage where that condition is false as skipped (no user-facing change, just alignment with the new routing rule).
- `useVendorApprovalChain` (if present under `src/hooks/`) — same alignment.

D. Migration
- Add a new SQL migration replacing the affected function bodies so the new rule is applied server-side. No schema change.

## Files to change

- `src/components/vendor/steps/DocumentVerificationStep.tsx` — ensure PAN comprehensive result propagates + persists.
- `src/components/vendor/VendorSubmissionPreviewDialog.tsx` — add PAN Holder Name / PAN Status / Is Aadhaar Linked rows.
- `src/pages/Reports.tsx` — add PAN Status + Is Aadhaar Linked columns to the on-screen table.
- `src/components/admin/ApprovalMatrixConfig.tsx` — tri-state renderer for the summary table.
- `supabase/migrations/<new>.sql` — update the pending-approvals / routing SQL functions so "not selected" behaves like "skipped".
- Any TS route/chain helper that mirrors that SQL rule.

Approve to build.
