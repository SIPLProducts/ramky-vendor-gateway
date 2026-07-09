## Fix: "Financial & Infrastructure is incomplete" on Submit

### Root cause
`isDomesticStepComplete` (step 5) in `src/pages/VendorRegistration.tsx` requires:
- `financial.turnoverYear1` non-empty
- `financial.creditPeriodExpected` non-empty

But the Financial & Infrastructure step's own zod schema (`FinancialInfrastructureStep.tsx`) marks **all** financial fields as optional. So the user can complete the step without filling turnover/credit, get a green check, then Submit blocks them with a misleading error.

This is the same class of bug as the earlier Address fix — the submit-gate checks stricter rules than the step itself enforces.

### Change
In `src/pages/VendorRegistration.tsx`, `isDomesticStepComplete` case 5:

```ts
case 5: {
  // Financial & Infrastructure step has no required fields in its schema.
  // Any provided values are already validated inline by the step.
  return true;
}
```

### Why this is safe internationally
`isDomesticStepComplete` runs only for domestic vendors. The international submit branch is untouched.

### Guardrail (prevent recurrence)
Add a short comment above `isDomesticStepComplete` noting: "Keep each case aligned with the corresponding step's zod schema. Do not add fields here that the step itself treats as optional."

### Verification
- `bunx tsgo --noEmit`
- Domestic vendor with empty turnover/credit → Submit proceeds (no "Financial & Infrastructure incomplete" toast).
- Filling turnover with negative/invalid values still blocked by inline step validation.