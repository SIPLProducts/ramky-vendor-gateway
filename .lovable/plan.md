# User Audit Report – Dropdown, Labels And Headers Cleanup

## 1. User Dropdown Look
- Highlighted/hover option: soft light-blue background with dark blue text (no bright green block); selected user shows a blue tick and bold name.
- Each option: name on line 1, email and role in small grey text on line 2; Inactive users get a small grey "Inactive" tag.
- Search box with light border and icon; list max height with smooth scroll; clean white panel with rounded corners and soft shadow.
- Same light style applied to the Company and Vendor Status dropdowns.

## 2. Action Labels
- Show "Pending" instead of "Pending With User" (table, filter chips, PDF, Excel).
- Pending pill becomes light amber with dark text (no strong orange gradient); Approved light green, Rejected light red, Returned light amber, Invited light blue.

## 3. Clear Column Headers (based on the selected user)
| Old | New | Meaning |
|---|---|---|
| Action Date | Action Taken On | Date/time the selected user approved/rejected/returned/invited. For Pending rows: "Pending Since" date (when it reached this user). |
| Action | User Action | What the selected user did (Pending / Approved / Rejected / Returned / Invited / Created On Behalf) |
| Approval Stage | Stage Handled | The approval level at which this user acted |
| Comments | User Comments | Comments entered by this user |
| Current Vendor Status | Vendor Status (Now) | Latest status of the vendor today |
- Ref No, Vendor Name, GSTIN, Company, Invited By, SAP Code stay as is.
- Small note above the table: "Showing actions performed by <User Name>. Pending = vendors currently waiting for this user's approval."

## 4. PDF And Excel
- Same new headers, labels and light colours as the screen.

## Technical
- Edit `src/pages/UserAuditReport.tsx` (CommandItem classes `data-[selected=true]:bg-primary/10 data-[selected=true]:text-foreground`, TYPE_LABEL, TYPE_STYLE pills, header text), `exportUserAuditPdf.ts`, `exportUserAudit.ts`. Display-only; no data/logic changes.
