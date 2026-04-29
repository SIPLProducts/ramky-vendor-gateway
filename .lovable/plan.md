
## Goal

Make Vendor Registration → Compliance step actually call the **admin-configured** APIs in KYC API Settings (GST_OCR, PAN_OCR, MSME, BANK) instead of the current Lovable-AI Gemini OCR + simulated validators. Each tab's behaviour must match the spec:

| Tab | Trigger | Pipeline |
|---|---|---|
| GST | "Yes" + upload GST certificate | `GST_OCR` provider → extract `gstin/legal_name/...` → display & save |
| PAN | Upload PAN card (no Yes/No) | `PAN_OCR` provider → extract `pan_number/full_name/dob/...` → display & save |
| MSME | "Yes" + upload Udyam certificate | `MSME` provider (configured as OCR multipart) → extract → save |
| Bank | Upload cancelled cheque | `BANK_OCR` (new) → extract account+IFSC → `BANK` validation (penny-drop) → auto-fill verified bank fields |

Configuration lives in **KYC API Settings** with one provider row per category. Bearer token is stored once per provider in `api_credentials`. Already wired through `kyc-api-execute`.

---

## Plan

### 1. Seed/repair the four provider templates and response mappings

Update `src/pages/KycApiSettings.tsx` `TEMPLATES` so each row matches the actual Surepass response shape:

- **GST_OCR** (multipart, `file`) — `https://kyc-api.surepass.app/api/v1/ocr/gst`
  - `response_success_path: success`, success value `true`
  - mapping (matches the sample payload you posted):
    - `gstin → data.gstin`
    - `pan_number → data.pan_number`
    - `legal_name → data.legal_name`
    - `business_name → data.business_name`
    - `address → data.address`
    - `gst_status → data.gstin_status`
    - `taxpayer_type → data.taxpayer_type`
    - `registration_date → data.date_of_registration`
    - `constitution_of_business → data.constitution_of_business`

- **PAN_OCR** (multipart, `file`) — `/api/v1/ocr/pan`
  - mapping (handles the nested `ocr_fields[0].xxx.value` shape):
    - `pan_number → data.ocr_fields.0.pan_number.value`
    - `full_name → data.ocr_fields.0.full_name.value`
    - `father_name → data.ocr_fields.0.father_name.value`
    - `dob → data.ocr_fields.0.dob.value`

- **MSME_OCR** (new — multipart, `file`) — `/api/v1/ocr/udyam` (or whichever OCR endpoint is used; admin can edit)
  - mapping: `udyam_number, enterprise_name, enterprise_type, major_activity` from `data.*`

- **BANK_OCR** (new — multipart, `file`) — `/api/v1/ocr/cheque`
  - mapping: `account_number, ifsc_code, bank_name, branch_name, account_holder_name` from `data.*`

- **BANK** (existing JSON validation) — `/api/v1/bank-verification/`
  - body template: `{ "id_number": "{{account}}", "ifsc": "{{ifsc}}", "ifsc_details": true }`
  - mapping: `name_at_bank → data.full_name`, `bank_name → data.ifsc_details.bank_name`, `branch_name → data.ifsc_details.branch`, `ifsc → data.ifsc`

`kyc-api-execute` already supports `getPath` with numeric indices (`split(".").reduce`) — I'll add explicit array index handling so paths like `data.ocr_fields.0.pan_number.value` resolve.

### 2. Extend `getPath` in `supabase/functions/kyc-api-execute/index.ts`

Update the reducer so numeric segments index into arrays:
```ts
function getPath(obj, path) {
  if (!path) return undefined;
  return path.split(".").reduce((a, k) => {
    if (a == null) return a;
    const idx = /^\d+$/.test(k) ? Number(k) : k;
    return a[idx];
  }, obj);
}
```
Also: when `response_success_path` is missing, fall back to `parsed.success === true` (Surepass convention).

### 3. New shared client hook: `useConfiguredKycApi`

