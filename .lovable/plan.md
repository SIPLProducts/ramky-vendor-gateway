# User Audit Report: Remove Companies, Single Combined Table

## 1. Remove Companies
- Remove the long "Companies" list from the user card. The card stays one short line: Name, Status, Email, Roles, Last Login, User Since.
- Also remove "Companies" from the Excel/PDF summary.

## 2. Replace the 4 tabs with one clear table
The Vendors, Approval Actions, Pending Queue and Activity Log tabs become **one combined table**, showing every record for the user, newest first.

Columns (fit the screen width, no sideways scrolling):

| Date / Time | Type | Reference No | Vendor | Invited By | Stage | Vendor Status | Comments / Details | Time Taken / Waiting | View |

- **Type** is a coloured pill, and each row gets a matching light tint and left border:
  - Invited: blue
  - Created On Behalf: violet/indigo-tinted blue
  - Approved: green
  - Rejected: red
  - Returned / Clarification: amber
  - Pending With User: orange, bold, always shown at the top
  - Activity (login, edits, etc.): grey
- **Quick filter chips** above the table with counts, e.g. "All (120) · Pending (3) · Approved (40) · Rejected (5) · Returned (8) · Invited (20) · Activity (44)". Click a chip to show only that type.
- Long comments and details are cut to one line, and the full text shows on hover.
- Smaller font (11–12px), tight rows and a sticky header. 10 rows per page by default, so the table fits on screen without page scrolling.
- The search box stays and searches across all columns.

## 3. Exports
- Excel: a new "All Records" sheet in the same column order as the combined table. The existing detail sheets stay.
- PDF: the combined table, colour-coded by type, replaces the four separate sections.

## Technical details
- File: `src/pages/UserAuditReport.tsx`. Build a `combinedRows` memo from the existing `invites`, `actionRows`, `pendingRows`, `activityRows`, normalised to `{ at, type, ref, vendor, vendorId, invitedBy, stage, status, details, duration }`. Sort pending first, then by date descending.
- Use one `usePaged(filteredCombined)` and remove the Tabs.
- Type colour map uses theme tokens only (primary, success, destructive, warning, muted).
- `table-fixed` with percentage column widths and `truncate` plus `title` for long cells, so there is no horizontal scroll.
- Update `exportUserAudit.ts` and `exportUserAuditPdf.ts` to accept the combined rows.
- Data loading and access rules stay the same.
