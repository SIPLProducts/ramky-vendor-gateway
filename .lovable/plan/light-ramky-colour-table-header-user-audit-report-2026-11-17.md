# Light Ramky-Colour Table Header (User Audit Report)

## What changes
- Replace the solid dark-green header with a soft, light gradient using Ramky logo colours: pale blue -> pale orange/cream -> pale green.
- Header text becomes dark Ramky blue, bold, small uppercase; remove the rounded "pill" look per column so the header reads as one clean continuous bar.
- Thin Ramky-blue bottom border under the header for clear separation.
- Sticky View column header uses the same light gradient end colour so it blends in.
- Apply the same light header style to Excel (light blue fill, dark blue bold text) and PDF (light blue header, dark blue text) so downloads match the screen.

## Not changed
- Table rows, action colours, filters, data and columns stay as they are.

## Technical details
- `src/pages/UserAuditReport.tsx`: update the `TableHeader`/`TableRow` gradient and the `TH` class (text colour, no per-cell radius/background).
- `src/components/user-audit/exportUserAuditPdf.ts`: `headStyles` fill light blue (e.g. 232,242,251), text Ramky blue.
- `src/components/user-audit/exportUserAudit.ts`: header cell fill `E8F2FB`, font Ramky blue, bottom border blue.
