
## Goal

Create a dedicated **"KYC / Validation API Settings"** screen, modeled on the existing `SapApiSettings` page, to manage configurations (URL, payload, headers, response mapping, credentials) for the four external services:

- **GST OCR** (`/api/v1/ocr/gst`)
- **PAN OCR** (`/api/v1/ocr/pan`)
- **MSME / Udyog Aadhaar** (`/api/v1/corporate/udyog-aadhaar`)
- **Bank Verification** (`/api/v1/bank-verification/`)

(Default sample base: `https://kyc-api.surepass.app`, matching the uploaded screenshots.)

The existing `api_providers` / `api_credentials` tables already support most of what we need — they are simply not exposed via a real settings page yet (the only consumer is buried inside `SharviAdminConsole`). We will add a first-class page, a list/edit flow, a test action, and wire the validation edge functions to read from these configs instead of the hardcoded Cashfree URLs.

## Database

Use the existing tables; add a few small things via migration:

1. `api_providers`
   - Add column `request_mode text default 'json'` — values: `json`, `multipart` (for OCR file uploads), `form`.
   - Add column `file_field_name text` — multipart field name for the file (e.g. `file`).
   - Add column `category text default 'VALIDATION'` — values: `OCR`, `VALIDATION`. Used to group on the screen.
   - Allow `tenant_id` to be `NULL` for **global** (system-wide) providers, since OCR/KYC keys are typically shared across tenants. Update RLS to also allow `sharvi_admin` to read/write rows with `tenant_id IS NULL`.
2. Seed 4 default rows (idempotent `ON CONFLICT DO NOTHING`) for GST OCR, PAN OCR, MSME, Bank, with the Surepass URLs as defaults so the screen is non-empty on first open.
3. RLS: `sharvi_admin` full CRUD on `api_providers` and `api_credentials`; existing tenant-scoped policies remain.

## New Page: `/admin/kyc-api-settings`

File: `src/pages/KycApiSettings.tsx` — list view, modeled on `SapApiSettings.tsx`.

Layout:

```text
┌───────────────────────────────────────────────────────────────┐
│ KYC & Validation API Settings              [System Admin]     │
├───────────────────────────────────────────────────────────────┤
│ Tabs: [ OCR APIs ] [ Validation APIs ]                        │
│                                       [Export] [Import] [+Add]│
│ ┌─────────────────────────────────────────────────────────┐   │
│ │ Name      │ Endpoint                  │ Method │ Auth   │   │
│ │ GST OCR   │ POST .../ocr/gst          │ POST   │ Bearer │   │
│ │ PAN OCR   │ POST .../ocr/pan          │ POST   │ Bearer │   │
│ │ MSME      │ POST .../udyog-aadhaar    │ POST   │ Bearer │   │
│ │ Bank      │ POST .../bank-verification│ POST   │ Bearer │   │
│ └─────────────────────────────────────────────────────────┘   │
│ Per-row actions: [Test] [Edit] [Delete]                       │
└───────────────────────────────────────────────────────────────┘
```

Tabs split by the new `category` column (OCR vs Validation).

## New Page: `/admin/kyc-api-settings/:id`

File: `src/pages/KycApiConfigEdit.tsx` — edit view, modeled on `SapApiConfigEdit.tsx`, with sub-tabs:

1. **Basic** — display name, provider type (GST_OCR / PAN_OCR / MSME / BANK / CUSTOM), base URL, endpoint path, HTTP method, request mode (`json` / `multipart`), file field name (multipart only), timeout, retry count, enabled, mandatory.
2. **Authentication** — auth type (`API_KEY` / `BEARER_TOKEN` / `BASIC` / `NONE`), header name, header prefix; credential value stored in `api_credentials` (masked input, "show/hide", saved separately).
3. **Headers** — JSON editor for `request_headers` (Surepass needs `Authorization: Bearer <token>`).
4. **Request payload** — JSON template editor with `{{placeholders}}` (e.g. `{ "id_number": "{{gstin}}" }`, `{ "id_number": "{{msme}}" }`, `{ "id_number": "{{account}}", "ifsc": "{{ifsc}}", "ifsc_details": true }`). For multipart OCR there is no body — the screen shows the file field name and a help note.
5. **Response mapping** — JSON editor for `response_data_mapping` (e.g. `{ "legalName": "data.legal_name", "tradeName": "data.trade_name" }`) plus `response_success_path` / `response_success_value`.
6. **Test** — pick a sample value (GSTIN / PAN / MSME / account+IFSC) or upload a file (for OCR), call a new edge function `kyc-api-test`, show status, latency, raw response, and the mapped result.

Reuse `Card`, `Tabs`, `Table`, `Input`, `Textarea`, `Switch`, `Select`, `Dialog`, `AlertDialog` from `src/components/ui` and the same enterprise styling used in `SapApiConfigEdit.tsx`.

