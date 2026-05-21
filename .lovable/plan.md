## Issue
For international vendors, SAP creates the vendor but the bank record is dropped. Domestic works because `bank_key` is populated with IFSC. In the international branch of `src/lib/sapPayloadBuilder.ts` (line 300), `bank_key` is hard-coded to `""`, so SAP receives:

```json
"bank_key": "",
"bank_acct": "1714348594",
"swift_code": "KKBK0...",
"iban": "DE89..."
```

SAP's BAPI requires a non-empty `bank_key` (BANKL) to create a bank entry — when empty, it silently skips persisting the bank. SWIFT/IBAN alone are not enough.

The user's reference payload confirms expectation: international rows should carry the same `bank_key`/`bank_acct`/`bank_ctry`/`accountholder`/`bankaccountname` keys as domestic, with `iban` (and `swift_code`) added on top.

## Fix
**File:** `src/lib/sapPayloadBuilder.ts` (lines 298–306, international `intlOverrides` block)

Populate `bank_key` for international vendors using SWIFT as the bank key (fallback to IBAN, then empty). Keep all other bank fields as already mapped.

```ts
bank_ctry: trunc(bank.bankCountry || company.country, 3),
bank_key: trunc(bank.swiftCode || bank.ibanNumber || "", 15),
bank_acct: trunc(bank.accountNumber, 18),
accountholder: trunc(bank.companyName, 60),
bankaccountname: trunc(bank.bankName, 60),
swift_code: trunc(bank.swiftCode, 11),
iban: trunc(bank.ibanNumber, 34),
iban2: "",
```

Also ensure `bankdetailid` stays `"0001"` (already from template, no change needed).

## Out of scope
- No template change, no schema change, no second bank record support (`bankdetailid2`) — the user's sample shows two banks but current UI only collects one international bank; leaving that as-is.
- No change to domestic flow.

## Verify
1. Submit/sync an international vendor with SWIFT + IBAN + account number.
2. Open the SAP payload preview (or edge function log) — confirm root-level `bank_key` is non-empty (= SWIFT), `bank_acct` populated, `iban` populated, `bank_ctry` correct.
3. Confirm SAP response now contains the bank record under the created vendor.
