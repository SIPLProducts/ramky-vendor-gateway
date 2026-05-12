# Plan — Bank holder-name verification & PAN API gating

Two files change. No backend / no schema change. All updates are to the Document Verification step (Bank + PAN flows) and matching messages.

## 1. Bank — conditional success/failure messages

In `src/components/vendor/steps/DocumentVerificationStep.tsx` (cheque-OCR finalize path ~lines 729–757 and manual-popup path ~lines 1200–1221) and in `src/components/vendor/kyc/BankKycTab.tsx`, replace the current single "Account Holder Name verified successfully." with messages that depend on GST/MSME flags.

Validation rule (kept as today): name match score ≥ 40% against the active reference set, where the reference set is:

| GST | MSME | References checked |
|-----|------|--------------------|
| No  | No   | PAN Holder Name only |
| No  | Yes  | PAN Holder Name + MSME Enterprise Name |
| Yes | No   | PAN Holder Name + GST Legal Name |
| Yes | Yes  | PAN Holder Name + GST Legal Name + MSME Enterprise Name |

Success message (shown inline + on the bank tile):

- GST=No, MSME=No → `Account Holder Name verified with PAN Holder Name.`
- GST=Yes, MSME=No → `Account Holder Name verified with PAN Holder Name and GST Legal Name.`
- GST=No, MSME=Yes → `Account Holder Name verified with PAN Holder Name and MSME Enterprise Name.`
- GST=Yes, MSME=Yes → `Account Holder Name verified with PAN Holder Name, GST Legal Name and MSME Enterprise Name.`

Failure message (unchanged): `Account Holder Name does not match with the provided PAN/MSME details.`
Failure handling (unchanged): block Continue, allow re-upload / re-validate.

Implementation note: build the success string from the same `refs` array already used for matching, so the message stays in sync with the reference set.

## 2. PAN — rename success message

In `DocumentVerificationStep.tsx` line 572:
- Replace `"PAN details validated successfully from PAN Comprehensive Validation API."`
- With `"PAN details validated successfully from PAN verification."`

Provider-not-configured message (line 535) stays as-is (it references the admin setting name).

## 3. PAN — skip the PAN Comprehensive Validation API when GST = Yes

When `isGstRegistered === true`, the GST registry already authoritatively returns the PAN number + legal name, so calling the PAN Comprehensive Validation provider is redundant. Update the `kind === "pan"` branch in `runDocFlow` (lines 517–576):

- If `isGstRegistered === true`: skip the `callProvider({ providerName: "PAN", ... })` call entirely. Build the verified result purely from OCR + GST cross-check (PAN number must equal `gstin.slice(2,12)`, holder name fuzzy-matches GST legal name ≥ 40%). Set `apiData.source = "GST cross-check"` and `apiData.panMatchMessage = "PAN verified against GST registry."`.
- If `isGstRegistered === false` (Self-Declaration path): keep current behaviour — call the PAN provider and use the new success message from item 2.

The downstream PAN ↔ GSTIN useEffect cross-check (lines 1291–1309) already runs only when `isGstRegistered === true`, so it continues to guard live edits.

## Files to edit

- `src/components/vendor/steps/DocumentVerificationStep.tsx` — items 1, 2, 3
- `src/components/vendor/kyc/BankKycTab.tsx` — item 1 (inline holder-name banner messages, lines 87–107 and 287–294)

## Out of scope

- No changes to MSME tab logic, file upload conversion, or step gating.
- No backend / RLS / edge-function changes.
