## Goal
1. Make approval comments mandatory for **every** approve/reject action across all stages (currently only buyer-reject requires them).
2. On the SAP Sync screen, add a **Comments** button beside "Reject & Send to Buyer" that opens a dialog listing the full approval-comment history for that vendor.

## Changes

### 1. `src/components/approvals/StageApprovalView.tsx` — mandatory comments
- Change the textarea placeholder to always show "Comments (required)".
- Update the submit `disabled` rule from `(reject && isBuyer && !comments.trim())` to simply `!comments.trim()` — required for both approve and reject at every stage.
- Update `DialogDescription` copy to note comments are required.
- No backend change needed: `process-approval-action` already persists `comments` into `vendor_approval_progress.comments` (and stage rejections into `vendors.last_rejection_comments`). The auto-approved BUYER row inserted by `seed_vendor_approval_progress` for on-behalf submissions keeps its existing auto-comment.

### 2. `src/pages/SAPSync.tsx` — Comments button on SAP tab card
- Add a new outline button "Comments" (MessageSquare icon) between "Reject & Send to Buyer" and the end of the action row (line ~550), for each pending SAP-sync vendor card.
- On click, set `commentsVendor` state → opens a new dialog.

### 3. New component `src/components/sap/ApprovalCommentsDialog.tsx`
- Props: `vendor` (or vendorId + display name/ref) + open/onOpenChange.
- Fetches `vendor_approval_progress` rows for the vendor (all statuses, ordered by `level_number` asc), joins `profiles` for `acted_by → full_name/email` (same pattern as `ApprovalTimeline.tsx`).
- Renders a table with columns:
  - **Approval Stage** — `formatStageLevel(stage, level_number)` from `src/lib/approvalLabels.ts`
  - **Approver Name** — profile full_name / email, or "—"
  - **Status** — approved / rejected / pending / cancelled badge
  - **Comments** — `comments` (fallback to `rejection_comments` returned-from-next-stage note if present); "—" if empty
  - **Date & Time** — `acted_at` formatted in IST (`Asia/Kolkata`, matching existing IST formatting elsewhere)
- Shows vendor name + Ref No in the dialog header.
- Empty state: "No approval activity recorded yet."

## Out of scope
- No DB schema changes (comments column already exists).
- No changes to SAP payload, rejection email flow, or other screens.
- Timeline component (`ApprovalTimeline.tsx`) stays as-is; the new dialog is table-formatted per the requirement.
