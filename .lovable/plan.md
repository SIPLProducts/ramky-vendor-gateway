
## Goal

Make the **KYC & Validation API Settings** screen the single source of truth for every KYC call (GST, PAN, MSME, Bank/Cheque) made from the **Vendor Registration** form. Disconnect the legacy hardcoded edge functions (`validate-gst`, `validate-pan`, `validate-msme`, `validate-bank`, `validate-penny-drop`, `ocr-extract`) from the registration KYC tabs so admins fully control endpoints, headers, payloads and response mapping from one place.

---

## AS-IS (today)

The vendor registration KYC tabs use a **mix of two pipelines** depending on which sub-action the user picks. This is the root cause of confusion.

```text
Vendor Registration → KYC Tabs
│
├── GST tab
│   ├── "Enter manually" → useFieldValidation.validateGST()
│   │                     → edge fn: validate-gst   ◄── HARDCODED, ignores admin settings
│   └── "Upload certificate" → useConfiguredKycApi(GST_OCR)
│                            → edge fn: kyc-api-execute  ◄── uses KYC API Settings ✅
│
├── PAN tab
│   └── Upload PAN → useConfiguredKycApi(PAN_OCR)
│                  → kyc-api-execute  ◄── uses KYC API Settings ✅
│
├── MSME tab
│   ├── "Enter manually" → useFieldValidation.validateMSME()
│   │                     → edge fn: validate-msme  ◄── HARDCODED
│   └── "Upload certificate" → useConfiguredKycApi(MSME_OCR)
│                            → kyc-api-execute  ◄── uses KYC API Settings ✅
│
└── Bank tab
    └── Upload cheque → BANK_OCR (configured) + BANK penny-drop (configured)
                       → kyc-api-execute  ◄── uses KYC API Settings ✅
```

Other places that still call the hardcoded validators (out of scope for the registration form, but noted for awareness):
- `useVendorRegistration.tsx` (auto-validate on save)
- `validation-orchestrator` edge function
- `DocumentVerification.tsx`, `GstCompliance.tsx`, `PennyDropDemo.tsx`

**Problem:** when an admin updates a Surepass URL/header/key in *KYC & Validation API Settings*, the **manual-entry** GST and MSME paths in registration **do not pick it up** — they still hit the hardcoded `validate-gst` / `validate-msme` edge functions with their own credentials/secrets. PAN and Bank are already clean.

---

## TO-BE (target)

Every KYC call originating from the vendor registration form goes through one funnel: `useConfiguredKycApi → kyc-api-execute → admin-configured provider`.

```text
Vendor Registration → KYC Tabs
│
├── GST tab (manual OR upload)  ─┐
├── PAN tab (upload)              │   useConfiguredKycApi
├── MSME tab (manual OR upload)   ├──►  (callProvider by name)
└── Bank tab (upload cheque)     ─┘            │
                                                ▼
                                       supabase fn: kyc-api-execute
                                                │
                                                ▼
                              ┌───────────────────────────────────┐
                              │  KYC & Validation API Settings    │
                              │  (admin-configured providers)     │
                              │                                   │
                              │  OCR:        GST_OCR, PAN_OCR,    │
                              │              MSME_OCR, BANK_OCR   │
                              │  Validation: GST, PAN, MSME, BANK │
                              └───────────────────────────────────┘
```

Provider-name contract used by registration (must exist in KYC API Settings):

| Tab  | Action          | Provider name | Mode      |
|------|-----------------|---------------|-----------|
| GST  | Manual verify   | `GST`         | json      |
| GST  | Upload + verify | `GST_OCR`     | multipart |
| PAN  | Upload + verify | `PAN_OCR`     | multipart |
| MSME | Manual verify   | `MSME`        | json      |
| MSME | Upload + verify | `MSME_OCR`    | multipart |
| Bank | Cheque OCR      | `BANK_OCR`    | multipart |
| Bank | Penny-drop      | `BANK`        | json      |

If a provider is not configured or disabled, the tab shows a clear inline message:
*"This verification is not configured. Ask your admin to add the **GST** provider in KYC & Validation API Settings."*

---

## Changes

### 1. Disconnect manual-entry GST from `validate-gst`
File: `src/components/vendor/kyc/GstKycTab.tsx`
- Remove `useFieldValidation` usage.
- Replace `handleManualVerify` with a call to `callProvider({ providerName: 'GST', input: { gstin } })`.
- Drive the local verify state from the result (idle/validating/passed/failed) instead of `validationStates.gst`.
- Keep the existing name-match logic on the returned payload.
- Add a `GST` template entry (json mode, `id_number: "{{gstin}}"`) in `KycApiSettings.tsx`.

### 2. Disconnect manual-entry MSME from `validate-msme`
File: `src/components/vendor/kyc/MsmeKycTab.tsx`
- Same treatment as GST, using provider `MSME` (template already exists in KYC API Settings).
- Remove `useFieldValidation` import and `validateMSME` call.

### 3. Add a small local state hook for manual verify
New helper inside each tab (or a tiny shared `useProviderVerify`) so we no longer depend on `useFieldValidation` for the registration KYC tabs. Shape mirrors `FieldValidationState` so `ManualEntryAndVerify` keeps working unchanged.

### 4. Add the missing `GST` validation template
File: `src/pages/KycApiSettings.tsx` — add to `TEMPLATES`:
```ts
{ provider_name: "GST", display_name: "GSTIN Validation", category: "VALIDATION",
  base_url: "https://kyc-api.surepass.app",
  endpoint_path: "/api/v1/corporate/gstin",
  request_mode: "json",
  request_body_template: { id_number: "{{gstin}}" },
  response_data_mapping: {
    gstin: "data.gstin",
    legal_name: "data.legal_name",
    business_name: "data.business_name",
    pan_number: "data.pan_number",
    gst_status: "data.gstin_status",
  } }
```

### 5. "Not configured" UX
File: `src/components/vendor/kyc/OcrUploadAndVerify.tsx` and `ManualEntryAndVerify.tsx`
- When `callProvider` returns `found: false`, surface a friendly inline alert with a deep-link button: *"Open KYC & Validation API Settings"* → `/admin/kyc-api-settings` (only shown to admins; otherwise plain message).

### 6. Out of scope (kept as-is for now)
The following still call the legacy edge functions because they belong to other screens, not the vendor registration form:
- `useVendorRegistration.tsx` server-side re-validation on save
- `validation-orchestrator`, `DocumentVerification.tsx`, `GstCompliance.tsx`, `PennyDropDemo.tsx`

We will **not** delete the `validate-gst / validate-pan / validate-msme / validate-bank / validate-penny-drop / ocr-extract` edge functions in this change, so those other screens keep working. They simply stop being called from the vendor registration KYC tabs.

---

## Verification checklist after implementation

1. KYC API Settings → add **GST** (Validation) and confirm GST_OCR, PAN_OCR, MSME_OCR, MSME, BANK_OCR, BANK are present.
2. Vendor Registration → GST tab → "Enter manually" → click Verify → network shows `kyc-api-execute` (not `validate-gst`).
3. Same check for MSME manual entry.
4. Disable the `GST` provider in settings → manual verify in registration shows the friendly "not configured" alert.
5. PAN and Bank tabs continue to work unchanged.
