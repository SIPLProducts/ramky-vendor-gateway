# Make PDF and Excel Match the Screen (User Audit Report)

## What changes
Both downloads will look like the on-screen page: a user card on top, then the same audit table.

### PDF
- Header: Ramky logo top-left, "User Audit Report" title, generated date, blue/orange/green stripe (kept).
- User card like the screen: name with status, plus Email, Role, Last Login and Created, in one light blue-to-green box with a blue left accent. This replaces the current grid of label/value cells.
- Table: same columns in the same order as the screen (Action Date, Action, Ref No, Vendor Name, GSTIN, Company, Invited By, Approval Stage, Comments, Current Vendor Status, SAP Code). Light Ramky header, text kept on one line where it fits, rows coloured by action the same way as the screen.
- Only the filtered and searched rows currently showing on screen are exported.

### Excel
- One main sheet called "User Audit". It starts with the logo-colour title row, then the user details block (Name, Status, Email, Role, Last Login, Created), then the same table with the same columns, light header and action colours.
- Remove the extra Summary, Vendors, Approval Actions, Pending Queue and Activity Log sheets so the workbook matches the screen.

## Technical details
- `UserAuditReport.tsx`: pass the user card fields and the same visible column list and rows into both export functions.
- `exportUserAuditPdf.ts`: draw the user card with rounded rect and text, then autoTable using the passed columns.
- `exportUserAudit.ts`: build one sheet with aoa (title, user block, blank row, header, rows) and apply the existing styles.
