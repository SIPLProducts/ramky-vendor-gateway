## Goal

Add dedicated F4-style Search popups for **WTax Code** and **Rec.Type** columns in the Withholding Tax grid inside `SapFieldsDialog`, mirroring the existing WTax Type search. Both use the same new SAP API config `Fetch_Withholding_WTX_Code_REC_Type`.

## Scope (single file: `src/components/sap/SapFieldsDialog.tsx` + one new edge function)

### 1. New edge function `supabase/functions/sap-fetch-wtx-code-rectype/index.ts`
- Clone of `sap-fetch-withholding-tax` but for config name `Fetch_Withholding_WTX_Code_REC_Type`.
- Returns the raw upstream JSON plus normalized arrays:
  - `taxcodes`: `[{ LAND1, WITHT, WT_WITHCD, TCDESC }]`
  - `rectypes`: `[{ LAND1, WITHT, QSREC, RCTXT }]`
- Handles multiple raw shapes (top-level `TAXCODE` / `RECTYPE` arrays, `d.results`, etc.), same normalization pattern.
- Registered in `supabase/config.toml` with `verify_jwt = false` (same as the existing WTax fetch function).

### 2. `SapFieldsDialog.tsx` — state + fetch
- Add state: `wtcAll` (TAXCODE array), `wtrAll` (RECTYPE array), plus shared `wtcLoading` / `wtcError` and a `fetchWtCodesRectypes()` that invokes the new function on dialog open.
- Called once alongside `fetchWtTypes()` in the existing `useEffect`.

### 3. Two new dialog components (same visual style as `WithholdingTaxSearchDialog`)
- `WithholdingTaxCodeSearchDialog`
  - Filters `taxcodes` where `LAND1 === vendorCountry` AND `WITHT === row.witht`.
  - Columns: **WTax Code (WT_WITHCD) | Description (TCDESC) | WTax Type (WITHT)**.
  - On select: `updateRow(idx, { wt_withcd: opt.WT_WITHCD, wt_withcd_desc: opt.TCDESC })`.
- `RecTypeSearchDialog`
  - Filters `rectypes` where `LAND1 === vendorCountry` AND `WITHT === row.witht`.
  - Columns: **Rec.Type (QSREC) | Description (RCTXT) | WTax Type (WITHT)**.
  - On select: `updateRow(idx, { qsrec: opt.QSREC, qsrec_desc: opt.RCTXT })`.
- Both mirror `WithholdingTaxSearchDialog` behavior: search input, loading/error/retry, close only on select / Cancel / ESC, empty-state message when no rows match the current WTax Type + Country combination (with a hint to pick a WTax Type first if `row.witht` is empty).

### 4. `WithholdingTaxSection` grid changes
- **WTax Code column**: replace plain `Input` with `Input + Search button` (matches WTax Type pattern). Search button disabled when `row.witht` is empty (tooltip: "Select WTax Type first"). Under the input, show `row.wt_withcd_desc` in small muted text when present.
- **Rec.Type column**: replace the hard-coded `Select` (OT/ST) with `Input + Search button`. Also disabled until `row.witht` is set. Show `row.qsrec_desc` in small muted text below.
- Track two more `openIdx` states (`openCodeIdx`, `openRecIdx`) alongside the existing `openIdx` for WTax Type.

### 5. `WTaxRow` type
- Add optional display-only fields: `wt_withcd_desc?: string`, `qsrec_desc?: string`.
- These are UI-only; the SAP payload builder is unchanged (it already only reads `witht`, `wt_withcd`, `wt_subjct`, `qsrec`, `qland`).

## Out of scope
- No changes to `sapPayloadBuilder.ts`, `MultipleSapSyncDialog.tsx`, or the existing SAP Field Confirmation dialog structure.
- No schema/migration changes. Admin must create the `Fetch_Withholding_WTX_Code_REC_Type` config in SAP API Settings (same flow as the existing WTax Type config).
- No change to the existing `WithholdingTaxSearchDialog`.

## User-facing behavior after change
1. Vendor row → click WTax Type Search → pick a type (existing behavior).
2. Click WTax Code Search on the same row → popup opens, calls `Fetch_Withholding_WTX_Code_REC_Type`, filters TAXCODE by vendor country + selected WITHT, single-click select populates `WT_WITHCD` and shows `TCDESC`.
3. Click Rec.Type Search on the same row → same API, filters RECTYPE by country + WITHT, single-click select populates `QSREC` and shows `RCTXT`.
4. Each search has its own independent popup; the SAP Field Confirmation dialog is untouched.
