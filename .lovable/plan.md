
## 1) Rename "Original Invited By" → "Primary Buyer"

- `src/components/vendor/VendorReviewDialog.tsx` (line 464): change label text.
- Grep confirms this is the only occurrence in `src/`.

## 2) Dashboard table: add "Actions" column (View + Comments)

`src/pages/Dashboard.tsx` (lines 428–478):
- Add `<TableHead className="text-center">Actions</TableHead>` after "Created Date".
- In each row, add a cell with two icon buttons mirroring `VendorList.tsx`:
  - **View** → opens `VendorReviewDialog` for `v.id` (Eye icon, tooltip "View").
  - **Comments** → opens `ApprovalCommentsDialog` (MessageSquare icon, tooltip "Approval Comments").
- Add local state `viewVendorId` and `commentsVendor` (id + name + reference_number).
- Mount `<VendorReviewDialog>` and `<ApprovalCommentsDialog>` at the bottom of the component, same wiring pattern used in `VendorList.tsx`.
- Bump the loading skeleton and empty-state `colSpan` from 6 to 7.

## 3) Buyer re-approve dialog after SCM CO rejection

File: `src/components/approvals/StageApprovalView.tsx`, the `rejectedAction` dialog (lines 591–634).

### 3a) Stage label in the returned-remarks banner
The banner currently prints `SCM_MANAGER remarks:` because it just replaces underscores. Replace that logic with `formatStageLevelHistory(stage, 1)` from `src/lib/approvalLabels.ts` so `SCM_MANAGER` renders as **"SCM CO Remarks"** (and other stages get their proper labels too):

```
<strong>
  {rejectedAction.item.rejectionFromStage
    ? `${formatStageLevelHistory(rejectedAction.item.rejectionFromStage, 1)} Remarks: `
    : 'Approver Remarks: '}
</strong>
```

### 3b) Show + allow editing Classification on re-approve
Currently the re-approve path (`buyer-reapprove-rejected`) does not surface the previously saved Classification (Material Group Vendor / Vendor Category), so the buyer cannot review or change it. Fix:

- Add a `useEffect` that, when `rejectedAction?.action === 'approve'` opens, loads the vendor's saved `material_group_vendor(s)` and `vendor_category(ies)` into a new `rejectedClassification` state (same query already used for the normal buyer approve prefill, lines 78–92).
- Render two `ClassificationField` inputs inside the re-approve dialog (before the Optional remarks textarea) — one for Material Group Vendor, one for Vendor Category — pre-filled and editable, matching the styling used in the normal buyer approve dialog.
- In `submitRejectedAction` (approve branch only), before invoking `buyer-reapprove-rejected`, persist any changes with a `supabase.from('vendors').update({ material_group_vendor, material_group_vendors, vendor_category, vendor_categories })` call (same shape as `submit()` lines 106–112).
- Disable the Confirm Approve button when either classification array is empty (mirror the existing rule in `submit`).

No changes to the `buyer-reapprove-rejected` edge function are required — classification is persisted directly on the vendor row.

## Out of scope
- No schema changes.
- No changes to `buyer-reapprove-rejected` / `process-approval-action` edge functions.
- No changes to other approval stages' dialogs.
