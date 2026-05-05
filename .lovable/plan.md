## Goal

In the vendor registration Compliance step, make the PAN tab behave based on the GST tab selection:

- **GST = "Yes" + GST verified** → PAN tab is auto-populated from GST registry data (PAN number + holder name from GST). No PAN card upload required. Tab is automatically marked verified.
- **GST = "No"** → PAN tab shows the existing PAN card upload + OCR flow as the only way to validate PAN.

## Files to change

### 1. `src/components/vendor/kyc/PanKycTab.tsx`

Add a new mode driven by GST state:

- Accept new prop `gstRegistered: boolean` (already have `gstVerified`, `gstPanNumber`, `gstLegalName`).
- **When `gstRegistered === true`:**
  - Hide the OCR upload UI entirely.
  - If `gstVerified` and `gstPanNumber` is present:
    - Render a read-only summary card showing the PAN number and legal name sourced from GST (badge: "Auto-verified from GST").
    - Call `onPanChange(gstPanNumber)` once.
    - Call `onStatusChange('passed')` and `onVerifiedDetails({ pan_number: gstPanNumber, full_name: gstLegalName })` so MSME/Bank tabs receive `panHolderName`.
  - If GST not yet verified: show an info alert "Verify GST first — PAN will be auto-filled from the GST registry." Status stays `idle`.
- **When `gstRegistered === false`:**
  - Keep the current OCR upload flow as-is, but skip the GST cross-check (since there is no GST data). Validate the PAN purely against the typed `legalName` (fuzzy name match) and a valid 10-char PAN regex. Mark `passed` when both checks succeed.

### 2. `src/components/vendor/steps/ComplianceStep.tsx`

- Pass `gstRegistered={isGstRegistered}` to `<PanKycTab />`.
- Keep existing behaviour where verified GST sets `gstPanNumber`, `gstLegalName`, and pre-fills the `pan` form field.
- Step validity (`isStepValid`) already requires `statuses.pan === 'passed'`; no change needed since the PAN tab will now auto-mark itself passed when GST is verified.

## Out of scope

- No changes to GST tab, MSME tab, Bank tab, or backend.
- No DB / edge function changes.
