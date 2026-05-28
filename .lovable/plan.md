# Reset Classification on SAP Sync popup open

## Problem
When opening the SAP Sync popup (`SapFieldsDialog`), the Classification fields (Material Group, Category, Location, Identification Source) are pre-populated from vendor data (`material_group_vendors`, `vendor_categories`, `product_categories`, etc.). User wants these to always start empty so values must be selected manually each time, and only the freshly selected ones are sent to SAP.

## Change
File: `src/components/sap/SapFieldsDialog.tsx`

In `buildDefaults()` (lines 309–324), replace the entire `classify` initializer with empty arrays:

```ts
classify: { MGV: [], CATV: [], LOCV: [], IDS: [] },
```

Remove the vendor-derived `toArr` / `cats` / `mgv` / `catv` / `locv` / `ids` logic — no longer needed for defaults.

## Notes
- `MultipleSapSyncDialog` already initializes with empty arrays — no change there.
- Save/submit flow already sends only `form.classify` values, so once defaults are empty, only manually selected values reach SAP.
- No backend / payload-builder changes needed.
