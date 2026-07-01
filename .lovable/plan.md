## Goal
Call PAN Comprehensive Validation API right after successful PAN OCR — regardless of whether PAN-vs-GST match passes or fails, and regardless of GST=Yes/No — and save/display `status` + `aadhaar_linked` consistently.

## Change (single file: `src/components/vendor/kyc/PanKycTab.tsx`)

Move the PAN Comprehensive call out of the `if (panOk && nameOk)` success branch in `handleVerify` so it fires unconditionally as soon as OCR yields a valid 10-char PAN.

Steps:
1. Extract the existing fire-and-forget block into a local helper `runPanComprehensive(pan: string)` inside the component. Behavior unchanged:
   - Calls `callProvider({ providerName: 'PAN', input: { id_number: pan, pan } })`.
   - Parses `status` (string) and `aadhaar_linked` (true/false/null).
   - Updates local result via `updateResult({ panStatus, aadhaarLinked })`.
   - Notifies parent via `props.onComprehensiveResult` so `ComplianceStep` persists `panStatus`, `panAadhaarLinked`, `panComprehensiveVerifiedAt` (already wired).
   - Wrapped in try/catch — never throws, never blocks.
2. In `handleVerify`, right after computing `extractedPan` and calling `props.onPanChange`, invoke `runPanComprehensive(extractedPan)` when `extractedPan.length === 10`. Do NOT await — fire-and-forget as today.
3. Remove the duplicate inline IIFE inside the `panOk && nameOk` branch (now redundant).
4. Keep the "always render PAN Status / Aadhaar Linked info card once OCR captured a PAN" behavior: change the render guard from `(panStatus != null || aadhaarLinked != null)` to also show when `ocrPan` exists — defaults render as "Invalid" / "Aadhaar Not Linked with PAN" via existing `formatPanStatus` / `formatAadhaarLinked` helpers until the API returns.

## Out of scope
- No changes to `useVendorRegistration`, DB schema, view screens, admin provider config, or GST-Yes/No branching. Persistence and cross-screen display are already wired from earlier turns.
- No changes to PAN OCR gating (`gstVerified` check inside `runPanOcr` is unchanged — user's ask is about GST=Yes/No PAN Comprehensive triggering, not OCR gating).

## Files
- `src/components/vendor/kyc/PanKycTab.tsx` — refactor as above.
