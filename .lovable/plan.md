## Goal

Wire SAP "Classification F4s" data into the form so all 6 fields (4 Classification + Country + Region) come **exclusively from SAP** — no hardcoded fallbacks anywhere.

Coverage:
- **International tab → Company Details**: Country, Region (dependent)
- **Organization Profile (Domestic) → Classification**: Material Group, Vendor Category, Vendor Location, Vendor Identification Source
- **International tab → Classification**: same 4 fields

## SAP block → field mapping

| Form field | SAP block | Code | Label |
|---|---|---|---|
| Country | `COUNTRY` | `LAND1` | `LANDX` |
| Region | `REGION` | `BLAND` (filtered by `LAND1`) | `BEZEI` |
| Material Group for Vendors | `MAT_GRP_VENDOR` | `ATWRT` | `ATWTB` |
| Vendor Category | `CAT_VENDOR` | `ATWRT` | `ATWTB` |
| Vendor Location | `LOCATION_VENDOR` | `ATWRT` | `ATWTB` |
| Vendor Identification Source | `ID_SOURCE_VENDOR` (confirm exact key — your message was truncated at `"ID`) | `ATWRT` | `ATWTB` |

## Changes

### 1. `supabase/functions/sap-master-fetch/index.ts`
Extend ingestion to cache 6 new master types from the same SAP response:

- `COUNTRY` → `master_type='country'`, `code=LAND1`, `description=LANDX`
- `REGION` → `master_type='region'`, `code='${LAND1}_${BLAND}'` (composite to satisfy the existing `(master_type, code)` unique key — `BLAND` repeats across countries), `description=BEZEI`, `extra={ LAND1, BLAND, BEZEI }`
- `MAT_GRP_VENDOR` → `master_type='material_group_vendor'`, `code=ATWRT`, `description=ATWTB`
- `CAT_VENDOR` → `master_type='vendor_category'`, `code=ATWRT`, `description=ATWTB`
- `LOCATION_VENDOR` → `master_type='vendor_location'`, `code=ATWRT`, `description=ATWTB`
- `ID_SOURCE_VENDOR` → `master_type='identification_source'`, `code=ATWRT`, `description=ATWTB`

Include each in the response summary so the SAP Master Data admin page shows them.

### 2. `src/components/vendor/steps/international/IntlCompanyDetailsStep.tsx`
- Country dropdown: `useSapMasterData('country')` only — remove the manual `<Input>` fallback. If SAP cache is empty, show a disabled select with message "Sync SAP master data first".
- Region dropdown: filter strictly by `extra.LAND1 === selectedCountry`. Remove the "show all if filter empty" fallback. Region value saved = raw `extra.BLAND`. Label = `BLAND — BEZEI`. Disabled until country chosen; cleared when country changes.

### 3. `src/components/vendor/steps/OrganizationStep.tsx` (Domestic Classification section)
Replace the 4 `MultiSelect` option arrays — **delete** the hardcoded constants used by these fields (`PRODUCT_CATEGORIES`, `VENDOR_CATEGORIES`, `INDIAN_STATES`, `IDENTIFICATION_SOURCES`) and bind directly to:

- `useSapMasterData('material_group_vendor')`
- `useSapMasterData('vendor_category')`
- `useSapMasterData('vendor_location')`
- `useSapMasterData('identification_source')`

Map rows → `{ value: code, label: description ?? code }`. If a master_type cache is empty, render the MultiSelect with `options=[]` and a "No SAP values — sync SAP master data" hint under the field (no hardcoded list shown).

### 4. `src/components/vendor/steps/international/IntlClassificationStep.tsx`
Replace the 4 free-text `Input` fields with the same `MultiSelect` component, backed by the same 4 SAP master types. Update the local zod schema + live-update wiring to use `string[]` directly (drop the comma-join/split helpers). Saved `InternationalClassification` shape unchanged (already `string[]`).

## Technical notes

- `useSapMasterData` already accepts any `master_type` — no hook change.
- Composite `code` for regions keeps the existing unique constraint — no migration.
- After deploy, the admin must click **Refresh from SAP** once on the SAP Master Data screen to populate the 6 new caches. Until then the affected dropdowns show "no values — sync required" (by design, per your instruction to never hardcode).
- I'll confirm the exact 4th SAP block key (`ID_SOURCE_VENDOR` vs other) before editing — your last message was cut off mid-key.

## Out of scope

- No DB schema/migration changes.
- No changes to saved form shapes or field names.
- Hardcoded option constants used elsewhere (other steps) are left untouched.