`src/hooks/useConfiguredKycApi.tsx` — thin wrapper around `supabase.functions.invoke('kyc-api-execute', { body: { providerName, fileBase64, fileMimeType, input } })`. Returns `{ found, ok, message, data, raw }`.

This becomes the single entry point used by all four KYC tabs and the admin Live Test panel.

### 4. Refactor each KYC tab to use configured providers

For OCR-driven tabs, replace the call to `useOcrExtraction` (which hits the Lovable AI Gemini function) with `useConfiguredKycApi`:

- **`GstKycTab.tsx`**: `OcrUploadAndVerify` callback now does **one** call → `kyc-api-execute({ providerName: 'GST_OCR', fileBase64, fileMimeType })`. The returned `data` already contains the verified GST record — no second `validate-gst` call needed. Show the result in `OcrComparisonCard` (single column, since OCR == validation here). Drop GSTIN to parent via `onGstinChange` and bubble `onVerifiedDetails` for downstream auto-fill.
- **`PanKycTab.tsx`**: Same pattern with `PAN_OCR`. Use the mapped `pan_number` and `full_name` for display + name-match against `legalName`.
- **`MsmeKycTab.tsx`**: Same pattern with `MSME_OCR` (when registered). Manual entry tab can stay but its "Verify" button also goes through the configured `MSME` JSON validation provider via `kyc-api-execute`.
- **`BankKycTab.tsx`**: Two-step pipeline:
  1. `kyc-api-execute({ providerName: 'BANK_OCR', fileBase64, fileMimeType })` → extracts `account_number` + `ifsc_code`.
  2. `kyc-api-execute({ providerName: 'BANK', input: { account, ifsc } })` → penny-drop validation. Auto-fill `bankAccountNumber`, `ifscCode`, `bankName`, `branchName`, `accountHolderName` on success.

Helper `OcrUploadAndVerify` keeps its current pipeline shape (OCR phase → verify phase → result), so the UX stays identical.

### 5. Refactor `OcrUploadAndVerify` to be provider-aware

Add an optional `runOcr` prop — when provided, the component calls it instead of the built-in `useOcrExtraction`. Each tab passes a closure that uses `useConfiguredKycApi` with its own `providerName`. This keeps the file-upload UI and result panel reusable.

### 6. Admin "Live Test" panel: no changes needed

`KycLiveTestPanel` already mounts the same four KYC components, so once the components switch to configured providers, the admin test screen automatically exercises the live APIs end-to-end.

### 7. Bearer token configuration

In `src/pages/KycApiConfigEdit.tsx` (already exists) admins enter the Surepass bearer token under the credential field `API_TOKEN`. The execute function already injects it as `Authorization: Bearer <token>`.

### 8. Edge function deploy

Deploy `kyc-api-execute` after the `getPath` fix.

---

## Files

**Edited**
- `src/pages/KycApiSettings.tsx` — corrected `TEMPLATES` (4 → 5 entries, refined mappings)
- `src/components/vendor/kyc/OcrUploadAndVerify.tsx` — accept optional `runOcr`
- `src/components/vendor/kyc/GstKycTab.tsx` — call `GST_OCR` provider; remove second validate-gst call
- `src/components/vendor/kyc/PanKycTab.tsx` — call `PAN_OCR` provider
- `src/components/vendor/kyc/MsmeKycTab.tsx` — call `MSME_OCR` (upload) and `MSME` (manual)
- `src/components/vendor/kyc/BankKycTab.tsx` — chain `BANK_OCR` then `BANK`
- `supabase/functions/kyc-api-execute/index.ts` — array-index `getPath`, default success on `parsed.success`

**New**
- `src/hooks/useConfiguredKycApi.tsx`

**No changes**
- `src/components/admin/KycLiveTestPanel.tsx`, `KycTabs.tsx` — automatically inherit new behaviour

---

## After approval

I'll also tell you exactly what to enter in **KYC API Settings** for each provider (Base URL, endpoint, file field name, bearer token field) so the live calls succeed on first try.
