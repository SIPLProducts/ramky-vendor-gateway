## Problem

Two related gaps in the vendor registration flow (domestic path):

1. **Resume jumps too far ahead.** When the buyer/vendor comes back to a draft, the resume logic in `src/pages/VendorRegistration.tsx` (lines ~820–833) marks a step as "filled" based on the mere presence of *any* field in that slice:
   - Step 3 (Address) is marked filled if `address.registeredAddress` is truthy — but GST verification in Step 1 auto-populates parts of the address, so this field can already be non-empty even though the user never opened the Address tab.
   - Step 4 (Contact) is marked filled if `contact.ceoName` is truthy — again, this can get seeded from OCR/organization data.
   - `nextStep = min(steps not in filledSteps)` therefore skips Address/Contact and drops the user on Step 5 (Financial & Infrastructure).

2. **Submit does not bounce the user back to the incomplete tab.** `handleSubmit` (line 1282) calls `submitVendor(formData)` immediately. If mandatory fields on Address / Contact / Financial / Organization are blank, the server-side error surfaces as a toast but the user is left sitting on the Review step with no indication of which tab to fix.

## Fix

### 1. Trustworthy per-step completeness check

Add a single helper in `VendorRegistration.tsx` that returns whether a given domestic step is *actually* complete, using the same required-field rules as each step's zod schema (mandatory-only subset, no format-only checks, no OCR gate beyond what step 1 already does):

- Step 1: reuse existing `canProceedFromCurrentStep()` semantics (verifiedData.step1Status.allDone or the fallback checks).
- Step 2: `organization.legalName`, `organization.industryType`, `organization.organizationType`, `statutory.entityType`.
- Step 3: `address.registeredAddress` (≥5 chars), `registeredCity`, `registeredState`, `registeredPincode` (6 digits), `contactEmail1` (valid email), `contactPhone1` (10 digits).
- Step 4: `contact.ceoName`, plus at least one valid CEO/marketing/customer-service phone+email pair matching current `ContactStep` schema.
- Step 5: mandatory keys in `FinancialInfrastructureStep` schema (turnoverYear1, creditPeriodExpected, etc. — mirror the existing zod `schema`).

Extract these as `isStepComplete(step, formData, verifiedData)` so both resume and submit use identical rules.

### 2. Resume lands on the first incomplete step

Replace the presence-based `filledSteps.push(...)` block (lines ~820–833) with:

```
const filled = [1,2,3,4,5].filter(s => isStepComplete(s, existingFormData, seededVerifiedData));
setCompletedSteps(filled);
const firstMissing = [1,2,3,4,5].find(s => !filled.includes(s));
setCurrentStep(isReturned ? 6 : (firstMissing ?? 6));
```

This guarantees the user re-enters at the first step with missing mandatory data — Address in the reported scenario — instead of leapfrogging to Financial.

Also tighten `handleStepClick` so a user can only jump forward to a step whose predecessors are all complete (they can always jump *backward* freely). Prevents the same skip via clicking the step indicator.

### 3. Submit routes to the first incomplete tab

Wrap `handleSubmit`:

```
const firstMissing = [1,2,3,4,5].find(s => !isStepComplete(s, formData, verifiedData));
if (firstMissing) {
  toast({
    title: 'Please complete required fields',
    description: `Step ${firstMissing} — ${registrationSteps[firstMissing-1].title} is incomplete.`,
    variant: 'destructive',
  });
  setCurrentStep(firstMissing);
  return;
}
// existing submitVendor / resubmitVendor flow …
```

The individual step forms already surface field-level errors on mount via their zod resolvers, so once we drop the user on that tab they immediately see the red messages.

### 4. Scope

- Domestic flow only. International flow keeps its existing `filledSteps` presence check (its step slices don't get auto-seeded from OCR the same way).
- No schema / DB changes. Purely client-side.
- No changes to the actual step components — we reuse their required-field lists inline in the helper.

## Verification

- Build (`bun run build`) must pass.
- Playwright: open a draft with only Organization filled → confirm resume lands on Step 3 (Address) not Step 5.
- Playwright: on Review, click Submit with Address blank → confirm we get bounced to Address with a red toast and inline errors.
