## Goal

Make every vendor View/Preview surface show the same complete vendor information — including Turnover in the Financial card and a new **Classification Details** card immediately after **Bank Details**.

## Where the changes apply

These three components render every "View / Preview" popup across the app (Vendor List, Approvals — Buyer/SCM/CEO/Finance1/Finance2, SAP Sync, Reports drill-in, etc.), so updating them fixes every entry point consistently:

1. `src/pages/VendorList.tsx` — inline "All Details" tab (the popup shown in the screenshot)
2. `src/components/vendor/VendorReviewDialog.tsx` — approval / SAP Sync review dialog
3. `src/components/vendor/VendorSubmissionPreviewDialog.tsx` — read-only preview dialog

## Changes

### A. Financial Information — Turnover

- `VendorList.tsx` financial card: already shows Turnover Year 1/2/3 in raw ₹. Update labels to Indian FY (e.g., `Turnover FY 2024-25`) using `formatIndianFy(getLastThreeCompletedIndianFyStartYears())`, and format value as `₹ X Lakhs` for consistency with the other two dialogs. Also add `Credit Period Expected`.
- `VendorReviewDialog.tsx` and `VendorSubmissionPreviewDialog.tsx`: already display Turnover — no change needed beyond verifying they render (they do).

### B. New "Classification Details" card (after Bank Details in all three surfaces)

Data source = vendor row columns (populated at registration or edited in the SAP Fields dialog). Displayed as two sub-groups matching SAP structure:

**Vendor_Details**
- Material Group for Vendors → `vendor.material_group_vendors` (text[])
- Vendor Category → `vendor.vendor_categories` (text[])

**Vendor_CFSTMT**
- Vendor Cash Flow → `vendor.vendor_cashflow` (text[])
- Tier Category → `vendor.tier_category` (text[])

Rendering rules:
- Show each value as comma-separated codes; render `-` if the array is empty.
- Use the same section header style already used in each dialog (icon + title, then a grid of label/value rows). Icon: `Tags` from `lucide-react`.
- Card is inserted directly under the Bank Details card and above Financial Information in all three files.

### C. Consistency sweep

- Confirm the three dialogs are the only view/preview surfaces (grep confirmed: SAPSync, VendorList, StageApprovalView all use these). No other module needs edits.
- No changes to registration form, schema, or business logic.

## Out of scope

- No DB migration (all four columns already exist).
- No changes to SAP payload / sync behavior.
- No new editing UI — classification remains editable only in the SAP Fields dialog.
