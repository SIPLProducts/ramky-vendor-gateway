## Goal
Add a new **"GST Filing Status"** validation API to the KYC & Validation Settings (Validation tab), and wire it into the domestic vendor registration flow as a separate step after GST OCR + GST Validation.

## 1. New API provider template (KYC Settings → Validation tab)

Add a new template card in `src/pages/KycApiSettings.tsx` `TEMPLATES` array:

```
provider_name: "GST_FILING"
display_name: "GST Filing Status"
category:     "VALIDATION"
base_url:     "https://kyc-api.surepass.app"
endpoint_path:"/api/v1/corporate/gstin-advanced"   // same Surepass endpoint, separate provider row
request_mode: "json"
request_body_template: { id_number: "{{id_number}}", filing_status_get: true }
response_data_mapping: {
  gstin: "data.gstin",
  legal_name: "data.legal_name",
  filing_status: "data.filing_status",       // full nested array (used by the table)
  filing_frequency: "data.filing_frequency",
}
```

A new "+ GST Filing Status" button will appear in the Validation tab header next to the existing template buttons. Clicking it creates the provider row and opens the detail editor (same flow as the other templates).

**Duplicate-key error fix** (`api_providers_tenant_provider_uniq`):
The red "Failed to save … duplicate key" toast happens when the same `provider_name` already exists for the tenant. In `addFromTemplate` (KycApiSettings.tsx) catch this case and:
- if a provider with the same `provider_name` already exists → navigate to its edit page instead of inserting,
- show a friendlier toast ("This API is already configured — opening it for editing").

## 2. Wiring into the vendor registration domestic flow

File: `src/components/vendor/kyc/GstKycTab.tsx`

Today GST Validation already returns `filing_status` (because GSTIN provider sends `filing_status_get: true`) and the tab already renders `GstFilingStatusTable` + opens the self-declaration dialog when the latest period isn't filed. We will split this into a discrete, user-visible step that matches the requested UX:

1. After successful **GST Validation** (manual or OCR-chained), do NOT immediately gate next-tab navigation on filing status. Instead render a new sub-section:

   ```
   ── GST Filing Status Check ─────────────────
   [ 🔄 Check GST Filing Status ]   (button)
   ```

2. Clicking **Check GST Filing Status** calls the new `GST_FILING` provider via `useConfiguredKycApi.callProvider({ providerName: 'GST_FILING', body: { id_number: gstin } })`. While running, show a spinner on the button.

3. On response:
   - Parse `data.filing_status` with the existing `normalizeFilingStatus`, **dedupe per `financial_year|tax_period`** (prefer GSTR3B over GSTR1), sort by `date_of_filing` desc, take the **last 3 months**.
   - Render the table with columns: **Month | Return Type | Status | Date of Filing**.
   - Compute `COMPLIANT = every row.status === "Filed"`.

4. Conditional UI:
   - **COMPLIANT** → show a green badge **"GST Filing: COMPLIANT"** to the right of the table, persist the full response via the existing `persistGstValidation` helper, and call `props.onVerifiedDetails` so the registration wizard auto-advances to the **PAN tab** (same handler used today).
   - **NOT COMPLIANT** → show an amber alert **"⚠ GST Not Filed for Last Month"** on the right of the table, and below the table render the existing **Self Declaration Form** block (template download + mandatory upload). The wizard's PAN tab stays blocked until the declaration file is uploaded. After upload, persist the data and advance to PAN.

5. The auto-trigger of `handleFilingStatusAfterVerify` inside `handleManualVerify` / `handleOcrVerify` is replaced by the explicit **Check GST Filing Status** button so the user sees the new step. (The button is auto-clicked once on first GST verify success, so the existing flow keeps working without an extra click — but the section, table, and badge are now always visible.)

## 3. View Details (GST Compliance Report tab)
No code change needed. `buildGstComplianceReport` in `VendorReviewDialog.tsx` already reads `vendor_validations.details.filing_status`, and the new `GST_FILING` call writes to the same row via `persistGstValidation`, so the report tab will keep working with the dedicated provider's response.

## 4. Files touched
- `src/pages/KycApiSettings.tsx` — add `GST_FILING` template; handle unique-constraint error in `addFromTemplate`.
- `src/components/vendor/kyc/GstKycTab.tsx` — add "GST Filing Status Check" section, refresh button, compliant badge, gated auto-advance.
- (No DB migration, no new edge function — uses existing `kyc-api-execute` + `vendor_validations` schema.)

## Open question
The Surepass `gstin-advanced` endpoint already returns `filing_status` in one call, so the new "GST Filing Status" provider hits the same URL. If you have a different dedicated Surepass endpoint for filing status (e.g. `/corporate/gstin-filing`), reply with the path and I'll use that instead — the rest of the plan is identical.