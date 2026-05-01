# Cross-Tab KYC Verification (GST → PAN → MSME → Bank)

Make the GST verification the single source of truth for downstream tabs. Once GST is verified, we have the registered `pan_number` and `legal_name` from the official registry. PAN, MSME, and Bank tabs will then validate against those known-good values instead of running their own registry calls (PAN) or only fuzzy-checking against the user's typed legal name.

## 1) GST Tab — expose PAN Number from GST response

GST API response includes `pan_number` (e.g. `ABDCS6352G`). Currently the GST tab displays GSTIN, address, taxpayer type, etc., but **not** the PAN number derived from GSTIN.

Changes:
- `GstKycTab.tsx`: when verification succeeds, surface `pan_number` (and reinforce `legal_name`) in the verified-details summary block.
- `ComplianceStep.tsx` `handleGstVerified`: when GST returns `pan_number`, **auto-populate** the form's `pan` field (it's the same PAN that backs the GSTIN), and store `gstLegalName` + `gstPanNumber` in component state so PAN/MSME/Bank tabs can read them.
- Add a small "GST PAN Number" read-only display row in the existing GST Certificate Details panel.

## 2) PAN Tab — OCR only, validate against GST

Stop calling the PAN comprehensive validation API. The OCR result is enough; correctness is established by comparing OCR-extracted values to the GST tab's verified data.

Changes in `PanKycTab.tsx`:
- New props: `gstPanNumber?: string`, `gstLegalName?: string`, `gstVerified: boolean`.
- If `!gstVerified`, show a soft warning: "Please verify GST first — PAN is validated against GST records." Disable Verify until GST passes (or allow OCR but block status=passed).
- Replace `handleVerify` logic:
  - Extract `pan_number` and `full_name` from OCR response.
  - Compare PAN: case-insensitive exact match → ✅ "PAN Number verified with GST PAN Number." Mismatch → ❌ "PAN details do not match with GST data."
  - Compare Name: token-based fuzzy match against `gstLegalName` → ✅ "PAN Holder Name verified with GST Legal Name." Mismatch → ❌ flag.
  - Both pass → status `passed`. Either fails → status `failed` with combined message.
- Remove the `callProvider({ providerName: 'PAN', ... })` registry call. Keep the `PAN_OCR` call.
- Render per-field check rows below PAN Number and PAN Holder Name fields with green tick + verification message, mirroring the existing pattern used in Bank/GST.

## 3) MSME Tab — compare enterprise name against PAN holder name

After MSME OCR + MSME registry verification returns `name_of_enterprise` / `enterprise_name`, compare it against the PAN holder name (which itself was verified against GST in step 2).

Changes in `MsmeKycTab.tsx`:
- New prop: `panHolderName?: string` (passed down from `ComplianceStep` after PAN tab passes).
- After existing MSME verification succeeds:
  - If `panHolderName` is available, run a fuzzy/partial token match between `enterprise_name` and `panHolderName`.
  - ✅ Match → message "Enterprise Name verified with PAN holder name." (in addition to existing MSME-verified state).
  - ❌ Mismatch → status stays `failed` with "Enterprise Name does not match with PAN holder name."
- Render the verification message under the Enterprise Name field with green tick on success.

## 4) Bank Tab — verify account holder name against both GST and PAN

`BankKycTab.tsx` currently fuzzy-checks `name_at_bank` only against `legalName` (the user-typed value). Replace with the verified GST + PAN names.

Changes:
- New props: `gstLegalName?: string`, `panHolderName?: string`.
- After penny-drop returns `name_at_bank`:
  - Compare against `panHolderName` and `gstLegalName` (token-based fuzzy match).
  - Both match → ✅ "Account Holder Name verified with GST Legal Name and PAN Holder Name."
  - Only GST matches → ✅ "Account Holder Name matched with GST Legal Name."
  - Only PAN matches → ✅ "Account Holder Name matched with PAN Holder Name."
  - Neither → ❌ "Account Holder Name does not match with GST and PAN details." → status `failed`.
- Render below the Account Holder Name display row.

## 5) ComplianceStep — wire the cross-tab data

`ComplianceStep.tsx`:
- Add state: `gstLegalName`, `gstPanNumber`, `panHolderName`.
- In `handleGstVerified`: capture `legal_name`/`business_name` → `gstLegalName`; capture `pan_number` → `gstPanNumber`; also `setValue('pan', pan_number)` so the PAN tab field is pre-filled.
- Add `handlePanVerified(d)`: capture `full_name`/`holder_name` → `panHolderName`.
- Pass these into `<PanKycTab>`, `<MsmeKycTab>`, `<BankKycTab>` as new props.
- `PanKycTab` needs an `onVerifiedDetails` prop wired here (currently missing in the JSX).

## 6) Shared helper for name matching

Create `src/lib/nameMatch.ts` with one function `fuzzyNameMatch(a, b): boolean` (lowercased, alphanumeric-stripped, token overlap) used consistently by PAN/MSME/Bank tabs to avoid duplicated regex logic.

## Technical Details

Files to modify:
- `src/components/vendor/kyc/GstKycTab.tsx` — surface `pan_number` in details
- `src/components/vendor/kyc/PanKycTab.tsx` — drop PAN registry call, add GST-based validation, per-field messages
- `src/components/vendor/kyc/MsmeKycTab.tsx` — add `panHolderName` comparison message
- `src/components/vendor/kyc/BankKycTab.tsx` — replace single-name match with dual GST+PAN match logic and messages
- `src/components/vendor/steps/ComplianceStep.tsx` — capture GST/PAN derived names, pass via props, auto-fill PAN field from GST response
- `src/lib/nameMatch.ts` — new shared fuzzy matcher

No database / edge function / API provider changes required. The `PAN` provider row stays in `api_providers` (harmless) but is no longer called from the registration flow.

## Out of scope

- KYC Settings screen PAN configuration stays as-is (the user previously asked to add it; we're only stopping its use during registration).
- No changes to GST/MSME/Bank registry providers.
