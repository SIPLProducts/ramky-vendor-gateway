## Goal
Reorganize the action buttons in the approval table so they appear in two stacked rows instead of one horizontal row, matching the user's reference screenshot.

## Scope
This affects the shared `StageApprovalView` component used by every approval stage (Buyer, SCM CO, SCM Head, Finance 1, Finance 2, CEO Office). Two tables in this file render action buttons:
1. Pending / waiting approval rows
2. Rejected / returned rows

## Changes

### 1. Pending / waiting actions
In `src/components/approvals/StageApprovalView.tsx` (the pending/waiting table around the Actions `TableCell`):
- Keep the existing four buttons: **View Details**, **Comments**, **Reject**, **Approve**.
- Wrap them in a vertical flex container with two horizontal rows:
  - Row 1: **View Details** + **Comments**
  - Row 2: **Reject** + **Approve**
- Preserve existing disabled state, tooltips, click handlers, and styling (`size="sm"`, `variant="outline"`, success/destructive colors).

### 2. Rejected / returned actions
Apply the same 2-row stacking to the rejected table:
  - Row 1: **View Details** + **Comments**
  - Row 2: **Approve** + **Send to Vendor** (or **Edit & Resubmit** for on-behalf invitations)

### 3. Responsive behavior
- Use `flex-col` with `gap-2` for the outer container and `flex-row gap-2` for each inner row.
- Keep buttons from overflowing the cell on narrow viewports.

## Validation
After the change, the approval table should show:
- Top row: View Details | Comments
- Bottom row: Reject | Approve

No logic or route changes are required.