## Goal

In the Domestic GST tab (vendor registration → Document Verification), when "Are you GST Registered? = Yes", swap the GST validation API for Surepass `corporate/gstin-advanced` (with `filing_status_get: true`), show the returned filing-status as a table, and gate auto-advance to the PAN tab on whether the latest period is filed.

Nothing currently working gets deleted — only the GST integration’s endpoint, request body and response mapping are replaced, and the GST tab gains a filing-status table plus a "not filed" modal flow.

## Behavior

After Verify succeeds:

1. Render filing status as a table with columns **Financial Year**, **Tax Period**, **Date of Filing**, **Status**. Source: `data.filing_status[0]` (the API returns a nested array).
2. Compute the "latest expected period" = the most recent month for which `GSTR3B` (or `GSTR1`) should already be filed (i.e. previous calendar month).
3. **If filed:** show a green "Latest return filed" banner above the table and let the existing auto-advance move the form to the **PAN** tab.
4. **If not filed / data unavailable for that month:**
   - Open a modal: "Your latest GST return is not filed. Please download, sign and upload the GST self-declaration to continue."
   - Modal has a **Download Declaration Template** button (reuses `public/templates/gst-self-declaration.docx`).
   - Modal has a **Upload Signed Declaration** file picker.
   - On successful upload, save it as `gstSelfDeclarationFile`, mark GST stage as done, close modal, and auto-advance to the **PAN** tab.

The "No" branch (already supported) is untouched.

## Technical changes

### 1. KYC API provider config — replace endpoint and mapping

File: `src/pages/KycApiSettings.tsx` (GST seed entry around line 62)

- `endpoint_path`: `/api/v1/corporate/gstin-advanced`
- `request_body_template`: `{ id_number: "{{id_number}}", filing_status_get: true }`
- `response_data_mapping` adds:
  - `filing_status: "data.filing_status.0"`
  - `promoters: "data.promoters"`
  - `annual_turnover: "data.annual_turnover"`
  - `annual_turnover_fy: "data.annual_turnover_fy"`
  - `nature_bus_activities: "data.nature_bus_activities"`
  - `principal_address: "data.contact_details.principal.address"`
  - `principal_email: "data.contact_details.principal.email"`
  - `principal_mobile: "data.contact_details.principal.mobile"`
  - `aadhaar_validation: "data.aadhaar_validation"`
  - keep existing fields (gstin, pan_number, legal_name, business_name, gstin_status, date_of_registration, etc.).

### 2. Migrate existing tenant rows

DB migration (apply to every active `kyc_api_providers` row with `provider_name = 'GST'`):

- update `endpoint_path` → `/api/v1/corporate/gstin-advanced`
- merge `filing_status_get: true` into `request_body_template`
- merge the new keys into `response_data_mapping` (do not drop existing keys)

So already-deployed tenants automatically pick up the new endpoint without re-clicking "Reset to default".

### 3. GST tab UI

File: `src/components/vendor/kyc/GstKycTab.tsx`

- Add a new `GstFilingStatusTable` subcomponent (in the same file or `src/components/vendor/kyc/GstFilingStatusTable.tsx`) that renders the rows from `verifiedDetails.filing_status` sorted by `date_of_filing` desc. Styled with the existing white-card / shadcn `Table` look so it matches the SAP Fiori theme already in the app.
- Add a new `GstDeclarationDialog` (shadcn `Dialog`) with: explanation copy, "Download Declaration Template" button (`/templates/gst-self-declaration.docx`), and a `FileUpload` for the signed declaration.
- In `handleManualVerify` and `handleOcrVerify`, after success, evaluate `latestPeriodFiled(filingStatus)`:
  - Helper computes `expectedPeriod = prevMonth(now)` and returns true if any `GSTR3B` row matches that period with `status === 'Filed'`. Fallback to `GSTR1` if `GSTR3B` is absent.
  - If true → call `props.onVerifiedDetails` as today (auto-advance already handled by parent).
  - If false → open the declaration dialog; on successful upload, call `props.onGstSelfDeclarationFileChange(file)` and `props.onVerifiedDetails(merged)` so `stage1Done` flips true and the parent advances to PAN.
- Render `<GstFilingStatusTable />` below the verification block whenever `state.status === 'passed'` and `filing_status` is present.

### 4. Stage gating (no schema change)

`stage1Done` in `DocumentVerificationStep.tsx` already becomes true when GST is verified, and the "not filed" branch sets `gstSelfDeclarationFile` so the existing auto-advance `useEffect` (gst → pan) fires without any change.

### 5. Edge function

`supabase/functions/validate-gst/index.ts` stays as a fallback simulator and is not removed. The real call goes through `kyc-api-execute` → admin-configured Surepass provider, which is the existing pattern (`useConfiguredKycApi.callProvider({ providerName: 'GST' })`).

## Out of scope

- No changes to PAN/MSME/Bank tabs.
- No changes to approval workflow or backend auth.
- No deletion of the current `validate-gst` simulator or the "No, not GST registered" self-declaration flow.