## Problem
The earlier change was made in `BankKycTab.tsx`, but the screenshot is from the newer `DocumentVerificationStep.tsx` bank flow. That screen still handles cheque failures with the old failed banner / mismatch dialog path, so the manual Account Number + IFSC popup is not triggered there.

## Plan
1. **Add bank manual-entry popup state to `DocumentVerificationStep.tsx`**
   - Track popup open/close, account number, IFSC, submitting state, error text, and whether it is for primary or secondary bank account.

2. **Open the popup on any primary/secondary cheque failure**
   - In the cheque branch of `runDocFlow`, when OCR fails, extracted Account/IFSC is invalid, penny-drop fails, provider returns 500/internal error, rate-limit, or account-holder mismatch, open the manual popup instead of only showing the failed banner/re-upload dialog.
   - Prefill Account Number / IFSC if the OCR response contains partial values.

3. **Submit manual details through configured Bank Verification API**
   - On popup Submit, call the configured `BANK` provider with `{ account, ifsc, id_number: account }`.
   - Reuse the same bank normalization, IFSC enrichment, and GST/PAN name-match rules so successful response fills Account Number, IFSC, Bank Name, Branch, Account Holder Name, and status becomes verified.
   - If API still fails, keep the popup open and show the actual provider error inside it so the user can correct and retry.

4. **Update old bank failure dialog action**
   - Replace the “Re-upload cheque” only path with popup-first behavior for bank failures, while leaving MSME/GST/PAN behavior unchanged.

## Files to change
- `src/components/vendor/steps/DocumentVerificationStep.tsx`

## Out of scope
- No database/backend changes.
- No changes to GST, PAN, or MSME verification logic except keeping MSME “No” as already changed.