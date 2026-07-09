## Problem
Clicking Submit shows "Organization Profile is incomplete" even after filling every visible required field. The Submit-gate in `VendorRegistration.tsx` requires `statutory.entityType`, but the current `OrganizationStep.tsx` never renders an Entity Type input, so users cannot satisfy it.

## Fix (frontend only, minimal)

**`src/pages/VendorRegistration.tsx`** — `isDomesticStepComplete`, case 2:
Drop the `nonEmpty(s?.entityType)` check. Step 2 completeness becomes:
```
legalName + industryType + organizationType
```
This matches what the Organization Profile step actually asks the user to fill (all already required by its zod schema). It also aligns with `useFormCompleteness` (which does not require entityType) and prevents the misleading toast + forced tab-jump.

No changes to:
- The Organization step zod schema, field ordering, or persisted data.
- Statutory slice / SAP payload builder — `entityType` remains an optional field on the model.
- Other steps' gating logic.

## Verification
1. Fill Organization Profile with Legal Name, Industry Type, Organization Type (already required by zod).
2. Complete Address, Contact, Financial steps.
3. Click Submit on Review — should proceed without the false "Organization Profile is incomplete" toast.
4. `bunx tsgo --noEmit` clean.

## Out of scope
- Re-adding an Entity Type input to Organization Profile (can be a separate request if you want it captured in registration).
- Any backend / SAP mapping changes.
