## Goal

Match the GST filing-status table to the uploaded reference (4 columns, centered, clean borders) and use the uploaded `3.GST_Returns_Declaration.docx` as the new self-declaration template.

## Changes

### 1. Table layout — `src/components/vendor/kyc/GstFilingStatusTable.tsx`

Replace the current 5-column table with a 4-column layout matching the reference:

| Financial Year | Tax Period | Date of filing | Status |

- Remove the **Return Type** column.
- Keep only the most recent row per `tax_period + financial_year` (prefer GSTR3B over GSTR1 so each period appears once, just like the reference shows a single line per month).
- Center-align headers and cells.
- Bordered, bold header row (`bg-muted`, dividers between cells).
- Status rendered as plain text "Filed" / "Not Filed" (no badge) to mirror the screenshot. Color "Not Filed" red, "Filed" stays default.
- Keep the small card wrapper + scroll container.

### 2. Date format

Convert `date_of_filing` from `2026-04-21` to `21/04/2026` (DD/MM/YYYY) to match the reference (`11/05/2026`).

### 3. Declaration template

Replace `public/templates/gst-self-declaration.docx` with the uploaded `user-uploads://3.GST_Returns_Declaration.docx`. The existing download links in both `GstKycTab` (No branch) and `GstDeclarationDialog` already point to `/templates/gst-self-declaration.docx`, so no code change is needed — only the file swap.

## Out of scope

- No changes to verification logic, filing-status gating, or the PAN auto-advance.
- No changes to the API mapping (still reads `data.filing_status.0`).