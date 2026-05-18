
# Multi-value Classification (MGV / CATV / LOCV / IDS)

Today the four Classification fields (Material Group for Vendors, Vendor Category, Vendor Location, Vendor Identification Source) are stored as single text columns and rendered as single-select dropdowns. The SAP payload only ever emits one entry per array. The user needs:

1. Vendor can pick **multiple** values per field during registration and they are saved.
2. The SAP Sync popup shows them **disabled** (auto-filled from the vendor record).
3. The SAP Sync API sends each value as its own object inside `MAT_GRP_VENDOR`, `CAT_VENDOR`, `LOCATION_VENDOR`, `IDENTIFICATION_SOURCE`.

## Changes

### 1. Database — add array columns (keep old text columns for back-compat)

New migration on `public.vendors`:
- `material_group_vendors text[]`
- `vendor_categories text[]`
- `vendor_locations text[]`
- `identification_sources text[]`

Backfill: copy the existing single-text column into the new array (`ARRAY[col]` when not null/empty). Old singular columns are kept and continue to be written with the first array element so any legacy reader keeps working.

### 2. Vendor registration form — `src/components/vendor/steps/OrganizationStep.tsx`

- Schema: change the 4 fields from `z.string().min(1, …)` to `z.array(z.string()).min(1, …)`.
- Replace the four `<Select>` blocks with the existing `<MultiSelect />` (`src/components/ui/multi-select.tsx`) using the current option lists (`PRODUCT_CATEGORIES`, `VENDOR_CATEGORIES`, `INDIAN_STATES`, `IDENTIFICATION_SOURCES`).
- Keep the same field names (`materialGroupVendor`, `vendorCategory`, `vendorLocation`, `identificationSource`) but values are now `string[]`.

### 3. Persistence — `src/hooks/useVendorRegistration.tsx`

On save (line ~225) write both shapes:
- `material_group_vendors: arr`, `vendor_categories: arr`, `vendor_locations: arr`, `identification_sources: arr`
- `material_group_vendor: arr[0] || null` (and same pattern for the other three legacy text columns)

On load (line ~417) hydrate the form arrays from the new columns, falling back to `[old_text_col]` when the array is empty (so vendors created before the migration still display correctly).

### 4. SAP Sync popup — `src/components/sap/SapFieldsDialog.tsx`

- Extend `SapFieldOverrides.classify` to `{ MGV: string[]; CATV: string[]; LOCV: string[]; IDS: string[] }`.
- In `buildDefaults` (line ~283) read from the new array columns first, fallback to the singular columns / `product_categories`.
- Render the 4 `ReadOnlyField`s with the joined string (`arr.join(', ')`) — they stay disabled per the previous task.
- Pass the arrays through `overrides.classify` to the edge function.

### 5. SAP payload emission — both builders

`src/lib/sapPayloadBuilder.ts` and `supabase/functions/sync-vendor-to-sap/index.ts`:

- Change `classifyCtx` to hold arrays (`MGV: string[]`, etc.), sourced from the new vendor array columns (fallback to the legacy text column → `product_categories`).
- After `resolveTemplate(...)` returns `row`, **post-process the `CLASSIFY` block**:

```ts
const expand = (arr: string[], key: string) =>
  (arr.filter(Boolean).length ? arr.filter(Boolean) : [""]).map(v => ({ [key]: v }));

if (row.CLASSIFY) {
  row.CLASSIFY.MAT_GRP_VENDOR      = expand(classifyCtx.MGV,  "MGV");
  row.CLASSIFY.CAT_VENDOR          = expand(classifyCtx.CATV, "CATV");
  row.CLASSIFY.LOCATION_VENDOR     = expand(classifyCtx.LOCV, "LOCV");
  row.CLASSIFY.IDENTIFICATION_SOURCE = expand(classifyCtx.IDS, "IDS");
}
```

This keeps the existing JSON template untouched (which today only renders one placeholder per array) and guarantees every selected value is emitted as its own object — matching the payload shape in the user's message.

### 6. Deploy

Redeploy `sync-vendor-to-sap` edge function after the changes.

## Files touched

- `supabase/migrations/<new>.sql` (new array columns + backfill)
- `src/components/vendor/steps/OrganizationStep.tsx` (multi-select UI + schema)
- `src/hooks/useVendorRegistration.tsx` (load/save arrays)
- `src/components/sap/SapFieldsDialog.tsx` (array overrides, joined display)
- `src/lib/sapPayloadBuilder.ts` (CLASSIFY post-processing)
- `supabase/functions/sync-vendor-to-sap/index.ts` (CLASSIFY post-processing, deploy)

## Out of scope

- Changing the SAP payload template stored in `sap_payload_templates`.
- Removing the legacy singular text columns (kept for back-compat; can be dropped in a follow-up).
- Any change to the F4 master-data lookup or approval workflow.
