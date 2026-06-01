## Add 4 SAP F4 Classification fields to Organization tab (Domestic vendors) + pre-fill SAP Sync popup

### Background
- The Organization step previously contained SAP Classification multi-selects; they were removed and replaced with a comment ("captured on the SAP Sync screen"). Schema, form state, autosave and DB columns for the four arrays (`materialGroupVendor`, `vendorCategory`, `vendorLocation`, `identificationSource`) are all still in place — only the UI fields were removed.
- `OrganizationStep` is only rendered for Domestic vendors; International vendors use `IntlClassificationStep`. So the fields can be added unconditionally inside `OrganizationStep`.
- `ClassificationField` already implements SAP F4 search-help via `useEnsureSapMaster` (multi-select with code + description).
- `SapFieldsDialog` (the SAP Sync popup) already renders the same four classification fields with F4 multi-select and persists edits on Confirm via `persistClassification`. Its `buildDefaults` currently hard-codes empty arrays — we need to seed it from the vendor's saved classification values so the SAP user sees what the vendor selected and can modify before sync.

### Changes

**1. `src/components/vendor/steps/OrganizationStep.tsx`**
- Re-import `ClassificationField` (already on disk).
- Inside the Organization Profile section (replacing the "SAP Classification is now captured on the SAP Sync screen" comment around line 406), add a new "Classification" subsection containing four `ClassificationField` components bound via `Controller` to `materialGroupVendor`, `vendorCategory`, `vendorLocation`, `identificationSource` with `masterType` values `material_group_vendor`, `vendor_category`, `vendor_location`, `identification_source` respectively. Use the existing 2-column responsive grid. All four fields remain optional (schema already optional).
- No changes to schema, defaults, live-update push, or `handleFormSubmit` — they already include the four arrays.

**2. `src/components/sap/SapFieldsDialog.tsx`**
- Update `buildDefaults(vendor, tenantDefaults)` so the `classify` object is seeded from the vendor row arrays when present:
  - `MGV: vendor.material_group_vendors ?? []`
  - `CATV: vendor.vendor_categories ?? []`
  - `LOCV: vendor.vendor_locations ?? []`
  - `IDS: vendor.identification_sources ?? []`
- SAP user can still edit these multi-selects; on Confirm the existing `persistClassification` writes the (possibly modified) values back to the same vendor columns, so any edits are saved.

### Out of scope / unchanged
- No DB migration (columns already exist).
- International flow (`IntlClassificationStep`) untouched.
- Validation, autosave, review step, registration submit, and sync flow all unchanged.
- No other files modified.