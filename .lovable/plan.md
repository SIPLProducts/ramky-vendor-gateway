## Issue

When the vendor is on Step 2 (Organization Profile) and clicks **Continue**, nothing happens — the form never advances to Step 3.

## Root cause

Step 1 (`DocumentVerificationStep`) is kept mounted at all times (rendered with `display:none` when not on step 1, see `VendorRegistration.tsx` line 1525). Its `<form>` uses `id="step-form"`.

Step 2 (`OrganizationStep`) also renders a `<form id="step-form">`.

So while the vendor is on Step 2, **two forms with the same id `step-form` exist in the DOM**. The Continue button uses `<Button form="step-form">`, which the browser resolves via `document.getElementById("step-form")` — that always returns the **first** match, i.e. Step 1's hidden form.

Step 1's form `onSubmit` is `(e) => { e.preventDefault(); if (allDone) handleContinue(); }`. Because Step 1's `allDone` gate isn't fully satisfied (or even if it were, it advances 1→2, not 2→3), clicking Continue on Step 2 silently does nothing.

This same collision affects every other step that uses `id="step-form"` (Address, Contact, Financial, Compliance, international steps, DynamicStep) whenever Step 1 is also mounted — Step 2 just hits it first because that's where users notice it.

## Fix

Give Step 1's always-mounted form a unique id, and point the Continue button at the right id based on the current step.

### Files to change

1. **`src/components/vendor/steps/DocumentVerificationStep.tsx`** (line 1848)
   - Change `id="step-form"` → `id="step-form-1"`.
   - This is the only step that stays mounted while other steps are visible, so it's the only one that must differ.

2. **`src/pages/VendorRegistration.tsx`** (Continue button around line 1631)
   - Change `form="step-form"` → `form={currentStep === 1 ? "step-form-1" : "step-form"}`.
   - Leave the Submit Application button untouched (last step uses its own path).

3. **`src/components/vendor/StickyActionBar.tsx`** — if it also renders a submit button with `form="step-form"`, apply the same conditional (`step-form-1` when `currentStep === 1`). Will confirm and patch during implementation.

No other step files need to change — they're only mounted one at a time, so reusing `id="step-form"` for steps 2–N remains safe.

### Verification

- On Step 1, Continue still advances to Step 2 (uses `step-form-1`).
- On Step 2, fill required fields (Legal Name, Industry, Org Type, Ownership, State) and click Continue → advances to Step 3.
- Steps 3, 4, 5 Continue buttons still work.
- No regression on the international flow (its Continue uses `handleIntlDocsContinue`, not the form attribute).