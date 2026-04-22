

## Fix: Step 1 "Continue" + "Save Draft" deadlock after all docs uploaded

### Root cause

Step 1 (`DocumentVerificationStep`) only reports its data to the parent via `onComplete(out)` — and `onComplete` only fires when the inner `step-form` is **submitted**. The parent's outer "Continue" button is the only thing that submits that form, but it is `disabled={!canProceed}`, and `canProceed` reads from `verifiedData` in the parent, which is only set inside `onComplete`. So:

- All four stages turn green inside Step 1.
- Parent never receives the data → `verifiedData` stays `undefined` → `canProceedFromCurrentStep()` returns `false` → Continue stays disabled forever.
- "Save Draft" calls `saveVendor(formData)` — but because `verifiedData` was never lifted, `formData.statutory` (PAN/GSTIN), `formData.bank` etc. are still empty, so the save either fails validation in the hook or saves an empty draft (looks like "not working").

### The fix

**1. Lift Step-1 progress to the parent in real time, not on submit.**
- Add a new optional `onStageChange` prop to `DocumentVerificationStep` that fires whenever the 4 internal stage flags (`stage1Done…stage4Done`) change, sending the same payload that `onComplete` builds today.
- Inside `DocumentVerificationStep`, call `onStageChange(buildOutput())` from a `useEffect` keyed on the stage flags + relevant doc state. `onComplete` continues to work for the explicit submit.

**2. Parent updates `verifiedData` + `formData` continuously.**
- Wire `onStageChange` to a new `handleDocStageChange(data)` in `VendorRegistration.tsx` that does the same `setVerifiedData` + `setFormData` mapping currently inside `handleDocVerificationComplete`, **without** advancing `currentStep`.
- `handleDocVerificationComplete` keeps the navigation behavior (mark step 1 complete, go to step 2). The Continue button now just submits the form, which calls `onComplete`, which advances.

**3. Result**
- "Continue" enables the moment all four stages show green, because `verifiedData` is now populated live.
- Clicking Continue submits the inner form → `onComplete` fires → step advances to 2 (existing behavior).
- "Save Draft" works at any time on Step 1 because `formData.statutory` / `formData.bank` are kept in sync as docs verify, so the saved draft actually contains PAN / GSTIN / account details and the auto-save also picks them up.

### Files

- `src/components/vendor/steps/DocumentVerificationStep.tsx`
  - Add optional `onStageChange?: (data: VerifiedDocumentData) => void` prop.
  - Extract the existing `out` builder from `handleContinue` into a `buildOutput()` helper.
  - Add a `useEffect` that calls `onStageChange?.(buildOutput())` when stage states change (debounced via dependency list — no extra timers needed).

- `src/pages/VendorRegistration.tsx`
  - Add `handleDocStageChange(data)` that mirrors the data-mapping block from `handleDocVerificationComplete` but does **not** touch `completedSteps` or `currentStep`.
  - Pass `onStageChange={handleDocStageChange}` to `<DocumentVerificationStep />` in `renderStep()`.

### Out of scope
- No change to OCR, dummy verifyApi, gating math, tab auto-advance, or any other step.
- No DB / edge function / RLS changes.

