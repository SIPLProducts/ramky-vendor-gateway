## Problem

When the Bank KYC cross-name check fails, the current inline red banner reads:

> Account Holder Name does not match any of the verified names (best 0% with GST Legal Name). Minimum required is 20%.

This message is produced by the shared `formatCrossMatchFailure` helper in `src/lib/nameMatch.ts` and is technical and confusing for vendors. The user wants it replaced with a plain, actionable message.

## Goal

Display this exact message for every **Account Holder Name** mismatch case:

> Account Holder Name does not match the GST, PAN, or MSME records. Please upload a cheque belonging to the same person or organization associated with the uploaded GST, PAN, or MSME documents.

All other cross-field mismatch messages (GST Legal Name, PAN Holder Name, Enterprise Name, etc.) must keep the existing generic scoring text unchanged.

## Scope

Only `src/lib/nameMatch.ts` needs to change.

## Changes

1. Open `src/lib/nameMatch.ts`.
2. In the `formatCrossMatchFailure` function, detect when `candidateLabel === 'Account Holder Name'`.
3. For that label, return the user-supplied message directly (skip score/field interpolation).
4. Keep the existing `return` statement as the default for all other labels.

## Affected call sites

The new text will automatically apply wherever the function is called with `formatCrossMatchFailure('Account Holder Name', ...)`:

- `src/components/vendor/steps/DocumentVerificationStep.tsx` (OCR + manual flow)
- `src/components/vendor/kyc/BankKycTab.tsx` (admin Live Test panel)

No other call sites are affected because the condition is scoped to the exact candidate label string.

## Not changed

- `NAME_MATCH_MIN_PASS`, scoring logic, or `evaluateCrossNameMatch` behavior.
- Bank manual-entry popup logic (that fix was already applied earlier).
- Any other KYC tab messaging.

## Result

After the change, vendors will see the clearer, action-oriented message when the cheque account holder name does not align with the already verified GST/PAN/MSME names, while internal/debug-style scoring text remains for the other KYC documents.