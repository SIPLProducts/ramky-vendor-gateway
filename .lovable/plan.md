## Problem

The WTax Type "Search" icon currently opens a `Popover` inside the SAP Field Confirmation dialog. The requirement is a **separate modal popup** (like SAP Field Confirmation) that appears on top, always calls the `Fetch_Withholding_TaxType` API, and stays open until the user selects a record or explicitly closes it.

## Fix — `src/components/sap/SapFieldsDialog.tsx` only

### 1. New `WithholdingTaxSearchDialog` component
A standalone modal Dialog (using shadcn `Dialog`) with:
- **Header:** "Withholding Tax Type Search" + subtitle "Select a withholding tax type for country {LAND1}".
- **Body:**
  - Status line: "N entries found for {country}" (or "N entries — showing all countries" fallback).
  - Loading spinner state / Error state with Retry button (re-invokes `sap-fetch-withholding-tax`).
  - Search input (filters by TAXTYPE / TEXT40 / LAND1).
  - Scrollable table with columns: **WTax Type | Description (TEXT40) | Country (LAND1)**, styled like SAP F4 helper (matches screenshot 2).
  - Rows are clickable; single-click selects.
- **Footer:** Cancel button only. Dialog closes only via Cancel (X), ESC, or record selection — never by clicking outside the parent dialog's overlay.
- Uses `onOpenChange` guarded so backdrop-click still works (standard Dialog behaviour), but no auto-close on data load / re-render.

### 2. Wire-up in `WithholdingTaxSection`
- Remove the per-row `Popover` + `Command` block around the Search icon.
- Search icon button opens `WithholdingTaxSearchDialog` for the active row index.
- On select: populate `witht` = TAXTYPE, `text40` = TEXT40, default `wt_withcd` = TAXTYPE if empty, `qland` = LAND1 or vendor country. Then close the search dialog.
- Search button is always enabled — clicking always opens the new dialog, which triggers a fetch if data isn't already loaded (or was previously errored).

### 3. Data source (unchanged)
- Continue using existing `fetchWtTypes` (calls `sap-fetch-withholding-tax` edge function).
- `wtAll` / `wtFiltered` state stays in `SapFieldsDialog` and is passed as props to the new search dialog.
- Country resolution logic unchanged.

## Out of scope
- No edge-function changes.
- No changes to payload builder, MultipleSapSyncDialog, or the SAP Field Confirmation dialog itself.
- No schema/migration changes.
