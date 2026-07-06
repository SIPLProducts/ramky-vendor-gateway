## Goal

Add a **Withholding Tax** table to the SAP Field Confirmation dialog (SAP Sync popup), placed directly below the "Service-Based Invoice Verification" checkbox. Rows are captured via an F4-style Search that calls the `Fetch_Withholding_TaxType` SAP API config, filtered by the vendor's country, and are pushed to SAP as `WHOLDTAX[]` entries in the sync payload.

## Scope

Only the shared `SapFieldsDialog` (used by SAP Sync, Multiple Sync, and any View → Sync entrypoint) and the SAP payload builder are touched. No changes to vendor registration.

## UI (SapFieldsDialog.tsx)

New section rendered right after the Company Code Data section, before Classification:

```text
Withholding Tax
+------+-------------------+-----------+---------+----------+---+
| WTax | WTax Type         | WTax Code | Subject | Rec.Type | × |
| Type | Description       |           | (chk)   | (Select) |   |
+------+-------------------+-----------+---------+----------+---+
| [Search 🔍] [ Add row ]                                       |
```

- Each row is stored in local state: `{ witht, text40, wt_withcd, wt_subjct, qsrec }`.
- "WTax Type" cell shows the value plus a Search icon button; click opens a lookup popover listing the vendor-country-filtered records.
- Selecting a record populates `witht = TAXTYPE`, `text40 = TEXT40`, and defaults `wt_withcd = TAXTYPE` (user editable), `wt_subjct = 'X'`, `qsrec = 'OT'`.
- "Add row" appends an empty row; each row has a delete (×) button.
- Rec.Type is a Select (`OT`, ` `) so the operator can override.
- Subject is a checkbox mapped to `X` / empty string.

## Vendor Country resolution

- Domestic vendors: use the fixed value `IN` (Ramky group is India-only for domestic).
- International vendors: use `vendor.company_details.country` (already populated during international registration; falls back to `vendor.country`/`reg_country` if present).
- Resolved once when the dialog opens; passed to the lookup popover and stored in each row as `qland` for payload building.

## Lookup data fetch

- `Fetch_Withholding_TaxType` is a saved SAP API config maintained under **Admin → SAP API Settings** (already-supported "Separate SAP API config" path). No new edge function is created.
- When the dialog opens, in parallel with the existing F4 fetch, invoke the existing `dynamic-api-executor` edge function with `{ config_name: 'Fetch_Withholding_TaxType' }` and cache the returned array in local state (`wtRaw`).
- Response shape expected: `[{ LAND1, TAXTYPE, TEXT40 }, ...]`.
- Filter once by `LAND1 === vendorCountry` → `wtOptions`.
- If the API call fails or returns empty for that country, the Search popover shows: "No withholding tax types available for country {X}" with a retry link.

## Search popover

- Reuses the existing `Command` / `Popover` combobox pattern (see `SapMasterCombobox.tsx`).
- Columns: `TAXTYPE — TEXT40`.
- Type-ahead filter over `TAXTYPE` and `TEXT40`.
- On select → populate the row as described above and close the popover.

## Payload wiring (sapPayloadBuilder.ts)

- Extend `SapFieldOverrides` with `withholding: Array<{ witht; wt_withcd; wt_subjct; qsrec; qland }>`.
- In the builder (currently a TODO around line 403), emit:

```json
"WHOLDTAX": [
  { "LIFNR": "", "WITHT": "...", "WT_WITHCD": "...", "WT_SUBJCT": "X", "QSREC": "OT", "QLAND": "IN" }
]
```

- If no rows are entered, emit `"WHOLDTAX": []` (unchanged from today's behaviour).

## Persistence

- Rows are held in dialog-local state only; on Sync click they flow through `onConfirm(overrides)` into the existing sync pipeline. No new DB tables are added in this change. (Persisting captured WTax rows on the vendor record can be a follow-up if needed.)

## Files to change

- `src/components/sap/SapFieldsDialog.tsx` — new section, lookup popover, state, country resolution, extend `SapFieldOverrides`.
- `src/lib/sapPayloadBuilder.ts` — build `WHOLDTAX[]` from `overrides.withholding`.
- (No changes to `MultipleSapSyncDialog` beyond passing through overrides — it already re-uses `SapFieldsDialog`.)

## Out of scope

- Managing the `Fetch_Withholding_TaxType` config itself (admins already do this under SAP API Settings).
- Persisting withholding rows into the `vendors` table.
- Editing withholding rows from View-only screens (dialog is capture-on-sync, matching existing Classification behaviour).
