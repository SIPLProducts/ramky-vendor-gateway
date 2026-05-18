# Plan: Persist Step-1 Classification Selections to Draft

## The problem

In the response payload you shared, the four classification fields are empty arrays:

```
"material_group_vendors": [],
"vendor_categories": [],
"vendor_locations": [],
"identification_sources": []
```

But you confirm the UI shows them selected (Castings & Forgings, Service Provider, Arunachal Pradesh, Trade Fair, etc.).

### Root cause

`OrganizationStep.tsx` keeps its values inside a local `react-hook-form` instance. Those values are only pushed into the parent `formData` state in `VendorRegistration.tsx` when the user clicks **Next** (via `handleFormSubmit` → `onNext`). The debounced autosave in `VendorRegistration.tsx` only fires when `formData` changes — so anything typed/selected in Step 1 (including the four classification multi-selects, `industry_type`, `product_categories`, etc.) is **never autosaved** until Next is clicked.

That is why the DB row still has `status: "draft"`, `industry_type: ""`, `product_categories: []`, and the four classification arrays empty even though the UI looks filled.

The save and load code, the DB columns (`material_group_vendors`, `vendor_categories`, `vendor_locations`, `identification_sources`), the SAP payload `expand()`, and the SAP dialog read-only display are all already correct. The gap is purely the Step-1 → parent live sync.

## What I will change

Wire `OrganizationStep` to push its watched values to the parent on every change, so autosave picks them up immediately — just like later steps would.

### 1. `src/components/vendor/steps/OrganizationStep.tsx`
- Accept a new optional prop `onLiveUpdate?: (partial: { organization: OrganizationDetails; statutory: StatutoryDetails }) => void`.
- Subscribe to `watch` (react-hook-form) and, on every change, debounce ~400ms then call `onLiveUpdate` with the same shape that `handleFormSubmit` already builds.
- Keep `onNext` behavior unchanged (still submits on Next, still validates).

### 2. `src/pages/VendorRegistration.tsx`
- Pass `onLiveUpdate` into `<OrganizationStep />` that does `setFormData(prev => ({ ...prev, organization, statutory }))`.
- The existing debounced autosave will see the `formData` change and persist the four classification arrays (and every other Step-1 field) to the draft row.

### 3. No DB / no edge function / no SAP payload changes
The columns, save mapping (`useVendorRegistration.tsx` lines 229–232), SAP dialog defaults, and `sapPayloadBuilder` `expand()` are all already correct and were verified against the schema.

## Out of scope

- Changing other steps (they already commit on Next, same pattern; can be revisited if you also want them live-saved).
- Any DB migration — the four `text[]` columns already exist.
- SAP payload shape — already emits `{ MGV: "..." }` objects per array entry.

## Verification

After the change:
1. Open a draft, select 2+ values in each of the four classification multi-selects.
2. Wait ~3 seconds (live update 400ms + autosave 2500ms).
3. Re-query the vendor row — the four `*_vendors / *_categories / *_locations / *_sources` arrays should now contain the selected values.
4. Open the SAP Sync dialog → Classification section will show the same values (disabled).
5. The Sync-to-SAP payload `CLASSIFY.MAT_GRP_VENDOR` etc. will contain one object per selection.
