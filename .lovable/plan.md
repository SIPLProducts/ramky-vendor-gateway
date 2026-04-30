## Root Cause

The MSME validation **call now succeeds** (`status_code: 200`, `message_code: "success"`) and the upstream Surepass payload contains every field needed (Enterprise Name, Type, NIC Code, Address, Mobile, Email, etc.).

But the response that reaches the UI has:

```
"data": { "message_code": true }
```

…so all the form fields stay blank.

Verified the cause in the database:

```
api_providers.response_data_mapping (for MSME) =
{
  "data": { "uan": "UDYAM-AP-04-0057131", "main_details": { ... }, "nic_code": [ ... ] },
  "message": null, "success": true, "status_code": 200, "message_code": "success"
}
```

This column was saved with a **literal sample response object**, not a map of `{ outputKey: "json.path.string" }`. The edge function only treats string values as JSON paths, so virtually nothing gets extracted — and the only string value that exists at the right shape (`"success"`) accidentally surfaces as `message_code: true`.

## Fix

Two coordinated changes — together they make the fields populate immediately and stay correct even if the mapping is broken again later.

### 1. Database — replace the broken MSME mapping with real JSON paths
Update `api_providers.response_data_mapping` for `provider_name = 'MSME'` to the proper Surepass paths the UI already reads:

```
udyam_number          → data.uan
enterprise_name       → data.main_details.name_of_enterprise
enterprise_type       → data.main_details.enterprise_type_list.0.enterprise_type
major_activity        → data.main_details.major_activity
organization_type     → data.main_details.organization_type
registration_date     → data.main_details.registration_date
social_category       → data.main_details.social_category
state                 → data.main_details.state
district              → data.main_details.dic_name
city                  → data.main_details.city
pin_code              → data.main_details.pin
mobile                → data.main_details.mobile_number
email                 → data.main_details.email
nic_5_digit           → data.nic_code.0.nic_5_digit
nic_4_digit           → data.nic_code.0.nic_4_digit
nic_2_digit           → data.nic_code.0.nic_2_digit
date_of_incorporation → data.main_details.date_of_incorporation
date_of_commencement  → data.main_details.date_of_commencement
flat                  → data.main_details.flat
road                  → data.main_details.road
village               → data.main_details.village
msme_dfo              → data.main_details.msme_dfo
```

These map exactly onto the flat keys the registration UI already reads (`d.udyam_number`, `d.enterprise_name`, `d.mobile`, `d.nic_5_digit`, etc.).

### 2. Edge function — auto-flatten as a safety net (`kyc-api-execute/index.ts`)
Harden the response-mapping logic so this class of bug can't blank the form again:

- Detect when `response_data_mapping` exists but contains **no string-valued JSON paths** (i.e. an admin pasted a sample response). Treat that as "no usable mapping".
- When there is no usable mapping (or every mapped path resolved to `undefined`), auto-flatten the upstream `data` payload:
  - copy every primitive top-level field of `data`,
  - promote `data.main_details` keys onto the flat object,
  - promote the first `data.nic_code[0]` entry onto the flat object,
  - add convenience aliases: `enterprise_name = name_of_enterprise`, `mobile = mobile_number`, `pin_code = pin`, `district = dic_name`, `enterprise_type = enterprise_type_list[0].enterprise_type`, `udyam_number = uan`.

This guarantees the registration UI's flat-key lookups always find values, regardless of mapping mistakes.

### 3. No UI changes required
The `DocumentVerificationStep.tsx` MSME manual handler already reads the flat keys (`d.udyam_number`, `d.enterprise_name`, `d.enterprise_type`, `d.major_activity`, `d.organization_type`, `d.registration_date`, `d.social_category`, `d.state`, `d.district`, `d.city`, `d.pin_code`, `d.mobile`, `d.email`, `d.nic_5_digit`/`d.nic_4_digit`/`d.nic_2_digit`). Once the mapping returns those keys, every field shown in the screenshot (Enterprise Name, Enterprise Type, Major Activity, Organization Type, Registration Date, State, District, City, PIN Code, Mobile, Email, Social Category, NIC Code) will populate from the API response — and Udyam Number is already filled from the input.

## Files Touched
- `supabase/migrations/<new>.sql` — UPDATE `api_providers.response_data_mapping` for `provider_name = 'MSME'`.
- `supabase/functions/kyc-api-execute/index.ts` — defensive auto-flatten when the mapping is invalid or every path resolves to undefined.

## Expected Result
Click **Validate** with `UDYAM-AP-04-0057131`. Within ~3-4 seconds the MSME fields populate:
- Enterprise Name: `M/S SHARVI INFOTECH PRIVATE LIMITED`
- Enterprise Type: `Micro`
- Major Activity: `Services`
- Organization Type: `Private Limited Company`
- State: `ANDHRA PRADESH`, District: `GUNTUR`, City: `GUNTUR`, PIN: `522213`
- Mobile: `91*****410`, Email: `arjuna2k22@gmail.com`
- Social Category: `General`
- NIC Code: `62013 - Providing software support and maintenance to the clients`
- Registration Date: `2024-03-25`
