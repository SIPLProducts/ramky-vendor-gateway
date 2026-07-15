## Scope

Three global UI/formatting changes across tables, exports, and labels.

---

### 1) Column reorder — approval screens + Vendor Invitations

Reorder table columns to: **Buyer Company | Buyer Invited Email (if column exists) | Vendor Name | Vendor Email | …existing remaining columns (Status, Created/Actions, etc.)**

Files to update (each has its own table; only reorder headers + row cells, no data logic changes):

- `src/pages/approvals/BuyerApproval.tsx`
- `src/pages/approvals/ScmManagerApproval.tsx`
- `src/pages/approvals/ScmHeadApproval.tsx`
- `src/pages/approvals/Finance1Approval.tsx`
- `src/pages/approvals/Finance2Approval.tsx`
- `src/pages/approvals/CeoApproval.tsx`
- `src/pages/SAPSync.tsx` (buyer → SAP sync all screen)
- `src/pages/AdminInvitations.tsx` (Vendor Invitations)

For each: keep any existing columns that aren't in the four above (Status, Actions, dates, stage) and place them **after** the four reordered leading columns. If a screen doesn't currently show one of the four (e.g. no Buyer Invited Email column exists), it will be added only where the data is readily available; otherwise it is skipped for that screen (per user's "if there" qualifier).

Also update matching Excel export column order on any of these screens that export.

---

### 2) Dashboard table columns

Update `src/pages/Dashboard.tsx` table + Excel export to exactly this order:

`Reference Number | Invited By | Vendor Name | Vendor Email | Status | Created Date`

(Removes the current "Email" column duplication; "Vendor Email" = `display_email`. "Invited By" stays as the buyer profile name.)

---

### 3) Global date format = `DD-MM-YYYY` (with time as `DD-MM-YYYY HH:mm` when time is shown)

Introduce a single shared helper `src/lib/dateFormat.ts` exporting:

- `formatDate(d)` → `15-07-2026`
- `formatDateTime(d)` → `15-07-2026 14:30`

Replace date rendering across the app to use these helpers wherever dates are shown in:

- Table cells
- Labels / detail views
- Excel/PDF exports
- Dialogs (approval timeline, vendor review, status tracker, etc.)

Search targets to sweep and convert:
- All `date-fns` `format(...)` calls that render user-visible dates (patterns like `'yyyy-MM-dd'`, `'dd MMM yyyy, HH:mm'`, `'PPpp'`, etc.)
- `new Date(x).toLocaleString()` / `toLocaleDateString()` calls in exports (e.g. `src/lib/reports/exportExcel.ts`, `exportPdf.ts`, `Dashboard.tsx`, `VendorList.tsx`, `RegistrationStatusTracker.tsx`, `ApprovalTimeline.tsx`, approval pages, `AuditLogs.tsx`, `AdminInvitations.tsx`, etc.)
- Excel filename date stamps stay as compact `ddMMyyyy` (not user-facing text).

Input-type `<input type="date">` values remain ISO (`yyyy-MM-dd`) — browser requirement, not a display format.

---

## Out of scope

- No changes to approval logic, filters, permissions, or backend.
- No redesign of the review popup.
- No change to date pickers' internal value format.
