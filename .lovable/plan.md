## Issue
Final **Submit Application** is still blocked with:

```text
Financial & Infrastructure is incomplete
```

But that tab has no mandatory fields, so it should not block submission after the user has clicked **Continue**.

## Root cause
`src/pages/VendorRegistration.tsx` has an extra final-submit completeness checker. It currently treats Step 5 as incomplete unless at least one Financial or Infrastructure field is filled.

That rule was only meant for showing progress/completed ticks, but it is also being used for final submit blocking.

## Fix plan
1. Update `src/pages/VendorRegistration.tsx` so final submit does **not** require Step 4 Contact Details or Step 5 Financial & Infrastructure fields.
2. Keep per-tab validation as the source of truth:
   - Contact Details: only validates entered email/phone formats.
   - Financial & Infrastructure: allows blank values because there are no mandatory fields.
3. Keep existing mandatory checks for real required steps:
   - Document Verification remains required.
   - Organization Profile remains required.
   - Address Information remains required.
   - Declaration checkboxes remain required before submit.
4. Verify that clicking **Submit Application** from Review no longer shows optional-step incomplete errors.

## Scope
Frontend validation fix only. No backend/database changes.