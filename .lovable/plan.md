## Scope
- `src/components/vendor/VendorReviewDialog.tsx` — All Details tab card changes.
- `src/components/approvals/StageApprovalView.tsx` — Buyer-stage-only table columns and tab visibility.

## Changes

### 1. Vendor Review Dialog — All Details tab
- **Remove** the entire "Contact Details" card.
- **Reorder** remaining cards to: Buyer Details → Organization Details → Statutory Details → Bank Details → Address Details → Classification Details → Financial Information.

### 2. Buyer Approval screen only (`stage === 'BUYER'`)
In `StageApprovalView.tsx`:
- **Hide the "Waiting for Previous Approval" tab and its content** when `isBuyer` (no prior approver exists before Buyer).
- In the Pending Approval table, **hide the `Buyer Company`, `Invited By`, and `Stage` columns** when `isBuyer` — both header and body cells; adjust `colSpan` on skeleton/empty rows to 4.
- Rejected tab (Buyer only) is unchanged.
- No changes to other approval screens (SCM Manager/Head, Finance 1/2, CEO, SAP Sync).

## Technical Notes
- `renderTable` currently uses 7 columns with `colSpan={7}`. Under `isBuyer` it will render 4 columns (Vendor, MSME, Submitted, Actions) with `colSpan={4}`, via conditional JSX inside the shared function.
- Waiting tab removal: wrap `<TabsTrigger value="waiting">` and its `<TabsContent value="waiting">` in `{!isBuyer && (...)}`.
- No business-logic, data-fetching, or edge-function changes.
