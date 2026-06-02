## Goal

Split the single "Pending" list on every stage-approval page into two tabs:

1. **Pending Approval** — items where the logged-in approver can act now (`blockedByPrevious === false`).
2. **Waiting for Previous Approval** — items still blocked by an earlier approver (`blockedByPrevious === true`). Approve/Reject buttons stay disabled here.

When the previous approver finishes, the existing `refresh()` flow will automatically move the item into the Pending Approval tab on next refetch.

## Scope

Single file: `src/components/approvals/StageApprovalView.tsx`. This component powers all stage pages (SCM Manager, SCM Head, Buyer, Finance 1, Finance 2, CEO), so all of them get the change for free.

Nothing else changes — no edits to data hook, edge functions, schema, or other pages.

## Changes

1. Add `Tabs` (shadcn) above the existing table.
2. Derive `pendingItems = items.filter(i => !i.blockedByPrevious)` and `waitingItems = items.filter(i => i.blockedByPrevious)`.
3. Render the same table inside each tab using a small inline helper to avoid duplication; counts in tab labels: `Pending Approval (n)` and `Waiting for Previous Approval (m)`.
4. In the Waiting tab, keep View / Preview enabled; Approve / Reject remain disabled with the existing tooltip.
5. Keep the existing inline amber "previous approver has not approved yet" text only in the Waiting tab (redundant in Pending tab).
6. Default selected tab: `Pending Approval`. If it's empty but Waiting has items, still default to Pending (empty state already explains it).

## Out of scope

- No changes to `usePendingApprovalsByStage`, `process-approval-action`, audit logs, dialogs, or routing.
- No realtime push — relies on the same `refresh()` already invoked after an action.
