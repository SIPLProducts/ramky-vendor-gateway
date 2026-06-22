## Goal
Auto-populate **Vendor Location** (Classification card in Organization Profile) from the selected **State**, render it read-only, and also display it read-only in the SAP Sync popup.

## Why a mapper is needed
- `state` uses friendly names from `INDIAN_STATES` (e.g. `Odisha`, `Uttarakhand`, `Chhattisgarh`, `Puducherry`, `Jammu and Kashmir`).
- SAP `vendor_location` master codes are uppercase with SAP-style spellings (e.g. `ORISSA`, `UTTARAKAND`, `CHHAATTISGARH`, `PONDICHERRY`, `JAMMU UND KASHMIR`, `DADRA UND NAGAR HAV.`, `MEGALAYA`, `ANDAMAN UND NICO.IN.`).
- Need a small mapping helper so the auto-populated code actually matches an existing SAP code.

## Changes (frontend only)

### 1. New `src/lib/stateToSapLocation.ts`
Pure helper exporting:
- `STATE_TO_SAP_LOCATION_OVERRIDES`: explicit map for the spelling mismatches above.
- `mapStateToSapLocationCode(state, sapRows)`: returns the matching SAP code by, in order:
  1. exact override match,
  2. case-insensitive match against `sapRows[].code`,
  3. uppercase of the state name as fallback.
- `getLocationLabel(code, sapRows)`: returns `"CODE — Description"` or just the code.

### 2. `src/components/vendor/steps/OrganizationStep.tsx`
- Watch `state` with react-hook-form. On change (and once on mount when `data.state` is present), call `mapStateToSapLocationCode(state, sapVendorLoc)` and `setValue('vendorLocation', [mappedCode], { shouldDirty: true })`. If `state` is cleared, set `vendorLocation` to `[]`.
- Replace the `Controller` rendering the `ClassificationField` for Vendor Location with a read-only display:
  - Same `Label` ("Vendor Location") with helper text "Auto-filled from State".
  - A disabled/readonly `Input` showing `getLocationLabel(value[0], sapVendorLoc)` or "Select State first".
  - Keep the Controller so the value is part of the form payload (just render disabled UI inside it).
- No change to the other three classification fields.

### 3. `src/components/sap/SapFieldsDialog.tsx`
- Replace the `SapF4MultiSelectField` for Vendor Location (lines 231–237) with a read-only display:
  - Label "Vendor Location" with `text-xs text-muted-foreground` (matching surrounding fields).
  - Readonly `Input` showing `getLocationLabel(form.classify.LOCV[0], sapVendorLoc)` (load `sapVendorLoc` via `useEnsureSapMaster('vendor_location')`).
  - Keep `form.classify.LOCV` untouched so the value continues to flow into the SAP payload via the existing `LOCV` handling (`SAPSync.tsx` `persistClassification` + `sapPayloadBuilder.ts` already read `vendor_locations`).
- No change to the other classification fields in the popup.

### 4. No backend / schema / edge function changes
- `vendor_locations` is already persisted from `formData.organization.vendorLocation` (`useVendorRegistration.tsx` line 314).
- SAP payload already uses `vendor_locations` (`sapPayloadBuilder.ts` line 212–213).

## Verification
1. On Organization Profile, change **State** → Classification card shows Vendor Location auto-filled (read-only) with the mapped SAP code/description.
2. Try states with known spelling differences (Odisha, Uttarakhand, Chhattisgarh, Puducherry, Jammu and Kashmir) and confirm they resolve to the SAP codes (`ORISSA`, `UTTARAKAND`, `CHHAATTISGARH`, `PONDICHERRY`, `JAMMU UND KASHMIR`).
3. Open SAP Sync popup for a vendor → Classification section shows Vendor Location read-only with the same value; other classification fields remain editable.
4. Existing vendors with already-saved `vendor_locations` continue to display correctly (no overwrite unless the user changes State).
