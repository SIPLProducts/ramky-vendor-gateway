# Add SAP Classification Fields to Organization Profile

Add a new "SAP Classification" sub-section inside the Organization Profile card on the vendor registration form (`OrganizationStep.tsx`), with the four fields shown in image 2. These values flow through to the SAP `CLASSIFY` block when the vendor is synced.

## New fields

| UI Label | Internal name | Type | Example | Maps to SAP |
|---|---|---|---|---|
| Material Group for Vendors | `materialGroupVendor` | Select (multi or single) — sourced from existing `PRODUCT_CATEGORIES` | Cement | `CLASSIFY.MAT_GRP_VENDOR[].MGV` |
| Vendor Category | `vendorCategory` | Select — `TRADER`, `MANUFACTURER`, `SERVICE PROVIDER`, `DISTRIBUTOR`, `CONTRACTOR` | TRADER | `CLASSIFY.CAT_VENDOR[].CATV` |
| Vendor Location | `vendorLocation` | Select — `INDIAN_STATES` (uppercased on save) | ANDHRA PRADESH | `CLASSIFY.LOCATION_VENDOR[].LOCV` |
| Vendor Identification Source | `identificationSource` | Select — `PRINT MEDIA`, `ONLINE`, `REFERENCE`, `TRADE FAIR`, `EXISTING VENDOR`, `OTHER` | PRINT MEDIA | `CLASSIFY.IDENTIFICATION_SOURCE[].IDS` |

All four fields are required.

## Changes

### 1. Database migration
Add nullable columns to `public.vendors`:
- `material_group_vendor text`
- `vendor_category text`
- `vendor_location text`
- `identification_source text`

### 2. `src/types/vendor.ts`
Extend `OrganizationDetails` with the four new fields and export two new constant arrays: `VENDOR_CATEGORIES` and `IDENTIFICATION_SOURCES`.

### 3. `src/components/vendor/steps/OrganizationStep.tsx`
- Extend the zod schema and default values with the four fields (all required).
- Render a new "SAP Classification" block inside the Organization Profile card (after State), with a 2-column grid containing the four selects.
- Material Group options reuse `PRODUCT_CATEGORIES`; Location options reuse `INDIAN_STATES`.
- Include them in the submit payload.

### 4. `src/hooks/useVendorRegistration.tsx`
Persist the four new fields to the `vendors` row when the Organization step is saved (snake_case mapping).

### 5. `supabase/functions/sync-vendor-to-sap/index.ts`
In the CLASSIFY block, prefer the new dedicated columns over the previous fallbacks:
```
MGV  ← vendor.material_group_vendor || productCats[0]
CATV ← vendor.vendor_category       || vendor.organization_type
LOCV ← vendor.vendor_location       || vendor.registered_state
IDS  ← vendor.identification_source || ""
```
Add `IDENTIFICATION_SOURCE` to the CLASSIFY block when `IDS` is present. `overrides.classify.*` from `SapFieldsDialog` continues to win over both.

### 6. (No change) `SapFieldsDialog.tsx`
Already shows nothing for CLASSIFY in the visible UI — the values now flow automatically from the registration form.

## Out of scope
- Editing existing vendors' classification through a separate admin screen.
- Backfilling historic vendors (existing rows will fall back to organization_type / state until re-saved).
