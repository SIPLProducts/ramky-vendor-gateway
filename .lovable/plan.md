# User Audit Report: Compact Layout, Invited By, PDF, Gradient Visuals

## 1. Fit on screen (compact)
- Smaller page title, card padding (p-3), gaps (gap-2/3) and table text (text-xs, tighter cell padding).
- KPI tiles: smaller height, icon and number size; 4 per row on desktop, 8 in one row on wide screens.
- Charts: height reduced from 256px to about 200px; filters row tightened.

## 2. Invited By / On Behalf for approvers
- Vendors table gets an "Invited By" column for every user type, showing the buyer's name, plus an "On Behalf" tag when the vendor was created on behalf.
- For a buyer it still shows "Self" / "On Behalf"; for approvers (SCM CO, SCM Head, Finance, CEO Office, SAP Team) it shows which buyer invited the vendor.
- Same column added to Approval Actions and Pending Queue tabs and to the Excel/PDF exports.

## 3. PDF download
- New "Download PDF" button next to Excel export (uses existing jsPDF in the project).
- PDF contains: user summary, KPI figures, and Vendors, Approval Actions, Pending Queue, Activity Log tables, landscape, with page numbers and dd-mm-yyyy dates.

## 4. Gradient colours
- KPI tiles: each tile gets its own soft gradient (blue, green, amber, red, teal, violet) built from theme colours.
- Charts: gradient fills for bars, pie slices and line area.
- Table headers: light gradient background; status badges coloured by status.

## 5. Polished, modern look
- Gradient icon badges, soft shadows, hover lift on tiles, gradient header strip on the user card, coloured tab bar, rounded bordered tables.

## 6. Highlight pending vendors in the Vendors table
- Rows where the vendor is currently pending with this user get an amber tinted background and a left amber border, plus a "Pending With User" badge.
- Small legend above the table: Pending With User / Approved / Rejected / Other. Rejected rows tinted red, approved/SAP-synced rows tinted green.

## Technical details
- File: `src/pages/UserAuditReport.tsx`; new `src/components/user-audit/exportUserAuditPdf.ts` (jsPDF + autotable).
- Invited By name: resolve `vendor_invitations.created_by` to profile names from the already-loaded profiles list; on-behalf from `created_on_behalf`.
- Pending set derived from existing `pending` state (vendor_id set). Gradients via SVG `<linearGradient>` in recharts and Tailwind `bg-gradient-to-br from-primary/15 to-primary/5` tokens (no hardcoded colours).
- Data access unchanged (existing RLS).
