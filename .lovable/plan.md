## Goal
On the Approval Chain visualization (and persisted level names), show only role names — `SCM CO1`, `SCM CO2`, `SCM CO3`, `SCM Head`, `Finance 1`, `Finance 2`, `CEO Office` — removing the generic `L4`/`L5`/`L6` prefixes and the trailing `· N approver(s)` text. No logic, ordering, dropdowns, or stage tabs change.

## Changes

### 1. `src/lib/approvalLabels.ts`
Extend `formatStageLevel` so every stage returns its role name (no `L{n}`):
- `SCM_MANAGER` → `SCM CO${n}` (unchanged)
- `SCM_HEAD` → `SCM Head` (unchanged)
- `BUYER` → `Buyer`
- `FINANCE_1` → `Finance 1`
- `FINANCE_2` → `Finance 2`
- `CEO_OFFICE` → `CEO Office`
- fallback → `L${n}` (kept for any unexpected stage)

`parseLevelOrdinal` stays as-is.

### 2. `src/components/admin/ApprovalMatrixConfig.tsx`
- **Chain badges (line 764)**: render only the role label, no `· N approver(s)` suffix. Keep the `(MSME only)` qualifier for CEO_OFFICE.
  ```
  {formatStageLevel(g.stage, g.stage_level)}{isCeo ? ' (MSME only)' : ''}
  ```
- **Saved `level_name` (line 364)**: persist just the role label so downstream views show the same string:
  ```
  level_name: formatStageLevel(grp.stage, grp.stage_level)
  ```
- **Level # dropdown / footer helper text / stage tabs**: untouched — those still need numeric levels for editing.

### Out of scope
No DB migration, no edge function changes, no changes to vendor-facing pages, audit logs, approval routing, email templates, or stage ordering. Existing rows keep their stored `level_name` until the matrix is re-saved (the timeline already falls back to `levelName` so this is safe).
