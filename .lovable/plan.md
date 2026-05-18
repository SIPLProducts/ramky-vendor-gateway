## Changes

### 1. Vendor type selection shown BEFORE the registration form

Currently the Domestic / International selector sits above the stepper on the same screen as Step 1 (Documents Upload / Organization). Change this so the selector is its own gating screen.

**`src/pages/VendorRegistration.tsx`**
- Add local state `vendorTypeChosen` (boolean), defaulting to `true` when `existingFormData?.vendorType` is set (resumed drafts), otherwise `false`.
- When `!vendorTypeChosen`:
  - Render only the header + a centered card containing the `<VendorTypeSelector>` and a "Continue" button.
  - Continue is enabled once a type is picked; clicking it sets `vendorTypeChosen = true` and ensures `currentStep = 1`.
  - Do NOT render the StepIndicator, Documents/Organization step, or sticky action bar yet.
- When `vendorTypeChosen === true`:
  - Render the stepper + the active step (current behavior), but the `<VendorTypeSelector>` is no longer shown above the stepper.
  - Add a small "Vendor Type: International ✎ Change" chip in the header area that, when clicked, opens the existing AlertDialog. Confirming switches type and resets the abandoned slice (existing `applyVendorTypeSwitch` logic). This preserves the ability to change type after entering data.

### 2. Make international Documents Upload fields optional

**`src/components/vendor/steps/international/IntlDocumentsStep.tsx`**
- Remove `required` prop on both `<FileUpload>` instances (Registration Copy, SWIFT/IBAN Details) so the red asterisk disappears.
- Update the helper sentence to say "(optional)".

No backend, validation, or submission logic changes — the international flow already allows Continue without OCR gating, and there is no required-file enforcement on submit for these two fields.

### Out of scope
- Domestic flow, ReviewStep, edge functions, DB, and all other steps remain unchanged.
