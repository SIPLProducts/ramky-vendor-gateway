## Objective
Hide the "Stage" column from the two active approval tabs — **Pending Approvals** and **Waiting for Previous Approval** — on all stage-based approval pages (Buyer, SCM CO, SCM Head, Finance 1, Finance 2, CEO Office). Keep the Stage column visible in the **Rejected** tab.

## Affected file
- `src/components/approvals/StageApprovalView.tsx`

## Current behavior
The `renderTable` helper renders a `<TableHead>Stage</TableHead>` header and a `<TableCell>` badge for every non-buyer row. This appears in both the Pending and Waiting tabs because both tabs use `renderTable`.

## Proposed change
1. Update the `renderTable` helper signature to accept `variant: 'pending' | 'waiting'` and a new `showStage?: boolean` parameter.
2. When `showStage` is false, remove the "Stage" header and the corresponding data cell.
3. Update the column span of the skeleton and empty-state rows to match the reduced column count.
4. In the `TabsContent` block, pass `showStage={false}` for the "pending" and "waiting" tabs, and `showStage={true}` only where needed (the rejected tab uses `renderRejectedTable`, so no change is needed there).

## Verification
- Build the project (`bun run build`) to ensure no TypeScript errors.
- Open any approval page (e.g. `/approvals/scm-manager`) and confirm that the Pending and Waiting tables no longer show a "Stage" column, while the Rejected table remains unchanged.

## No other changes
This is a presentation-only change to the existing approval table. No backend, edge functions, or other components will be modified.