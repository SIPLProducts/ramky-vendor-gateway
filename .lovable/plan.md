## Goal
Fix the Reports screen date filters and add a three-way report mode selector.

## Changes (Reports.tsx only)

### 1. Replace popover-button date pickers with a working range picker
Current: two `<Button>` triggers opening a `Calendar mode="single"` inside `Popover` — clicks don't register reliably.

New: single shadcn **date-range picker**:
- One trigger button labeled "From – To" (or "Pick date range")
- `<Calendar mode="range" selected={range} onSelect={setRange} numberOfMonths={2} className="p-3 pointer-events-auto" />`
- `Popover` with `modal={true}`, trigger button `type="button"`
- Range maps to existing `from` / `to` filter state (ISO strings: `range.from` → start of day, `range.to` → end of day)
- "Clear" button next to the trigger to reset the range

### 2. Replace the current Vendor/Approval tabs with a 3-option mode selector
Add a `RadioGroup` (segmented control style) at the top of the report config card:
- **Vendor Report** — shows only the vendor detail sections (Organization, GST, PAN, MSME, Bank, Addresses, Contacts, Classification, Tax & Compliance, International, Documents)
- **Approval Flow Report** — shows only the approval timeline / matrix
- **Both** — shows vendor sections first, then approval flow below

State: `reportMode: 'vendor' | 'approval' | 'both'` (default `'both'`).

Apply to:
- Single Vendor view: conditionally render vendor cards block and/or approval timeline block based on mode
- All Vendors view: 
  - `vendor` → vendor columns table only
  - `approval` → approval matrix table only
  - `both` → vendor columns + approval matrix (existing combined view)
- Export buttons pass the selected mode to `exportVendorExcel` / `exportVendorPdf` (existing functions already accept `'vendor' | 'approval'`; add `'both'` handling that includes all columns/sheets)

### 3. Export signature update
- `exportExcel.ts` and `exportPdf.ts`: widen `reportType` param to `'vendor' | 'approval' | 'both'`. For `'both'`, emit both the vendor sheet/page and the approval sheet/page (already done for single-vendor; extend to multi-vendor).

## Out of scope
Data loader, approval matrix logic, RLS, registration pages, SAP, role permissions.

## Files
- `src/pages/Reports.tsx` (main edit)
- `src/lib/reports/exportExcel.ts` (type widen + `'both'` branch)
- `src/lib/reports/exportPdf.ts` (type widen + `'both'` branch)
