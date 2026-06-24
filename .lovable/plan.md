## Scope
Domestic vendor registration only. No changes to other flows.

## 1. GST Cascade → Organization fields
In `src/pages/VendorRegistration.tsx`, when the verified GSTIN changes (or GST is reset/replaced):
- Clear `organization.legalName`
- Clear `organization.tradeName`
- Clear `organization.state`

## 2. Organization State auto-populates from GST State
In `src/components/vendor/steps/OrganizationStep.tsx`:
- Use `GST_STATE_CODE_MAP` (first 2 digits of GSTIN) as the single source of truth for State.
- A ref-guarded `useEffect` sets `state` from the GSTIN state code whenever GST data changes, unless the user has manually edited it.
- Remove any fuzzy address-based fallback so wrong states (e.g. Telangana for an AP GSTIN) never appear.

## 3. Sequential Navigation Gating (Domestic)
Tighten `handleStepClick` in `VendorRegistration.tsx`:
- Step 1 (Documents): cannot leave until GST, PAN, MSME (if Yes), and Bank are uploaded + verified.
- Step 2 (Organization): cannot leave until all mandatory Organization fields are valid.
- Step 3 (Address), Step 4 (Contact), etc.: same rule — each step requires its mandatory fields before advancing.
- Forward jumps via the top stepper are blocked unless every prior step is complete; backward navigation stays allowed.
- After Bank verification, "Continue" routes to the Organization step.

## 4. Mandatory Field Enforcement
Add `onInvalid` toast handlers (where missing) to:
- `AddressStep.tsx`
- `ContactStep.tsx`
- `FinancialInfrastructureStep.tsx`

So invalid submits show a clear "Please complete required fields" toast instead of silently doing nothing.

## 5. Draft Reload Clamp
On loading a saved draft, clamp `currentStep` so users cannot land past an incomplete predecessor step.

## Out of scope
- International vendor flow
- Visual restyling of the stepper (locked steps keep current look)
- Any backend / SAP mapping changes
