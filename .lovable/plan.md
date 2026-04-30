## Goal

In **KYC & Validation API Settings** (`/admin/kyc-api-settings`):

1. **Remove** the `MSME / Udyam OCR` template (and the existing `MSME_OCR` provider row), since OCR for MSME is no longer needed.
2. **Add** a clearly-named template for the Udyam manual validation API: **"MSME / Udyam Manual"** under the **Validation APIs** tab — pre-wired to the Surepass `udyog-aadhaar` endpoint with the full response mapping (matching the sample payload you shared).
3. The existing `MSME` provider row will be **renamed/repointed** to this new template (same `provider_name = 'MSME'` so the vendor form keeps working — only the display name + the complete response mapping change).

The vendor-side MSME tab already implements **Yes/No → Manual / Upload tabs → Validate button** that triggers the configured `MSME` provider dynamically, so no UI changes are needed there. Only the admin KYC settings screen and the database provider row need updating.

## Changes

### 1. `src/pages/KycApiSettings.tsx`
- **Remove** the `MSME_OCR` entry from the `TEMPLATES` array (lines 52–60). The "MSME / Udyam OCR" Add button will disappear from the OCR tab.
- **Replace** the existing `MSME` template (lines 82–84) with a fully-mapped **"MSME / Udyam Manual"** template:
  - `display_name`: `"MSME / Udyam Manual"`
  - `endpoint_path`: `/api/v1/corporate/udyog-aadhaar`
  - `request_body_template`: `{ id_number: "{{msme}}" }`
  - `response_data_mapping`: full set of dotted paths derived from the sample response (`data.uan`, `data.main_details.name_of_enterprise`, `data.main_details.enterprise_type_list.0.enterprise_type`, `data.main_details.major_activity`, `data.main_details.social_category`, `data.main_details.date_of_commencement`, `data.main_details.date_of_incorporation`, `data.main_details.applied_date`, `data.main_details.registration_date`, `data.main_details.organization_type`, `data.main_details.state`, `data.main_details.dic_name` (district), `data.main_details.city`, `data.main_details.pin`, `data.main_details.flat`, `data.main_details.road`, `data.main_details.village`, `data.main_details.mobile_number`, `data.main_details.email`, `data.main_details.msme_dfo`, `data.nic_code.0.nic_2_digit/4_digit/5_digit`, `data.location_of_plant_details`).

### 2. Database migration
- **Delete** the existing `MSME_OCR` row from `api_providers` (its credentials cascade-delete).
- **Update** the existing `MSME` provider row:
  - `display_name = 'MSME / Udyam Manual'`
  - `response_data_mapping` set to the same complete map as the new template (so providers already added in the database immediately reflect the corrected mapping — matches what's already mostly there but ensures parity).

### 3. No vendor-form changes
`src/components/vendor/kyc/MsmeKycTab.tsx` already:
- Shows **Yes / No** radio for "Are you MSME registered?"
- On **Yes** shows two tabs: **Enter manually** and **Upload certificate**
- Manual tab has Udyam number input + **Validate** button that calls the dynamic `MSME` provider via `useProviderVerify`
- Upload tab keeps existing OCR-based flow (uses the `MSME_OCR` provider only if configured — gracefully shows "not configured" if removed)

`ComplianceStep.tsx` already auto-populates Enterprise name, type, address, contact, NIC, etc. from the dynamic response.

## Result

- Admin's KYC settings screen no longer offers MSME OCR; the Validation APIs tab shows **MSME / Udyam Manual** as the single MSME entry.
- Vendor's MSME tab continues to work: Yes → Manual → enter Udyam number → Validate → all fields populated from the live Surepass response (no hardcoding).