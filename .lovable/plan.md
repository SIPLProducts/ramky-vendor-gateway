## Problem

On the International vendor flow, clicking **Continue** on Step 2 (Company Details) does nothing.

## Root cause

In `src/pages/VendorRegistration.tsx` (~line 1809), the Continue button's `form` attribute is hardcoded per step number:

```tsx
form={currentStep === 1 ? "step-form-1" : currentStep === 2 ? "step-form-2" : "step-form"}
```

That mapping is written for the **domestic** flow, where `OrganizationStep` (step 2) uses `id="step-form-2"`.

The international step 2 component `IntlCompanyDetailsStep` uses `id="step-form"` (same as `IntlBankDetailsStep` and `IntlClassificationStep`). So on international step 2 the button targets a form that isn't on the page → click does nothing, no validation, no submit.

## Fix

Make the form-id resolution aware of `isInternational`. For international, always target `"step-form"` (since intl step 1 uses its own `handleIntlDocsContinue` handler and isn't a submit button, this is safe):

```tsx
form={
  isInternational
    ? "step-form"
    : currentStep === 1 ? "step-form-1"
    : currentStep === 2 ? "step-form-2"
    : "step-form"
}
```

Single-file change: `src/pages/VendorRegistration.tsx`.

## Verification

- International flow → fill Company Details → click Continue → form validates and advances to step 3 (Bank Details).
- Domestic flow → unchanged (still uses `step-form-1` / `step-form-2` / `step-form`).
