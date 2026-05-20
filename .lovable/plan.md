# Why it still looks like the "old API"

The endpoint is already switched correctly — `api_providers` row for `GST` points to:

```
POST https://kyc-api.surepass.app/api/v1/corporate/gstin-advanced
{ "id_number": "{{id_number}}", "filing_status_get": true }
```

and the network tab confirms the frontend calls `kyc-api-execute` (which uses that row). So the **URL** is new, but the **response shown in the UI** is wrong because `response_data_mapping` for the `GST` row is corrupted.

Today the column holds a mix of:
- a few correct JSON path strings (`"filing_status": "data.filing_status.0"`, `"annual_turnover": "data.annual_turnover"`, …), **plus**
- the entire sample response was accidentally merged in, so keys like `legal_name`, `business_name`, `gstin_status`, `date_of_registration`, `taxpayer_type`, `constitution_of_business`, `center_jurisdiction`, `state_jurisdiction`, `pan_number`, `nature_bus_activities`, `contact_details`, `data`, `success`, `status_code`, `message_code` are stored as **literal values** (strings or objects), not as JSON paths.

What `kyc-api-execute` then does:
- For each entry whose value is a string it calls `getPath(parsed, value)`. So `getPath(parsed, "SHARVI INFOTECH PRIVATE LIMITED")` returns `undefined` → `data.legal_name` is blank.
- Object/array values are skipped with a warning.
- Net effect: only `filing_status`, `promoters`, `annual_turnover`, `annual_turnover_fy`, `aadhaar_validation*`, `nature_bus_activities`, `principal_email/mobile/address` come through. `legal_name`, `business_name`, `gstin`, `gstin_status`, `date_of_registration`, `taxpayer_type`, `constitution_of_business`, jurisdictions, `pan_number` come through as `undefined`.

That's why the screen still looks like the old verification (and why legal-name cross-check + the filing-status filed banner can mis-evaluate).

# Fix

Single SQL migration that **replaces** `api_providers.response_data_mapping` for `provider_name = 'GST'` with a clean path-only object — no source change needed, no UI change needed, no edge-function change needed.

Clean mapping to write:

```json
{
  "gstin":                    "data.gstin",
  "pan_number":               "data.pan_number",
  "legal_name":               "data.legal_name",
  "business_name":            "data.business_name",
  "trade_name":               "data.business_name",
  "gstin_status":             "data.gstin_status",
  "date_of_registration":     "data.date_of_registration",
  "date_of_cancellation":     "data.date_of_cancellation",
  "taxpayer_type":            "data.taxpayer_type",
  "constitution_of_business": "data.constitution_of_business",
  "center_jurisdiction":      "data.center_jurisdiction",
  "state_jurisdiction":       "data.state_jurisdiction",
  "nature_bus_activities":    "data.nature_bus_activities",
  "field_visit_conducted":    "data.field_visit_conducted",
  "annual_turnover":          "data.annual_turnover",
  "annual_turnover_fy":       "data.annual_turnover_fy",
  "percentage_in_cash":       "data.percentage_in_cash",
  "percentage_in_cash_fy":    "data.percentage_in_cash_fy",
  "aadhaar_validation":       "data.aadhaar_validation",
  "aadhaar_validation_date":  "data.aadhaar_validation_date",
  "einvoice_status":          "data.einvoice_status",
  "promoters":                "data.promoters",
  "principal_address":        "data.contact_details.principal.address",
  "principal_email":          "data.contact_details.principal.email",
  "principal_mobile":         "data.contact_details.principal.mobile",
  "principal_nature_of_business": "data.contact_details.principal.nature_of_business",
  "filing_status":            "data.filing_status.0"
}
```

Notes:
- `data.filing_status.0` already resolves the outer `[[ … ]]` wrapper into the flat array the table component (`normalizeFilingStatus` / `GstFilingStatusTable`) expects.
- Keeping `legal_name` + `business_name` populated re-enables the cross-name check banner and the "GSTIN is verified — <name>" success message.
- No frontend code is touched; the existing `GstKycTab` flow (auto-advance to PAN on filed, declaration dialog on not-filed) keeps working.

# Out of scope

- The OCR (`GST_OCR`) provider — unchanged.
- The legacy `supabase/functions/validate-gst/index.ts` — no longer in the call path, leave it alone.
- UI / table / declaration dialog — no changes (table format already matches the reference from the previous turn).

# Technical detail

One migration:

```sql
UPDATE public.api_providers
SET response_data_mapping = '<json above>'::jsonb,
    updated_at = now()
WHERE provider_name = 'GST';
```
