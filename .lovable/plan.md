I found the issue: the registration page is still using its own `DocumentVerificationStep.tsx` OCR flow, not the `BankKycTab.tsx` flow that was fixed earlier.

Your screenshot shows `BANK_OCR` returns success with these fields:

```text
raw.data.account_number.value = 1714348594
raw.data.ifsc_code.value = KKBK0007746
```

But in `DocumentVerificationStep.tsx`, the extracted OCR object is built only from `r.data`. If the saved response mapping is incomplete or points to `data.account_number` instead of `data.account_number.value`, the code reads the account as an object / missing value, fails this check:

```text
/^\d{8,18}$/.test(ocrAccountRaw)
```

Because it fails before verification, the `BANK` penny-drop API is never called.

Plan to fix:

1. Reuse the OCR fallback helper in the main registration flow
   - Import `mergeOcrExtracted` into `DocumentVerificationStep.tsx`.
   - After each OCR provider call, merge `r.data` with `r.raw.data` so Surepass `{ value, confidence }` fields become plain strings.
   - This makes `account_number` and `ifsc_code` available as real values even when the admin mapping is imperfect.

2. Make bank verification read nested values defensively
   - Add a local value picker for `DocumentVerificationStep.tsx` that can read:
     - plain strings/numbers
     - `{ value, confidence }` objects
   - Use it for bank account number and IFSC before validation.
   - This prevents `[object Object]` from causing the account regex failure.

3. Keep the penny-drop call from being skipped
   - Ensure the bank flow only stops before `BANK` verification when the OCR truly does not contain account number / IFSC anywhere.
   - If the raw OCR response contains valid account and IFSC, proceed to:

```text
callProvider({ providerName: "BANK", input: { account, ifsc, id_number: account } })
```

4. Improve the failure message for real OCR failures
   - If both mapped and raw OCR payloads are missing valid fields, show a clearer message that says the cheque OCR did not return account/IFSC, instead of implying the bank API was attempted.

5. Optional configuration cleanup
   - Update the `BANK_OCR` template mapping in `KycApiSettings.tsx` to use Surepass value paths:

```text
account_number: data.account_number.value
ifsc_code: data.ifsc_code.value
micr: data.micr.value
```

This prevents newly created provider configs from saving object-valued mappings.

Expected result after implementation:
- Upload cheque.
- `BANK_OCR` succeeds and extracts plain `1714348594` and `KKBK0007746`.
- The flow proceeds to the `BANK` penny-drop verification API.
- You should see two backend function calls in Network: first `BANK_OCR`, then `BANK`.
- The bank tab no longer fails immediately with “Could not read a valid account number” when the OCR response already contains the account number.