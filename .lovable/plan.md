## Problem

Looking at the request body sent to `sync-vendor-to-sap`:

```
"classify": { "MGV": "", "CATV": "", "LOCV": "Andhra Pradesh", "IDS": "" }
```

…three of the four CLASSIFY values are empty even though the vendor (`SHARVI INFOTECH PRIVATE LIMITED`) has `product_categories = [Cables & Wires, Cement, Conductors]` and `organization_type = Private Limited` in the DB. Reasons:

1. `SapFieldsDialog` builds `classify` defaults with hard-coded empty strings for `MGV`, `CATV`, `IDS` — it never reads the vendor's own data or the new dedicated columns (`material_group_vendor`, `vendor_category`, `identification_source`).
2. The dialog has **no UI** to view or edit MGV / CATV / IDS, so the user cannot fix the blanks before syncing.
3. `LOCV` is sent as `"Andhra Pradesh"` (mixed case). The SAP spec example uses uppercase (`"ANDHRA PRADESH"`).
4. The edge function does fall back to vendor columns when the override is empty, but the request body the user sees is what the dialog produced — so the experience looks "hardcoded".

## Plan (UI-only)

**File: `src/components/sap/SapFieldsDialog.tsx`**

1. Pre-fill CLASSIFY defaults from vendor data (no longer blank):
   - `MGV` ← `vendor.material_group_vendor` || first item of `vendor.product_categories` || `''`
   - `CATV` ← `vendor.vendor_category` || `vendor.organization_type` || `''`
   - `LOCV` ← `vendor.vendor_location` || `vendor.registered_state` || `''`
   - `IDS` ← `vendor.identification_source` || `''`
   - All four uppercased before being placed in the form (SAP spec convention).

2. Add a new "SAP Classification" section in the dialog with four editable fields:
   - **Material Group for Vendors (MGV)** — Select sourced from `PRODUCT_CATEGORIES`
   - **Vendor Category (CATV)** — Select sourced from `VENDOR_CATEGORIES`
   - **Vendor Location (LOCV)** — Select sourced from `INDIAN_STATES`
   - **Vendor Identification Source (IDS)** — Select sourced from `IDENTIFICATION_SOURCES`
   - Free-text fallback if value isn't in the option list (so admins can override).

3. Add editable inputs for `title` and `taxtype` in the Vendor Header section (currently held in state but not exposed in the UI).

4. Normalize all classify values to upper-case in `onConfirm` so the payload matches SAP spec exactly (`"ANDHRA PRADESH"`, `"CEMENT"`, etc.).

**No edge-function or DB changes** — the existing `sync-vendor-to-sap` already passes overrides into the SAP payload's CLASSIFY block, so populating them correctly from the dialog fixes the user-visible request body and the resulting SAP call.

## Result

After this change, the request payload to `sync-vendor-to-sap` for this vendor will look like:

```json
"classify": {
  "MGV": "CABLES & WIRES",
  "CATV": "PRIVATE LIMITED",
  "LOCV": "ANDHRA PRADESH",
  "IDS": ""
}
```

…and the user can change any of those four values in the dialog before pressing "Sync to SAP".
