# Accept alphanumeric bank account numbers (e.g. SBLNSTN15506)

## What changes
Bank account numbers can contain letters and digits (8–18 characters, no spaces or symbols). Letters are converted to capitals. Applies to both the cheque OCR read and the "Enter bank details manually" popup. Everything else (IFSC check, penny-drop verification, name match, document saving rules) stays the same.

## Technical details
- `src/components/vendor/steps/DocumentVerificationStep.tsx`
  - OCR (~line 1110): normalize `ocrAccountRaw` to uppercase, check `/^[A-Z0-9]{8,18}$/` instead of `/^\d{8,18}$/`.
  - Manual popup (~line 1836): uppercase, check `/^[A-Z0-9]{8,18}$/`; error text "Enter a valid account number (8–18 letters or digits)."
  - Ensure the account input in the popup has no numeric-only `inputMode`/digit stripping.
- `src/components/vendor/kyc/BankKycTab.tsx` (admin live test): same rule/message for consistency.
- Shared helper `isValidBankAccount` in `src/lib/kycDocRetention.ts`-adjacent new file `src/lib/bankAccount.ts` with a small test: `SBLNSTN15506` passes, `123456789012` passes, `ab12` fails, `ABC-123456` fails.
- Frontend only; no database or function change. Provider still decides if the account actually exists.
