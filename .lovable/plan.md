## Goal

Replace the `L1 / L2 / L3` labels used for **SCM Manager** approval levels with `SCM CO1 / SCM CO2 / SCM CO3`. Other stages (SCM Head, Finance 1/2, CEO Office, Buyer) continue to use the existing `L{n}` labels. No workflow, data model, or routing changes.

## Scope

Display-only relabel for the SCM Manager stage in:

1. **Approval Matrix admin** (`src/components/admin/ApprovalMatrixConfig.tsx`)
   - Level # dropdown options in the SCM Manager tab → show `SCM CO1`, `SCM CO2`, … (other stages keep `L1`, `L2`).
   - Approval Chain badges → for SCM_MANAGER groups render `SCM CO{stage_level} · SCM Manager · N approver(s)` instead of `L{stage_level} · …`.
   - Footer helper text "Add multiple levels (L1, L2, L3…)" → keep generic but add a note that SCM Manager uses `SCM CO1, SCM CO2…`.
   - Validation/error messages already use stage label only — no change needed.
   - On save, write `level_name = "SCM CO{stage_level} · SCM Manager"` for SCM_MANAGER groups (other stages keep `Level {n} · {Stage}`). This propagates to anything that reads `approval_matrix_levels.level_name` directly.

2. **SCM Manager Approval page** (`src/components/approvals/StageApprovalView.tsx`)
   - The level badge currently renders `it.levelName` from the API. When `stage === 'SCM_MANAGER'`, format it as `SCM CO{stage_level}` derived from the stored `levelName` (parse leading `L{n}` / `Level {n}` / `SCM CO{n}` → `n`) so existing matrices still display correctly even before the admin re-saves. Other stages keep `levelName` as-is.

3. **Helper** — add a tiny `formatStageLevel(stage, n)` util (e.g. inline in ApprovalMatrixConfig or a new `src/lib/approvalLabels.ts`) returning `SCM CO${n}` for `SCM_MANAGER` and `L${n}` otherwise. Reuse it in both files.

## Out of scope

- No DB migration. `level_number` (global) and `vendor_approval_progress` rows are untouched.
- No edge function changes — `list-pending-approvals-by-stage` keeps returning `levelName`; the page formats it.
- No changes to vendor-facing `ApprovalTimeline`, audit log details, email templates, SAP sync, KYC, DMS, or Buyer/SCM Head/Finance/CEO approval pages.
- No reordering or renumbering of existing approval rows.

## Files to change

- `src/components/admin/ApprovalMatrixConfig.tsx` — use `formatStageLevel` for the SCM Manager level dropdown, chain badge text, and the saved `level_name`.
- `src/components/approvals/StageApprovalView.tsx` — when the stage is `SCM_MANAGER`, render `SCM CO{n}` derived from `levelName`.
- `src/lib/approvalLabels.ts` (new, tiny) — shared `formatStageLevel(stage, n)` helper.
