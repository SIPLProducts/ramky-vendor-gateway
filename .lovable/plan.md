
Update `src/pages/VendorList.tsx` only. No backend, RLS, or approval-logic changes.

## 1. Search input placeholder
Replace `"Search by name, GSTIN, or ID..."` with:
`"Search by Buyer Company, Invited By, Vendor, GSTIN, Location, SAP Code"`

Extend the filter predicate so `searchTerm` also matches (case-insensitive):
- Buyer Company name/code (via `getBuyerCompanyName`)
- Invited By name (`vendor.invited_by?.name`)
- Vendor display name (`pickVendorDisplayName(vendor)`)
- GSTIN (already)
- Location = `registered_city, registered_state`
- SAP Code (`sap_vendor_code`)

Remove ID-based match.

## 2. Column reorder
New table header order:
`Buyer Company | Invited By | Vendor | GSTIN | Location | SAP Code | Status | Actions`

Move the `Buyer Company` and `Invited By` cells before `Vendor`. Update the empty-state `colSpan` to stay at 8.

## 3. Actions column
- Remove the Preview (FileText) icon button and the `previewVendorId` state + `VendorSubmissionPreviewDialog` render.
- Keep the Eye (View) button. Add a `title="View"` tooltip.
- Keep the Comments (MessageSquare) button with its existing tooltip.

The View dialog stays the existing details dialog (which already mirrors the approval view's tabs: All Details / Documents / Validations — the same content shown in approval popups).

## 4. Export
Replace the current CSV stub with a real Excel export using `xlsx` (already used in `Dashboard.tsx` and `exportExcel.ts`):
- Button label: `Export Excel` (icon unchanged).
- Build rows in the new column order plus PAN fields already exported, write via `XLSX.utils.json_to_sheet` → `XLSX.writeFile(wb, 'vendors_YYYYMMDD_HHmm.xlsx')`.
- Export the currently `filteredVendors` set (respects search + status + buyer filters).

## Technical notes
- No changes to `useVendors`, table types, or dialogs beyond removing the preview trigger.
- Import `* as XLSX from 'xlsx'` and `format` from `date-fns` (already available in project).
