
## Reports Screen

A new screen to give buyers/admins a complete audit trail of vendor registration and approval, with export.

### Route & navigation

- New route: `/reports` → `src/pages/Reports.tsx` (inside `AppLayout`, under `ProtectedRoute`).
- Add a "Reports" link in the Sidebar (visible only when the user has the `reports` screen permission — see Role Permissions section).

### Filters (top of page)

- **Date Range**: From / To (shadcn DatePicker with `pointer-events-auto`). Filters on `vendors.created_at`.
- **Vendor Status**: multi-select of `vendor_status` enum values (Draft, Submitted, Buyer Review, SCM Manager, SCM Head, Finance 1, Finance 2, CEO Office, Approved, Rejected, Returned to Vendor, Pending SAP Sync, Synced).
- **Report Type** (tabs): `Vendor Report` | `Approval Flow Report`.
- **Mode** (radio/segmented): `Single Vendor` (Reference Number input, uses existing `vendors.reference_number` lookup with RLS) | `All Vendors` (uses filters).
- Buttons: `Run Report`, `Export Excel`, `Export PDF`, `Reset`.

### Data sources (all RLS-scoped, no new tables)

- `vendors` — core details + final status.
- `vendor_invitations` — invitation sent date, invited email, on-behalf flag, buyer (`created_by`).
- `vendor_approval_progress` — every stage row (BUYER, SCM_MANAGER, SCM_HEAD, FINANCE_1, FINANCE_2, CEO_OFFICE) with `status`, `acted_at`, `started_at`, `completed_at`, `comments`, `acted_by`.
- `profiles` — resolve approver names/emails from `acted_by`.
- `audit_logs` — SAP Team actions (sync/return/reject) keyed by vendor, used to render the SAP Team row in the approval timeline.

A small helper `src/lib/reports/loadVendorReport.ts` fetches a vendor + its progress + profiles + SAP audit events and shapes them into a normalized record:

```
VendorReportRow {
  reference_number, vendor_name, vendor_type, status,
  invited_at, invited_email, submitted_at, on_behalf,
  buyer: StageInfo,
  scm_manager: StageInfo,
  scm_head: StageInfo,
  finance_1: StageInfo,
  finance_2: StageInfo,
  ceo_office: StageInfo,
  sap_team: StageInfo,            // derived from audit_logs
  current_stage, final_status,
}
StageInfo { approver_name, status, acted_at, remarks }
```

### Vendor Report view

- Table columns (All Vendors mode): Ref #, Vendor Name, Type, Status, Invited At, Submitted At, Current Stage, Final Status.
- Single Vendor mode: same row rendered as a details card.

### Approval Flow Report view

- All Vendors mode: one row per vendor with 7 stage columns (Buyer, SCM Manager, SCM Head, Finance 1, Finance 2, CEO Office, SAP Team). Each cell shows status badge + approver + date; tooltip shows remarks.
- Single Vendor mode: vertical timeline (reuses `ApprovalTimeline` styling) plus a SAP Team row.

### Export

- **Excel** via `xlsx` (already in deps if present; otherwise add `xlsx`). Two sheets: `Vendors` and `Approval Flow` (one row per vendor × stage).
- **PDF** via `jspdf` + `jspdf-autotable` (add if missing). Landscape, one table per report type. Single Vendor PDF renders a labelled detail block + stage table.
- File names: `vendor-report-YYYYMMDD-HHmm.xlsx`, `approval-flow-report-...pdf`.

### Role Permissions integration

- Add screen key `reports` to the existing `role_screen_permissions` / `custom_role_screen_permissions` matrices (data insert via the insert tool — no schema change needed; the screen key is just a string).
- Sidebar entry and route guard both use `useScreenPermissions().can('reports')`.
- Admin / Sharvi Admin get it by default; other roles toggle via the existing Role Permissions UI.

### Out of scope

- No DB schema changes, no new RLS policies (existing `user_can_see_vendor` already scopes visibility for buyers/approvers/admins/SAP team).
- No edits to the Vendor Invitations screen, vendor status page, approval pages, or SAP sync.
- No scheduled/emailed reports.

### Files

- New: `src/pages/Reports.tsx`, `src/components/reports/ReportFilters.tsx`, `src/components/reports/VendorReportTable.tsx`, `src/components/reports/ApprovalFlowTable.tsx`, `src/lib/reports/loadVendorReport.ts`, `src/lib/reports/exportExcel.ts`, `src/lib/reports/exportPdf.ts`.
- Edited: `src/App.tsx` (route), `src/components/layout/Sidebar.tsx` (nav entry), Role Permissions seed (insert `reports` screen key rows).
