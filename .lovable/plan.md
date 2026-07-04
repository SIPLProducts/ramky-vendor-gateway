## Source of the label

The "SCM CO1 / SCM CO2" labels are generated in `src/lib/approvalLabels.ts` by the `formatStageLevel` function. For any `SCM_MANAGER` stage it returns `SCM CO${level}` using the approval level number stored in the database.

## What we will change

Scope: **Approval Comments History dialog only** — the approval list rows will continue to show "SCM CO1" / "SCM CO2" so they still reflect the exact level.

### 1. Add a history-specific label helper

File: `src/lib/approvalLabels.ts`

Add a new exported function `formatStageLevelHistory` that returns plain stage names for the history view:

- `SCM_MANAGER` → `SCM CO` (no level number)
- `SCM_HEAD` → `SCM Head`
- `BUYER` → `Buyer`
- `FINANCE_1` → `Finance 1`
- `FINANCE_2` → `Finance 2`
- `CEO_OFFICE` → `CEO Office`
- Fallback → `L${n}`

Keep the existing `formatStageLevel` unchanged so other screens remain unaffected.

### 2. Use the helper in the comments history dialog

File: `src/components/sap/ApprovalCommentsDialog.tsx`

Replace the `Approval Stage` column rendering:

```tsx
{formatStageLevel(r.stage as ApprovalStage, r.level_number)}
```

with:

```tsx
{formatStageLevelHistory(r.stage as ApprovalStage, r.level_number)}
```

### 3. Leave approval list badges untouched

File: `src/components/approvals/StageApprovalView.tsx`

Continue using `formatStageLevel` for the stage badges in approval list rows so they still display the exact level (e.g., "SCM CO2").

## No backend changes

This is a frontend presentation-only change. No database migrations, edge functions, or API changes are required.