# Make Approved / Pending column clear in User Audit Report

## Current state
Approved, Pending, Rejected and Returned are already shown, but inside the column renamed to **"User Action"** (2nd column, coloured tag). The rename made it hard to find.

## Changes
1. Rename "User Action" to **"Approval Status"** (values: Approved, Pending, Rejected, Returned, Invited) — on screen, PDF and Excel.
2. Move it to the **first column** so it is the first thing seen, before the date.
3. Rename the date column to **"Action Date"** with "(Pending Since)" for pending rows.
4. Keep the coloured filter chips above the table (Approved / Pending / Rejected counts) and make them clearly labelled "Filter by Approval Status".

## Technical
- `src/pages/UserAuditReport.tsx`: header order/labels and `combinedExport` keys.
- `exportUserAuditPdf.ts` / `exportUserAudit.ts`: update the key used for row colouring from `User Action` to `Approval Status`.
