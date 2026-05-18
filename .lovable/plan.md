## Goal
Wire the International vendor flow into `VendorRegistration.tsx` and extend `ReviewStep` to show an international summary when `vendorType === 'international'`. Domestic flow remains unchanged.

## Changes

### 1. `src/pages/VendorRegistration.tsx`
- Render `<VendorTypeSelector>` above the step indicator (sticky top section), bound to `formData.vendorType`.
- Build two step lists with `useMemo`:
  - **Domestic** (current): builtInSteps (1-5) + custom tabs + Review.
  - **International**: `[Documents Upload, Company Details, Bank Details, Classification, Review]` (no custom tabs).
- Switch `registrationSteps` and `renderStep()` based on `formData.vendorType`.
  - International cases render the 4 new `Intl*Step` components, passing the relevant `formData.international` slice + `onChange` that merges into `formData.international`.
- When the user toggles vendor type and the abandoned side has any data, show an AlertDialog "Switch vendor type? All entered <Domestic|International> data will be cleared." On confirm:
  - Reset the abandoned slice to its initial empty shape (domestic: organization/address/contact/statutory/bank/financial/infrastructure/qhse; international: `formData.international`).
  - Reset `completedSteps`, `currentStep = 1`, `verifiedData = undefined`.
- Replace the hardcoded emoji header switch (`currentStep === 1..6`) with an icon resolved from the active step list so international tabs get appropriate icons.
- Update the `canProceedFromCurrentStep` doc-verification gate to only apply when `vendorType === 'domestic'` (international has no Step-1 OCR gate; all intl steps allow Continue).
- Update the `useEffect` that pre-fills `completedSteps` from `existingFormData` to branch on `vendorType` (skip domestic-only pre-fill for international vendors; instead mark intl steps complete based on filled intl slices).

### 2. `src/components/vendor/steps/ReviewStep.tsx`
- When `data.vendorType === 'international'`, render an "International Vendor" summary card with sections:
  - Documents Upload (file names / "Uploaded" badges)
  - Company Details
  - Bank Details
  - Classification (Material Group, Vendor Category, Vendor Location, Identification Source)
- Each section has an Edit button that calls `onEditStep(<intl step number>)`.
- Hide the domestic summary cards (Organization, Address, Contact, Financial, Infrastructure, QHSE) when international.
- Keep the declaration + submit block unchanged (shared).

### 3. Vendor type indicator UX
- `VendorTypeSelector` already styled with green border on selection. Place it inside the sticky header section above the stepper so it's visible on every step.
- Disable toggling once the vendor is submitted / `isSubmitted === true` or `vendorStatus` is non-editable.

## Out of scope
- No changes to `useVendorRegistration.tsx` (already handles intl persistence per previous turn).
- No DB / edge-function changes.
- No changes to domestic step components or `DynamicStep`.
- No approval-workflow / SAP / email changes.

## Validation
- Domestic flow: full existing behavior preserved (steps, OCR gate, custom tabs, review).
- International flow: 4 tabs + Review, no OCR gate, no custom tabs, intl review summary, switch-type reset works both directions with confirm dialog.