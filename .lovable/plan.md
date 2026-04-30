## Goal

Make Bank (Cheque) OCR + MSME tabs work end-to-end against the dynamic, admin-configured Surepass APIs — no hardcoded values, no mock fallbacks. Source of truth = `api_providers` rows in KYC API Settings.

## Root causes (from current DB + code)

1. **`BANK_OCR.response_data_mapping`** currently contains a **sample response JSON**, not dotted paths. The edge function then falls through to "spread upstream `data` verbatim", so the frontend receives `extracted.account_number = { value: "...", confidence: 94 }` (an object). `BankKycTab.handleVerify` does `String(extracted.account_number)` → `"[object Object]"`, so penny-drop is never even called with sane values.
2. **`BANK` provider mapping** uses camelCase keys (`bankName`, `branchName`) that the UI never reads, and Surepass cheque OCR never returns Bank Name / Branch / Account Holder Name anyway — these have to come from a follow-up source (IFSC lookup is already available in `src/lib/ifscLookup.ts`).
3. **`MSME_OCR`** is configured with `request_mode = "json"`, no `base_url`, and a sample response in the mapping column — it cannot actually accept a file. The Upload tab will always fail.
4. **`MSME`** mapping uses camelCase output keys (`enterpriseName`, `enterpriseType`), but `MsmeKycTab` reads `data.enterprise_name` / `data.enterprise_type`. So a successful API call still leaves the UI blank.

## Plan

### 1. Database migration — fix Surepass mappings & MSME_OCR config

Update the four `api_providers` rows so the edge function extracts the right nested values and uses the right transport.

- `BANK_OCR` (`/api/v1/ocr/cheque`, multipart):
  - `response_data_mapping = { "account_number": "data.account_number.value", "ifsc_code": "data.ifsc_code.value", "micr": "data.micr.value" }`
- `BANK` (penny-drop, json) — keep call shape, normalize output keys to what `BankKycTab` reads:
  - `response_data_mapping = { "account_number": "data.account_number", "ifsc_code": "data.ifsc", "name_at_bank": "data.full_name", "bank_name": "data.bank_name", "branch_name": "data.branch" }`
- `MSME_OCR` — switch to the correct Surepass OCR endpoint and multipart mode:
  - `base_url = 'https://kyc-api.surepass.app'`, `endpoint_path = '/api/v1/ocr/udyam-aadhaar'` (or `/api/v1/ocr/udyog-aadhaar` if endpoint differs — kept identical to other Surepass OCR endpoints), `request_mode = 'multipart'`, `http_method = 'POST'`, `file_field_name = 'file'`, clear any `Content-Type` header.
  - `response_data_mapping = { "udyam_number": "data.ocr_fields.0.uam.value", "enterprise_name": "data.ocr_fields.0.enterprise_name.value", "enterprise_type": "data.ocr_fields.0.enterprise_type.value" }` (paths follow the same Surepass OCR pattern as PAN_OCR / GST_OCR; if `ocr_fields` shape differs we can also map the verification-style `data.main_details.*` paths).
- `MSME` (verification, json) — normalize output keys to snake_case the UI already reads:
  - `response_data_mapping = { "udyam_number": "data.reference_id", "enterprise_name": "data.main_details.name_of_enterprise", "enterprise_type": "data.main_details.enterprise_type_list.0.enterprise_type", "state": "data.main_details.state", "district": "data.main_details.dic_name", "registration_date": "data.main_details.registration_date", "organization_type": "data.main_details.organization_type" }`

No code in the edge function needs to change — `getPath` already handles numeric path segments and the multipart Content-Type stripping is already in place.

### 2. `src/components/vendor/kyc/BankKycTab.tsx` — robust extract + IFSC enrich

- Defensive coercion: handle both `string` and Surepass `{ value, confidence }` shapes when reading `account_number` / `ifsc_code` from `extracted`. (Belt-and-braces for any provider where the admin forgets to map `.value`.)
- After OCR succeeds and IFSC is valid, call `lookupIfsc(ifsc)` from `src/lib/ifscLookup.ts` to populate **Bank Name** and **Branch** (the cheque OCR response doesn't carry them).
- Penny-drop call (`providerName: 'BANK'`) stays as-is, but uses the new normalized `bank_name` / `branch_name` / `name_at_bank` mapping. Account Holder Name comes from penny-drop `name_at_bank`; if penny-drop returns nothing, leave Account Holder Name blank (do not invent a value).
- Surface a clear toast/inline message when a field is genuinely unavailable from the API ("Bank Name / Branch derived from IFSC", "Account Holder Name not provided by bank API").

### 3. `src/components/vendor/kyc/MsmeKycTab.tsx` — wire Manual + Upload properly

- **Manual tab**: already calls `MSME` provider via `useProviderVerify`. Once mapping returns snake_case keys, the existing reads (`data.enterprise_name`, `data.enterprise_type`) start populating fields. Add population of additional fields the form needs (state, district, registration date, organization type) via `onVerifiedDetails`.
- **Upload tab**: keep using `OcrUploadAndVerify` with `runOcr → MSME_OCR`. With the migration, `extracted.udyam_number` and `extracted.enterprise_name` will now be plain strings. Add the same defensive `.value` coercion as BankKycTab in case the admin reconfigures with non-`.value` paths.
- After Upload OCR returns a `udyam_number`, automatically chain the `MSME` verification call (mirrors GST OCR → GST verification chaining we already do) to fetch the full registration details. Merge results and call `onVerifiedDetails`.
- Validation behavior: success → green inline + toast "MSME verified — <enterprise name>"; failure → red inline with the upstream `message` / `message_code`. No silent fallbacks.

### 4. `src/components/vendor/kyc/ApiResponseDetails.tsx`

No change needed — the Surepass `{ value, confidence }` flattening landed in the previous iteration and already renders these responses cleanly.

## Out of scope / explicitly NOT doing

- No hardcoded sample responses anywhere in code or DB.
- No changes to `validate-msme` / `validate-bank` legacy edge functions — the vendor form goes through `kyc-api-execute` only.
- No new edge functions — all routing stays through `kyc-api-execute` driven by `api_providers`.

## Files to change

- `supabase/migrations/<new>.sql` — update 4 rows in `api_providers` (BANK, BANK_OCR, MSME, MSME_OCR).
- `src/components/vendor/kyc/BankKycTab.tsx` — `.value` coercion, IFSC enrichment via `lookupIfsc`.
- `src/components/vendor/kyc/MsmeKycTab.tsx` — `.value` coercion in OCR path, auto-chain MSME verification after OCR, expanded `onVerifiedDetails` payload.

## Verification after build

1. KYC API Settings page for `BANK_OCR` / `MSME_OCR` shows multipart + correct endpoint.
2. Vendor Registration → Bank tab → upload cheque → Account + IFSC populate from response, Bank Name & Branch populate from IFSC lookup, penny-drop verifies and surfaces Account Holder Name when available.
3. Vendor Registration → MSME tab → "Yes" → Manual: enter Udyam → Validate → Enterprise Name / Type / State populate from API. Upload: upload Udyam certificate → OCR extracts Udyam number → auto-chains verification → fields populate.
4. `ApiResponseDetails` card under each tab shows the verbatim Surepass response (no hardcoding), with `value` / `confidence` rendered cleanly.