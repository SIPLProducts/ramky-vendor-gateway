
## Scope

All changes are in the active KYC step `src/components/vendor/steps/DocumentVerificationStep.tsx` plus a small helper in `src/lib/nameMatch.ts`. (The unused `src/components/vendor/kyc/*` tab components and `ComplianceStep.tsx` are not wired into vendor registration and will not be touched.)

## 1. GST Tab

- **Yes** → keep the existing GST OCR + GSTIN validation flow (no behavior change).
- **No** →
  - Show "Download Declaration Template" link + reason textarea + signed file upload (already partially present — confirm wired).
  - Skip all GST fields/validation. Mark GST stage as **N/A / verified-equivalent** so the form can proceed.
  - Do not require GST legal name for downstream cross-checks.

## 2. PAN Tab (replaces current PAN-vs-GST cross-check)

- User uploads PAN card → run `PAN_OCR` (existing).
- After OCR success, call the configured `PAN` validation provider (`provider_name: "PAN"`, "PAN Comprehensive Validation").
- Read `status` from the API response:
  - `"valid"` → mark PAN verified, show: *"PAN details validated successfully from PAN Comprehensive Validation API."*
  - anything else → mark PAN failed, show: *"PAN validation failed. Please re-upload a clearer PAN card."* (with re-upload allowed).
- Persist the PAN holder name extracted by OCR (`full_name` / `holder_name`) for downstream MSME and Bank comparisons.
- Remove the hard requirement that GST must be verified before PAN.

## 3. MSME Tab

- **Yes** → user enters Udyam number (or uploads cert), call `MSME` provider (existing). After response:
  - Compare `enterprise_name` from MSME response against the **PAN Holder Name** (only — drop the GST cross-check since GST may be N/A).
  - Use a percentage match (new helper below). If `>= 40%`: pass with *"Enterprise Name verified with PAN Holder Name."*
  - If `< 40%`: fail with *"Enterprise Name does not match with PAN Holder Name."* and block continue.
- **No** → declaration download + signed upload, mark MSME as N/A, proceed to Bank.

## 4. Bank Tab

- User uploads cancelled cheque → existing OCR + Penny Drop flow.
- After Penny Drop returns the account holder name, run conditional validation:
  - **GST = No, MSME = Yes** → match holder name against PAN Holder Name **and** MSME Enterprise Name.
  - **GST = No, MSME = No** → match holder name against PAN Holder Name only.
  - **GST = Yes** (existing) → keep current GST + PAN + (optional MSME) matching.
- Pass threshold: `>= 40%` against any required source.
  - Success: *"Account Holder Name verified successfully."*
  - Failure: *"Account Holder Name does not match with the provided PAN/MSME details."* — disable Continue, allow re-upload + re-run.

## 5. Helper

Add `nameMatchPercentage(a, b): number` in `src/lib/nameMatch.ts` — token-overlap ratio over the larger normalized token set, used by MSME and Bank comparisons. Keep existing `fuzzyNameMatch` for callers that still need a boolean.

## Technical Details

- File touched: `src/components/vendor/steps/DocumentVerificationStep.tsx`
  - GST stage 1: when `isGstRegistered === false`, treat stage as complete once declaration file is uploaded; do not gate PAN on `gstDoc.status === "verified"`.
  - PAN `verifyApi("pan", ...)` branch: replace simulated logic with a real `callProvider({ providerName: "PAN", input: { pan_number, id_number } })` call; map `r.data.status === "valid"` → success.
  - MSME cross-check: drop `gstLegalName` requirement; compute `nameMatchPercentage(enterpriseName, panHolderName) >= 40`.
  - Bank cross-check (`finalizePennyDrop` path and manual popup path): build the list of expected names dynamically based on `isGstRegistered` / `isMsmeRegistered`, then accept if any comparison >= 40%.
  - Update the cross-tab mismatch dialog copy to use the new messages.
- File touched: `src/lib/nameMatch.ts` — add percentage helper, no breaking change.
- No DB / edge-function / type changes required (the `PAN` provider is already configured in admin settings).

## Out of Scope

- The standalone `kyc/*` tab components (`GstKycTab`, `PanKycTab`, `MsmeKycTab`, `BankKycTab`) used only by the unwired `ComplianceStep` and `KycLiveTestPanel`. If you want those updated too, say so and I'll mirror the changes.
