## Scope: UI-only changes

### 1. Sidebar logo removal
- File: `src/components/layout/Sidebar.tsx`
- Remove the logo `<img>`/brand block at the top of the sidebar. Keep the app name text if present, or collapse the header spacing cleanly so nav items sit at the top.

### 2. Table adjustments (global)
Apply across all list/table screens (VendorList, AuditLogs, AdminInvitations, UserManagement, approval queues, SAPSync, KycApiSettings, SapApiSettings, Reports, etc.) and the shared `src/components/ui/table.tsx` if needed.

- **a) Single-line headers**: add `whitespace-nowrap` to `<TableHead>` (either globally in `ui/table.tsx` `TableHead` default classes, or per-table). Preferred: update default `TableHead` className to include `whitespace-nowrap`.
- **b) Remove `#` symbol**:
  - Strip `#` from any column header label (e.g., `Reference #` → `Reference Number`, `Sr #` → `Sr No`).
  - Strip `#` anywhere it appears next to reference numbers in cell content, page titles, detail views (e.g., `VendorStatus.tsx` "Reference #" label).
  - Search targets: `rg "#"` in `src/pages/**` and `src/components/**` for header/label occurrences.
- **c) Actions column header center-aligned**: add `text-center` to the Actions `<TableHead>` in every table that has one. Cell contents remain as-is (unless user later asks).

### 3. Dashboard progress diagram fixes
- File: `src/components/vendor/RegistrationStatusTracker.tsx` (and Dashboard usage).
- **Correct status display**: ensure completed stages (including SAP Sync) render as ticked/completed when vendor status is `sap_synced`. Bug likely in step-status computation not marking all prior steps + SAP step as done when `sap_synced`.
- **SAP Sync label**: when SAP sync is complete, show "SAP Sync Completed" with the SAP vendor code beneath (pull `sap_vendor_code` from vendor record).
- **Remove L1–L5 labels** from the approval-flow progress diagram (the stage chips/badges showing `L1`, `L2`, …). Keep stage names and everything else unchanged.
  - File: `src/components/vendor/ApprovalTimeline.tsx` — remove the `<Badge>L{level_number}</Badge>` element (used in Dashboard reference-number progress view).
  - Verify `RegistrationStatusTracker` doesn't also render L-labels; if it does, remove there too.

### Out of scope
- No backend, schema, workflow, or business-logic changes.
- Row content alignment untouched (only the Actions header).

### Verification
- Load Dashboard for a `sap_synced` vendor → all steps ticked, SAP step shows "SAP Sync Completed · <sap_code>".
- Open a few tables → headers on one line, no `#`, Actions header centered.
- Sidebar shows no logo.
- Approval Progress card shows stage names without `L1/L2/...` prefix.
