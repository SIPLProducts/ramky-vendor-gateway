## Goal

Reorganize `ApprovalMatrixConfig` so each approval stage has its own tab, and enforce that only **SCM Manager** can have multiple levels / multiple approvers. **SCM Head, Finance 1, Finance 2, CEO Office** are locked to exactly one approver each.

## Changes (single file: `src/components/admin/ApprovalMatrixConfig.tsx`)

### 1. Add 5 stage tabs
Wrap the existing rows table in `<Tabs>` with tab values: `SCM_MANAGER`, `SCM_HEAD`, `FINANCE_1`, `FINANCE_2`, `CEO_OFFICE`. Active tab filters `rows` to that stage. The Chain Preview, Diagnostics, DB strip, and Save All button stay above the tabs and continue to operate on the full row set (so one Save persists everything).

### 2. Single-approver stages (SCM Head / Finance 1 / Finance 2 / CEO Office)
For these tabs:
- Hide the **Stage** column (stage is fixed by the tab) and the **Level #** selector (auto-assigned).
- Hide the **+ Add Row** button when a row already exists; show "Only one approver allowed for this stage" helper text.
- On save, force `level_number` to the canonical slot per stage so ordering stays consistent:
  - `SCM_HEAD` → highest SCM_MANAGER level + 1 (so it runs after all SCM Managers; existing edge function already orders by `STAGE_ORDER` so any number works, but we keep numbering tidy)
  - `FINANCE_1`, `FINANCE_2`, `CEO_OFFICE` → next sequential numbers
- Validation: reject save if any of these stages has >1 row.

### 3. SCM Manager tab (multi-level, multi-approver)
- Keep current UI: Level # selector, + Add Row, Mode (ANY/ALL), free assignment of multiple approvers per level. Stage column hidden (fixed to SCM_MANAGER by the tab).
- These rows occupy `level_number` 1..N (lowest = first to act).

### 4. Auto-assignment of level_number on save
Compute final `level_number` per stage in canonical order before persisting:
```
1..N      → SCM_MANAGER rows (preserves user-chosen ordering within tab)
N+1       → SCM_HEAD
N+2       → FINANCE_1
N+3       → FINANCE_2
N+4       → CEO_OFFICE (only if present)
```
This matches `route-vendor-approval`'s `STAGE_ORDER` and the "lowest pending = active" logic in `process-approval-action`, so no backend changes are needed.

### 5. Tab badges
Each tab shows a small count badge: number of approvers configured for that stage. Tabs for stages with errors get a red dot.

## Out of scope / no changes

- Edge functions (`route-vendor-approval`, `process-approval-action`, `list-pending-approvals-by-stage`) already handle multi-level SCM Manager correctly.
- Database schema unchanged (`approval_matrix_levels.stage` already exists).
- Sidebar / approval pages unchanged (already split per stage).

## Verification

1. Open Approval Matrix → see 5 tabs.
2. SCM Manager tab: add L2, L3 with multiple approvers — allowed.
3. SCM Head tab: add 1 approver — "+ Add Row" hides; try to add a second is blocked.
4. Same for Finance 1, Finance 2, CEO Office.
5. Save All → DB shows correctly numbered levels (SCM Managers first, then Head, F1, F2, CEO last). Reload: rows reappear in the right tabs.
6. Submit a vendor → routes through SCM Managers in order, then SCM Head, F1, F2, (CEO if MSME), then SAP Sync.
