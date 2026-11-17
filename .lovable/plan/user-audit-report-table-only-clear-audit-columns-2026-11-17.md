# User Audit Report: Table Only, Clear Audit Columns

## What changes on screen
1. **Remove** all tiles (Approvals, Rejections, Returns, Pending, Avg Time, Vendors Linked, Activity Records).
2. **Remove** the four charts: Activity Over Time, Actions By Type, Vendors By Current Status and Actions By Approval Stage.
3. **Remove "Activity" rows.** These were system log entries, such as role changes, user edits and logins, which made the table confusing. The table now shows only what the user did on vendors.
4. **Remove the Time column.**

The page becomes: Filters, a one-line user card, then the audit table.

## Audit table: what the user did
Each row is one action by the selected user on a vendor:
- **Invited** / **Created On Behalf**: buyer invited the vendor (blue)
- **Approved**: green
- **Rejected**: red
- **Returned For Clarification**: amber
- **Pending With User**: orange, shown at the top. The vendor is waiting for this user's action.

Columns (fit the screen, small font):

| Action Date | Action | Ref No | Vendor Name | GSTIN | Company | Invited By | Approval Stage | Comments | Current Vendor Status | SAP Code | View |

- Filter chips above the table with counts: All, Pending, Approved, Rejected, Returned, Invited. These replace the tiles.
- Search across all columns, 10 rows per page, eye icon opens the vendor details.

## Exports
- Excel and PDF use the same columns and the same rows (no Activity rows).
- The summary block keeps the counts per action, so the numbers are still available in downloads.

## Technical details
- `src/pages/UserAuditReport.tsx`: delete the KPI grid, `tiles`/`ALL_TILES`, the SVG gradients and chart cards, and the timeline/type/status/stage memos. Drop the activity branch from `combined`. Add `gstin`, `company`, `sap` fields. Remove the `duration` column. Rename "Returned" to "Returned For Clarification" in the display label.
- The audit log query and activity state stay loaded only if still needed elsewhere; otherwise remove them.
- Unused recharts imports are removed.
