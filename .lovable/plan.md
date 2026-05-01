## Problem

The Bank OCR provider (Surepass cheque OCR) successfully reads the cheque — the network response in the screenshot clearly shows:

```
raw.data.account_number = { value: "1714348594", confidence: 94 }
raw.data.ifsc_code      = { value: "KKBK0007746", confidence: 98 }
```

But the UI shows **"Could not read a valid account number from the cheque"** and the bank validation (penny-drop) API is never called.

### Root cause

The admin-configured `response_data_mapping` for the BANK_OCR provider does not map `account_number` / `ifsc_code` into the normalized `data` object. The edge function returns:

- `data = { message: true, message_code: true }`  ← only generic status fields
- `raw = { data: { account_number: {...}, ifsc_code: {...}, ... } }`  ← actual values

`runBankOcr` in `BankKycTab.tsx` returns `r.data` as `extracted`, so `handleVerify` sees `extracted.account_number === undefined`, fails the length check, marks the step Failed, and never reaches the BANK validation call.

The same risk applies to other docs (GST/PAN/MSME) when their mapping is incomplete or upstream payload shape shifts.

## Fix

Make the OCR consumers resilient to mapping gaps by **falling back to `raw.data`** when the normalized `data` is missing the expected fields. This keeps the configured mapping as the primary source but recovers automatically when fields are unmapped.

### Changes

1. **`src/components/vendor/kyc/BankKycTab.tsx` — `runBankOcr`**
   - Merge fields from `r.raw?.data` into the extracted payload as a fallback (only for keys not already present in `r.data`).
   - Specifically ensure `account_number`, `ifsc_code`, `micr`, `name_at_bank`, `full_name` are pulled from `raw.data` if absent.
   - Continue to handle `{ value, confidence }` shapes via existing `pickString` helper in `handleVerify`.

2. **`src/lib/kycExtract.ts` (new tiny helper)**
   - Export `mergeExtracted(data, raw)` that returns `{ ...rawData, ...data }` (data wins, raw fills gaps), unwrapping top-level `{ value }` objects so downstream code sees plain strings.
   - Reuse in PAN/GST/MSME OCR runners (`PanKycTab`, `GstKycTab`, `MsmeKycTab`) so the same gap-filling protects every tab.

3. **Defensive logging**
   - In `runBankOcr`, when falling back to `raw.data`, `console.warn` once with the provider name + missing key list, so admins can see in the console that their mapping is incomplete and fix it in KYC API Settings.

### Out of scope

- Changing the admin-configured `response_data_mapping` rows in the database — that's a config issue per tenant. The frontend fallback unblocks all current tenants regardless of their mapping.
- Edge function changes — `kyc-api-execute` already returns both `data` and `raw`, which is exactly what we need.

## Expected result

After the fix, uploading the same cheque will:
1. OCR returns `account_number=1714348594`, `ifsc=KKBK0007746` (from `raw.data` fallback).
2. UI proceeds to `verifying` phase and calls the BANK penny-drop provider.
3. Bank Name / Branch are enriched via Razorpay IFSC lookup as before.
4. Holder-name match against GST + PAN runs as before.