## Hook

File: `src/hooks/useKycApiConfigs.tsx` — mirrors `useSapApiConfigs.tsx`:

- `useKycApiProviders(category?)`, `useKycApiProvider(id)`
- `useCreateKycApiProvider`, `useUpdateKycApiProvider`, `useDeleteKycApiProvider`
- `useKycApiCredential(id)`, `useSaveKycApiCredential`
- `useTestKycApi(id, sampleInput)` → invokes edge function

All queries hit `api_providers` / `api_credentials` (filtered by `category` and `tenant_id IS NULL OR matches tenant`).

## New Edge Functions

1. **`kyc-api-test`** — accepts `{ providerId, sampleInput, file? (base64) }`, looks up the provider + credential, builds the request from the saved template/headers, calls the upstream API, returns `{ ok, status, latency_ms, response, mappedResult }`. Used by the **Test** sub-tab. CORS, JWT validation, role check (`sharvi_admin`).
2. **`kyc-api-execute`** — generic runtime caller used by the existing validation pipeline. Takes `{ providerName, input }`, resolves the active row from `api_providers`, substitutes `{{placeholders}}` into `request_body_template`, attaches credentials/headers, posts to the upstream API, applies `response_data_mapping`, returns the normalized `{ valid, message, data, simulated }` shape that `validate-gst`, `validate-pan`, `validate-msme`, `validate-bank` already return.

## Wire Existing Validation Functions Through the Config

Update each of these to first try the configured provider (via `kyc-api-execute`), and only fall back to the current Cashfree/simulation path if no active config exists:

- `supabase/functions/validate-gst/index.ts` — provider name `GST` (validation) — falls back to existing simulation if no row.
- `supabase/functions/validate-pan/index.ts` — provider name `PAN`.
- `supabase/functions/validate-msme/index.ts` — provider name `MSME`.
- `supabase/functions/validate-bank/index.ts` — provider name `BANK`.
- `supabase/functions/ocr-extract/index.ts` — for `documentType` ∈ `pan|gst|msme|cheque`, look up the corresponding OCR provider (`PAN_OCR`, `GST_OCR`, `MSME_OCR`, `CHEQUE_OCR`) and POST the file as multipart using `file_field_name`. Falls back to current Lovable AI OCR if no row.

This means the screen is the source of truth, and removing/disabling a row immediately changes runtime behavior.

## Routing & Navigation

- `src/App.tsx` — add two routes (admin-only):
  - `/admin/kyc-api-settings` → `KycApiSettings`
  - `/admin/kyc-api-settings/:id` → `KycApiConfigEdit`
- `src/components/layout/Sidebar.tsx` — add a sidebar entry **"KYC API Settings"** under the existing Admin / SAP grouping (icon: `KeyRound` or `ShieldCheck`), guarded by `sharvi_admin` / system-admin role using the same pattern as the SAP entry.
- Optionally remove the embedded `<ApiProviderConfig />` panel from `SharviAdminConsole` (or keep it tenant-scoped only) so there is one obvious place to manage these.

## Secrets

Surepass / Cashfree / etc. API tokens are stored as `credential_value` in `api_credentials` (encrypted column flag already exists). No new project-level secrets are required for the screen itself. If the user later wants the keys stored as Lovable Cloud secrets instead of in the DB, that is a follow-up.

## Out of Scope

- No change to the registration UI — vendors continue to use `useOcrExtraction` and the validation hooks; the change is invisible to them.
- Penny-drop and name-match are not in this round (can be added later — same pattern, just add provider names `PENNY_DROP`, `NAME_MATCH`).
- No bulk import of pre-shipped vendor templates beyond the 4 seed rows.

## Files Touched

- New: `src/pages/KycApiSettings.tsx`, `src/pages/KycApiConfigEdit.tsx`, `src/hooks/useKycApiConfigs.tsx`, `supabase/functions/kyc-api-test/index.ts`, `supabase/functions/kyc-api-execute/index.ts`
- Edited: `src/App.tsx`, `src/components/layout/Sidebar.tsx`, `supabase/functions/validate-gst/index.ts`, `validate-pan/index.ts`, `validate-msme/index.ts`, `validate-bank/index.ts`, `ocr-extract/index.ts`
- Migration: add columns + seed rows + RLS for `api_providers` / `api_credentials`

## Acceptance

1. Sidebar shows **KYC API Settings** for system admins.
2. Page lists 4 default rows (GST OCR, PAN OCR, MSME, Bank) with editable URL, headers, payload, response mapping, and credentials.
3. Each row has a working **Test** action that calls the upstream API and shows the response.
4. After saving a row, the corresponding `validate-*` / `ocr-extract` function uses the new config on the next vendor submission.
5. Disabling a row makes the validation fall back to the existing simulation path.
