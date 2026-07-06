## Problem

In SAP Sync, the Withholding Tax "Search" icon does not reveal any data. Investigation shows the edge function `sap-fetch-withholding-tax` is working and returns 134 SAP records (keys `LAND1`, `TAXTYPE`, `TEXT40`). The failure is on the client in `SapFieldsDialog.tsx`:

1. The search button is `disabled={options.length === 0}`, and `options` = `wtFiltered` (records where `LAND1 === vendorCountry`). If the vendor's resolved country doesn't match any row (e.g. missing/blank country for an international vendor, or `IN` records not yet loaded when the popover is opened), the button is inert and the user sees nothing happen.
2. Even when it opens, the popover shows no loading / error / empty state, so a failed fetch is invisible.
3. Field-name matching is strict-case; harmless today but brittle.

## Fix — `src/components/sap/SapFieldsDialog.tsx` only

**Search button**
- Always enable the Search icon; open the popover regardless of options length.

**Popover contents (mimic SAP F4 helper in screenshot 2)**
- Header row inside the popover: "Withholding Tax Type — N Entries found" (shows filtered count / total).
- While loading: spinner + "Loading withholding tax types…".
- On error: red inline message with the edge-function error text and a "Retry" button that re-invokes `sap-fetch-withholding-tax`.
- When the country filter yields zero rows but the full list is non-empty: show all rows and a subtle note "No entries for country {X} — showing all".
- CommandList rendered as a compact two/three-column layout: **WTax Type** | **Name (TEXT40)** | **Country (LAND1)**, matching the SAP lookup style.
- Increase popover width (e.g. `w-[520px]`) and cap list height with scroll.

**Data handling**
- Normalize incoming records to `{ LAND1, TAXTYPE, TEXT40 }` case-insensitively (accept `Land1`/`land1`, etc.) before storing in `wtAll`.
- Compute `wtFiltered` as before; expose both `wtFiltered` and `wtAll` to the section so the popover can gracefully fall back.
- Keep on-select behaviour: populate `witht`, `text40`, default `wt_withcd` to TAXTYPE, and set `qland` from the row's LAND1 (or vendor country).

**Vendor country resolution** (unchanged behaviour, hardened)
- Domestic → `IN`.
- International → first non-empty of `international_data.company.country`, `international_data.address.country`, `country`, uppercased and trimmed.

## Out of scope
- No edge-function changes (already returns correct records).
- No payload-builder or MultipleSapSyncDialog changes.
- No new tables or migrations.
