## MSME / Udyam Validation — Fix the response → form mapping

The MSME tab in Vendor Registration already has the correct UI flow:

- Yes / No radio for "Are you MSME registered?"
- When **Yes** → two sub-tabs: **Manual Entry** and **Upload certificate**
- **Manual** shows Udyam Number input + **Validate** button that dynamically calls the provider configured in **KYC API Settings → MSME** (no hardcoded values)
- **Upload** runs OCR (if `MSME_OCR` provider is configured) and chains to the MSME validation API
- API response is shown inline via `ApiResponseDetails`, and on success the form auto-populates an "MSME Certificate Details" card

What does **not** work today is that the configured `response_data_mapping` for the `MSME` provider points to fields that **do not exist** in the actual Surepass response you shared. Result: the Validate call succeeds, but most fields come back empty so the UI looks broken.

### Concrete bugs in the current mapping (from `api_providers.MSME`)

| Output key | Current path (wrong) | Correct path for the response you shared |
|---|---|---|
| `udyam_number` | `data.reference_id` | `data.uan` |
| `mobile` | `data.main_details.mobile` | `data.main_details.mobile_number` |
| `pin_code` | `data.main_details.pin` (already correct) | keep |
| `enterprise_type` | `…enterprise_type_list.0.enterprise_type` | keep (correct) |

Also missing entirely from the mapping (but present in the response and useful):
`date_of_incorporation`, `date_of_commencement`, `city`, `village`, `road`, `flat`, `applied_date`, `nic_code` (first row), `plant_locations` (array).

### Plan

1. **Migration — fix and extend the `MSME` response mapping** in `api_providers` so every field the user listed populates correctly:
   ```json
   {
     "udyam_number": "data.uan",
     "enterprise_name": "data.main_details.name_of_enterprise",
     "enterprise_type": "data.main_details.enterprise_type_list.0.enterprise_type",
     "major_activity": "data.main_details.major_activity",
     "social_category": "data.main_details.social_category",
     "organization_type": "data.main_details.organization_type",
     "registration_date": "data.main_details.registration_date",
     "date_of_incorporation": "data.main_details.date_of_incorporation",
     "date_of_commencement": "data.main_details.date_of_commencement",
     "applied_date": "data.main_details.applied_date",
     "state": "data.main_details.state",
     "district": "data.main_details.dic_name",
     "city": "data.main_details.city",
     "village": "data.main_details.village",
     "road": "data.main_details.road",
     "flat": "data.main_details.flat",
     "pin_code": "data.main_details.pin",
     "mobile": "data.main_details.mobile_number",
     "email": "data.main_details.email",
     "msme_dfo": "data.main_details.msme_dfo",
     "gender": "data.main_details.gender",
     "nic_2_digit": "data.nic_code.0.nic_2_digit",
     "nic_4_digit": "data.nic_code.0.nic_4_digit",
     "nic_5_digit": "data.nic_code.0.nic_5_digit",
     "plant_locations": "data.location_of_plant_details"
   }
   ```
   Apply with `WHERE provider_name = 'MSME'` (across all tenants, since the row is per-tenant).

2. **`ComplianceStep.tsx` — extend `handleMsmeVerified` and the displayed card** so the new fields populate visible inputs:
   - Add Zod fields: `msmeUdyamNumber` (auto-fills the existing `msmeNumber` if blank), `msmeDateOfIncorporation`, `msmeCity`, `msmePinCode`, `msmeAddress` (built from `flat + road + village`), `msmeMobile`, `msmeEmail`, `msmeNicCode`.
   - Update `handleMsmeVerified` to `setValue` for each new key from the merged API result.
   - Add the corresponding read-only-friendly Inputs to the "MSME Certificate Details" card (grouped: Identity, Classification, Address, Contact).

3. **No edge-function changes needed.** `kyc-api-execute` already resolves dotted paths and array indices (`enterprise_type_list.0.enterprise_type` already works), so fixing the mapping row is sufficient.

4. **No UI flow changes.** The Yes/No radio, Manual/Upload sub-tabs, dynamic Validate button, inline `ApiResponseDetails` panel, and the "configured-provider" toast are already correct — they were verified in `MsmeKycTab.tsx` and `useProviderVerify.tsx`. The only reason fields appeared blank was the broken mapping.

### Files touched

- `supabase/migrations/<new>.sql` — `UPDATE api_providers SET response_data_mapping = '…' WHERE provider_name = 'MSME';`
- `src/components/vendor/steps/ComplianceStep.tsx` — extend Zod schema, `handleMsmeVerified`, and the MSME details card.

No changes to `MsmeKycTab.tsx`, `useProviderVerify.tsx`, `kyc-api-execute`, or `MSME_OCR` provider config.