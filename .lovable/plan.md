## Goal

Strengthen cross-tab name validation in the KYC flow so that:
1. **MSME** Enterprise Name must match **GST Legal Name** OR **PAN Holder Name** — if it matches neither, show a popup, block tab navigation, and prevent moving to the next step.
2. **Bank** Account Holder Name (`full_name` from API) is compared against both **PAN Holder Name** and **GST Legal Name**, with three precise status messages.

These rules apply to both surfaces where KYC happens:
- `src/components/vendor/steps/DocumentVerificationStep.tsx` (Step 1 of vendor registration — what the screenshot shows).
- `src/components/vendor/kyc/MsmeKycTab.tsx` + `BankKycTab.tsx` (used inside `ComplianceStep` — alternate compliance UI).

---

## 1. MSME — match against GST Legal Name AND PAN Holder Name

### `DocumentVerificationStep.tsx`
- In `verifyApi` for `kind === "msme"` (around line 404), after computing `normalized.enterprise_name`:
  - Read `gstLegalName = gstDoc.ocrData?.legal_name` and `panHolderName = panDoc.ocrData?.holder_name || panDoc.ocrData?.full_name`.
  - Use `fuzzyNameMatch` (already imported) to compare `enterprise_name` against each.
  - If neither matches AND at least one reference name is available, return `{ ok: false, message: "Enterprise Name does not match with GST Legal Name and PAN Holder Name." }`. The existing `runDocFlow` already routes this into `setMsmeDoc({ status: "failed", errorMessage })`, which shows a red banner under the MSME card AND keeps `stage3Done = false`, so the outer "Continue" button stays disabled (gating already exists via `allDone`).
- Add a **modal popup** (using existing `AlertDialog` from `@/components/ui/alert-dialog`) that fires when MSME verification fails specifically due to name mismatch. Title: "Enterprise Name mismatch". Body: the exact required message. Single OK button to dismiss. State: `msmeNameMismatchOpen`.
- Active tab handling: do not auto-advance to Bank when MSME fails (already true — `useEffect` only advances when `stage3Done` becomes true).

### `MsmeKycTab.tsx` (Compliance flow)
- Add new prop `gstLegalName?: string` alongside existing `panHolderName?: string`.
- Update both `handleManualVerify` and `handleOcrVerify`:
  - After extracting `apiName`, compute `gstOk = fuzzyNameMatch(apiName, gstLegalName)` and `panOk = fuzzyNameMatch(apiName, panHolderName)`.
  - If both reference names are available and **both** match: success message "Enterprise Name verified with GST Legal Name and PAN Holder Name."
  - If only one matches: success message naming which one matched.
  - If neither matches: return failure with the exact message "Enterprise Name does not match with GST Legal Name and PAN Holder Name." and trigger an `AlertDialog` popup.
- Pass `gstLegalName` from `ComplianceStep.tsx` (already tracks `gstLegalName` per the prior change).

### Navigation block (Compliance flow)
- `MsmeKycTab` already calls `props.onStatusChange('failed')` indirectly through `verify()` setting state.failed. Confirm `ComplianceStep` already gates its outer "Continue" on all four KYC tabs being passed/na — verify and, if missing, add `msme === 'failed'` short-circuit so the parent stepper's Continue stays disabled. Also force `onActiveChange('msme')` to keep the MSME tab active when the popup is dismissed.

---

## 2. Bank — Account Holder Name vs PAN + GST

### `DocumentVerificationStep.tsx`
- In `verifyApi` for the Bank branch (around line 447), after reading `nameAtBank` (currently from `d.name_at_bank`), also accept `d.full_name` as an alternative source: `const apiName = String(d.full_name || d.name_at_bank || "").trim()`.
- Compute:
  - `gstLegalName = gstDoc.ocrData?.legal_name`
  - `panHolderName = panDoc.ocrData?.holder_name || panDoc.ocrData?.full_name`
  - `gstOk = fuzzyNameMatch(apiName, gstLegalName)`
  - `panOk = fuzzyNameMatch(apiName, panHolderName)`
- Decision matrix returned via `apiData.holderNameStatus` + `apiData.holderNameMessage`:
  - `gstOk && panOk` → success, message: "Account Holder Name verified with GST Legal Name and PAN Holder Name."
  - `gstOk && !panOk` → success, message: "Account Holder Name matched with GST Legal Name."
  - `!gstOk && panOk` → success, message: "Account Holder Name matched with PAN Holder Name."
  - `!gstOk && !panOk` → return `{ ok: false, message: "Account Holder Name does not match with GST Legal Name and PAN Holder Name." }`.
- If one of the reference names is missing, fall back to whichever is available; if both missing, keep current pass-through behavior.
- Render the resulting message in the Bank verified panel next to the holder name.

### `BankKycTab.tsx` (already mostly done)
- Current code returns "Account Holder Name matched with PAN Holder Name." when only PAN matches. Per spec, the requested copy only mentions GST-only and both-matched cases. Update messages to exactly:
  - Both: "Account Holder Name verified with GST Legal Name and PAN Holder Name."
  - GST only: "Account Holder Name matched with GST Legal Name."
  - Neither: "Account Holder Name does not match with GST Legal Name and PAN Holder Name."
- Keep the PAN-only branch but with the same "matched with PAN Holder Name" copy (kept for completeness — does not violate the spec).
- Read `apiName` from `apiData.full_name || apiData.name_at_bank` so both Surepass response shapes work.

---

## Technical details

### Files to edit
- `src/components/vendor/steps/DocumentVerificationStep.tsx` — MSME verifyApi name-match block; Bank verifyApi name-match block; new `AlertDialog` for MSME mismatch; small JSX block to render Bank holder-name message.
- `src/components/vendor/kyc/MsmeKycTab.tsx` — add `gstLegalName` prop, extend match logic, add `AlertDialog` for mismatch popup.
- `src/components/vendor/kyc/BankKycTab.tsx` — update message strings, accept `full_name`.
- `src/components/vendor/steps/ComplianceStep.tsx` — pass `gstLegalName` into `MsmeKycTab`; ensure outer Continue stays disabled when MSME tab status is `failed` and force-active-tab on mismatch.

### Reused utilities
- `fuzzyNameMatch` from `src/lib/nameMatch.ts` (already used elsewhere).
- `AlertDialog` from `src/components/ui/alert-dialog.tsx`.

### Gating verification
- Step-1 outer "Continue" is already gated by `allDone = stage1Done && stage2Done && stage3Done && stage4Done`. Setting MSME status to `failed` keeps `stage3Done = false`, so the user cannot advance — exactly what the spec requires. The popup adds a louder UX signal on top of that.

### Out of scope
- No DB/migration changes, no edge-function changes. All logic is client-side using existing GST and PAN data already captured in state.
