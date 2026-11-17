# User Audit Report (new screen)

## What you get
A new sidebar item **User Audit Report** (`/user-audit-report`), next to Audit Logs, with the same permission controls as other screens.

### 1. User picker and filters
- Searchable **User** dropdown that lists all portal users (name, email, role, Active/Inactive badge).
- Date range filter (dd-mm-yyyy), Company filter, Status filter.

### 2. User summary header
Shows name, email, role(s), companies, status, last login and when the user was created.

### 3. KPI cards
Vendors invited, vendors created on behalf, approvals, rejections, returns/clarifications, pending in queue, average approval time (hours), and SAP synced count.

### 4. Charts
- Actions over time (line chart, by month)
- Actions by type (donut: Approved, Rejected, Returned, Invited)
- Vendors by current status (bar chart)
- Actions by approval stage (bar chart: Buyer, SCM CO, SCM Head, Finance 1, Finance 2, CEO Office, SAP)

### 5. Detailed tabs (each paged 10/20/30/50, searchable)
- **Vendors**: every vendor linked to the user (invited, owned, or acted on). Columns: Reference No, Vendor Name, GSTIN, PAN, Company, Current Status, SAP Code, Invited On, Submitted On, User's Role in the record. A **View** button opens the existing full vendor details dialog.
- **Approval Actions**: Date/Time, Vendor, Reference, Stage, Action, Comments, Time Taken.
- **Pending Queue**: vendors currently waiting on this user, with how long they have waited.
- **Activity Log**: audit-log entries from this user (action, details, IP, time).

### 6. Excel export
**Export to Excel** downloads one workbook with sheets for Summary, Vendors (full vendor details: all registration fields, bank, GST, PAN, MSME, addresses, contacts, SAP fields), Approval Actions, Pending Queue and Activity Log. File name: `User_Audit_<Name>_<dd-mm-yyyy>.xlsx`. The export respects the active filters.

### Look and feel
Matches the current Fiori style: grey background, white rounded cards, blue accents, Title Case labels, sticky header with user summary, and skeleton loading.

## Access
Visible to Admin, Customer Admin and Sharvi Admin by default, controlled through the new `user_audit_report` permission in Role Permissions. Data stays limited by existing company visibility rules.

## Technical details
- New page `src/pages/UserAuditReport.tsx` with subcomponents under `src/components/user-audit/` (KpiCards, Charts, VendorsTab, ActionsTab, PendingTab, ActivityTab, exportUserAudit.ts).
- Uses existing `recharts`, `xlsx`, shared pagination boundary and `VendorReviewDialog`.
- Data: profiles + user_roles + user_tenants; vendor_invitations (created_by / original_created_by); vendor_approval_history and vendor_approval_progress (acted_by); buyer_approval_flows / approval_matrix_approvers for the pending queue; audit_logs (user_id); vendors joined by id.
- A new backend function `user-audit-report` (admin-only check, service role) gathers the data, so lookups across users work without loosening database rules.
- Route in `App.tsx`, sidebar entry with `screenKey: 'user_audit_report'`, and permission seeded for admin roles.
- Pure aggregation helpers (counts and average approval time) covered by a small test.
