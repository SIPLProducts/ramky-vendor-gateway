## Goal

The screenshot mismatch ("Enterprise Name does not match with PAN Holder Name") comes from `src/components/vendor/steps/DocumentVerificationStep.tsx`, a parallel KYC implementation that still uses the old single-reference / 40% check. The newer `MsmeKycTab` / `BankKycTab` already use the shared cross-field 20% policy. This plan brings DocumentVerificationStep in line so:

- **MSME Enterprise Name** passes if it matches **any** of GST Legal Name, PAN Holder Name, or Bank Account Holder Name at >=20%.
- **Bank Account Holder Name** passes if it matches **any** of GST Legal Name, PAN Holder Name, or MSME Enterprise Name at >=20%.
- Below 20% on every available reference -> block with a clear "best Xx% with <field>" message.

No threshold or behavior changes anywhere else.

## File touched

`src/components/vendor/steps/DocumentVerificationStep.tsx` only.

## Changes

1. **Imports**: add `evaluateCrossNameMatch`, `formatCrossMatchSuccess`, `formatCrossMatchFailure`, `NAME_MATCH_MIN_PASS` from `@/lib/nameMatch`. Drop the local `nameMatchPercentage`/threshold use in the four blocks below.

2. **MSME upload flow (~line 665-680)**
   - Replace the PAN-only check with:
     ```ts
     const evalRes = evaluateCrossNameMatch(msmeName, [
       { field: 'GST Legal Name', value: gstDoc.ocrData?.legal_name },
       { field: 'PAN Holder Name', value: panDoc.ocrData?.holder_name || panDoc.ocrData?.full_name },
       { field: 'Bank Account Holder Name', value: bankDoc.ocrData?.account_holder_name },
     ]);
     if (!evalRes.skipped && !evalRes.passed) {
       return { ok:false, message: formatCrossMatchFailure('Enterprise Name', evalRes.best), isNameMismatch:true };
     }
     ```

3. **MSME manual verify flow (~line 1075-1090)**
   - Same replacement; on failure use `formatCrossMatchFailure('Enterprise Name', evalRes.best)` for `setMsmeManualError`, `setMsmeDoc.errorMessage`, and the `mismatchDialog` message.

4. **Bank cheque flow (~line 770-798)**
   - Build the references list for ALL three (GST / PAN / MSME) regardless of `isGstRegistered` / `isMsmeRegistered` flags (any non-empty value is a valid cross-reference; that's the user's request).
   - Call `evaluateCrossNameMatch(nameAtBank, refs)`.
   - On fail return `formatCrossMatchFailure('Account Holder Name', evalRes.best)`.
   - On pass set `holderNameMessage = formatCrossMatchSuccess('Account Holder Name', evalRes.matches)`.

5. **Bank manual popup flow (~line 1240-1262)**
   - Same replacement as step 4 (build refs from all three, evaluate, format success/failure messages).

6. **Threshold constant**: any local `>= 40` / `< 40` literals in these four blocks are removed; the gate is owned by `NAME_MATCH_MIN_PASS` (20) inside the helper.

## Out of scope

- No DB / edge-function / migration changes.
- No UI restyling.
- No changes to `MsmeKycTab` / `BankKycTab` (already correct).
- No changes to the OCR / verify provider calls or the `isGstRegistered` / `isMsmeRegistered` gating elsewhere in the file.
