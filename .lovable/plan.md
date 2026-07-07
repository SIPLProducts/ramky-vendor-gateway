## 1. Save & display "Is Aadhaar Linked" everywhere

**Root cause (Preview / View Details shows `-`):**
In `src/components/vendor/steps/DocumentVerificationStep.tsx` (line ~1948), the PAN block that builds the payload for the parent form (`out.pan = ...`) only runs when `panDoc.status === "verified"`. But the PAN Comprehensive result (`status`, `aadhaar_linked`) is also captured from a fire-and-forget call and stored on `panDoc.apiData` / `panDoc.ocrData` before the doc reaches `verified`, and `out.panAadhaarLinked` uses `??` which is correct for `false` but the update is only pushed on step transition. The stored `apiData.aadhaarLinked` also isn't re-mapped when the parent later re-hydrates a saved draft, so a fresh session shows `-` on Review.

The `pan_aadhaar_linked` DB column already exists and `useVendorRegistration.finalize` already writes `formData.statutory.panAadhaarLinked`. The gap is:
- The value is not always propagated into `formData.statutory` before the vendor is submitted (only on stage-navigation).
- Some display screens don't use the shared `formatAadhaarLinked` helper.

**Fix**
- In `DocumentVerificationStep.tsx`, whenever the PAN Comprehensive result resolves (both branches around lines 852 and 882), also call `onDataChange({ panStatus, panAadhaarLinked })` immediately so the parent `formData.statutory` is updated in real time (mirroring how `PanKycTab` already persists via `onComprehensiveResult`).
- Also fire an immediate `supabase.from('vendors').update({...})` when a `vendorId` exists (already done) and additionally when the vendor row is first created — no schema change needed.
- Confirm `finalize()` in `useVendorRegistration.tsx` keeps writing `pan_aadhaar_linked` (already does — verify only).

**Display audit (add "Is Aadhaar Linked" using `formatAadhaarLinked` where missing):**
Already present:
- `VendorList` view details (`src/pages/VendorList.tsx` line 654)
- `VendorReviewDialog` preview (line 598)
- `DocumentVerification` page (line 776)
- `FinanceReview` (line 394)
- `PurchaseApproval` (line 422)
- `ReviewStep` registration preview (line 217)
- `Reports` export column (line 464)

Screens to update (add the row if missing / switch to `formatAadhaarLinked`):
- `src/components/approvals/StageApprovalView.tsx` — vendor review drawer/dialog (Buyer / SCM CO / SCM Head / Finance / CEO approval screens all use this). Add "PAN Status" and "Is Aadhaar Linked" rows in the PAN details section.
- `src/pages/SAPSync.tsx` — the SAP Sync preview / details drawer. Add both rows in the PAN section.
- `src/components/vendor/VendorSubmissionPreviewDialog.tsx` — submission preview PAN block.
- `src/pages/Reports.tsx` — table view (currently only in export). Add column or details row.
- Any other component rendering PAN details discovered during implementation (grep `pan_holder_name` / `PAN Holder Name`).

All screens will read from `vendors.pan_aadhaar_linked` and render through `formatAadhaarLinked` from `src/lib/panComprehensive.ts` for consistency.

## 2. Vidyasagar (Buyer) missing on dashboard

Need one clarification: which dashboard is showing incorrect data for Vidyasagar?
- (a) The **SCM CO approval dashboard** (`/approvals/scm-manager`) — vendors invited by Vidyasagar not appearing for his mapped SCM Manager (Soumendu Kumar Sengupta per screenshot 3).
- (b) The main **Dashboard** page — Vidyasagar's invited vendors don't show in "Invited By" filter.
- (c) The **Buyer approval dashboard** (`/approvals/buyer`) when Vidyasagar logs in.

I'll investigate the specific path once confirmed. Most likely fix is in `usePendingApprovalsByStage` / `list-pending-approvals-by-stage` edge function or the `buyer_approval_flows` lookup that resolves Vidyasagar's SCM Mgr to Soumendu — the query probably joins on the wrong id or filters out mappings where certain slots are null.

## 3. Approval Matrix "skipped" shown when nothing was selected

**Root cause:** In `src/components/admin/ApprovalMatrixConfig.tsx`, the "Configured Buyers" summary table (line ~450) renders:
```
skipped ? "skipped" : uid ? name : "—"
```
The `skipped` flag comes from `buyer_approval_flows.skip_<stage>`. Somewhere the skip flag is being written as `true` even when the admin did not toggle the skip switch — most likely in the save path (`handleSave` around line 238) when the user picks no approver, or in a legacy migration default. Result: rows like Viplava M / Srinagaraju show "skipped" for stages the admin never intentionally skipped.

**Fix**
- In `handleSave`, when a stage has `user_id = null` AND the admin did not explicitly toggle skip, write `skip_<stage> = false` (not `true`). Only send `skip_<stage> = true` when the switch is on.
- In the summary table cell renderer, change semantics to:
  - `skipped === true` → "skipped"
  - `uid` set → approver name
  - else → "—" (not selected)

So "skipped" is only shown when the admin explicitly checked the Skip toggle for that stage. Stages left blank display "—".

- Also review the routing logic (`route-vendor-approval` edge function / `useVendorApprovalChain`) so a stage with `skip = false` and `user_id = null` is treated as "not configured" and either falls back to a default approver or blocks with a clear error, instead of silently skipping.

## Files to change

- `src/components/vendor/steps/DocumentVerificationStep.tsx` — push `panStatus` / `panAadhaarLinked` to parent immediately after comprehensive call.
- `src/components/approvals/StageApprovalView.tsx` — add PAN Status / Is Aadhaar Linked rows.
- `src/pages/SAPSync.tsx` — add PAN Status / Is Aadhaar Linked in preview.
- `src/components/vendor/VendorSubmissionPreviewDialog.tsx` — add rows.
- `src/pages/Reports.tsx` — add table column (optional) + ensure export uses helper.
- `src/components/admin/ApprovalMatrixConfig.tsx` — fix skip default in `handleSave` and summary rendering.
- Whichever dashboard is confirmed for #2 (edge function or hook).

## Question before build

For item 2, please confirm which dashboard is affected for Vidyasagar (options a/b/c above) so I can target the correct query.
