# Stop calling the PAN registry — verify PAN against GST data only

## Problem

The screenshots show two things:

1. The PAN OCR card already displays the correct cross-checks ("PAN matches PAN derived from GSTIN", "Name match vs Legal Name: 100%") — the GST-based comparison logic is working.
2. The Network tab still shows a `kyc-api-execute` call with `providerName: "PAN"` and `{ id_number: "ABDCS6352G" }`. This is the legacy PAN comprehensive registry call that should no longer happen — per the requirement, PAN is validated using GST data, not its own registry API.

## Root cause

`src/components/vendor/steps/DocumentVerificationStep.tsx` (the active Step 1 of vendor registration at `/register`) still has a `kind === "pan"` branch in `verifyApi` (lines 363–401) that calls `callProvider({ providerName: "PAN", input: { id_number: ocrPan } })` and treats the registry response as the source of truth. `PanKycTab.tsx` was already migrated to GST-only validation, but this older sibling component was missed.

## Fix

Replace the PAN registry block in `DocumentVerificationStep.tsx` so it:

- Reads only what OCR extracted (`pan_number`, `holder_name` / `full_name`).
- Validates PAN format (10 chars, `AAAAA9999A`).
- Compares OCR PAN against the verified GST PAN (`gstDoc.ocrData.pan_number` from the GST stage).
- Compares OCR holder name against GST `legal_name` using the existing `fuzzyNameMatch` helper from `src/lib/nameMatch.ts`.
- Returns success/failure with the messages the user specified:
  - PAN match: "PAN Number verified with GST PAN Number."
  - Name match: "PAN Holder Name verified with GST Legal Name."
  - Mismatch: "PAN details do not match with GST data."
- Returns failure with a clear "Verify GST first" message if GST has not been verified yet (i.e., GST stage has no `pan_number` / `legal_name`).
- **Does not call `callProvider({ providerName: "PAN", … })`** — eliminating the unwanted network request seen in the screenshot.

The returned `normalized` / `apiData` will be built from OCR + GST values (no registry fields like `dob`, `category`, `aadhaar_linked`), keeping the downstream `VerifiedDocumentData.pan` shape intact (`number`, `holderName`, `apiName`, `nameMatchScore`).

## Files changed

- `src/components/vendor/steps/DocumentVerificationStep.tsx` — rewrite the `if (kind === "pan")` block (~lines 363–401) to do GST-based comparison only; add `fuzzyNameMatch` import from `@/lib/nameMatch`.

No DB, edge function, or other component changes needed. `PanKycTab.tsx`, `MsmeKycTab.tsx`, `BankKycTab.tsx`, and the KYC API Settings screen already match the requirement.
