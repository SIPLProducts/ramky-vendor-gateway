## Fix

Two other spots in `src/components/approvals/StageApprovalView.tsx` still render the raw `rejectionFromStage` value (e.g. `SCM_MANAGER`) instead of the friendly `SCM CO` label, so the earlier dialog-only fix looks incomplete on the Buyer Approval screen:

1. Pending list "Returned from" note (around line 338): replace `{it.rejectionFromStage}` with `formatStageLevelHistory(it.rejectionFromStage, 1)` and fall back to `Approver` when null.
2. Rejected table "Rejected By" badge (around line 424): replace the `String(...).replace(/_/g, ' ')` with `formatStageLevelHistory(it.rejectionFromStage, 1)`.

`formatStageLevelHistory` is already imported and maps `SCM_MANAGER → SCM CO`, `SCM_HEAD → SCM Head`, `FINANCE_1 → Finance 1`, etc., so all stages render consistently.

No other files change.
