## Goal

1. Add a **PAN Validation** API (Surepass `pan-comprehensive`) as a first-class provider — like GST, BANK, MSME — so it shows up as a one-click template in **KYC & Validation API Settings**, gets seeded in `api_providers`, and is automatically called after the PAN OCR step.
2. After the PAN validation API returns, render the registry fields (PAN Number, Holder Name, DOB, Category, Status, Aadhaar Linked) under the OCR fields with green ticks — same pattern already used for GST and Bank.
3. After the **MSME** validation API returns (already wired), wire green-tick "verified" indicators on each MSME field (Udyam Number, Enterprise Name, Enterprise Type, Major Activity, Organization Type, State, District, City, Pin Code, Registration Date) — same pattern as GST/Bank.

No DB schema change is needed — `api_providers` already supports a new row. Just one data migration to seed the PAN row, plus frontend wiring.

## Scope of changes

### A. Seed the PAN validation provider (database)

Insert a new row into `api_providers` (idempotent — only if `provider_name='PAN'` doesn't already exist):

- `provider_name`: `PAN`
- `display_name`: `PAN Comprehensive Validation`
- `category`: `VALIDATION`
- `base_url`: `https://kyc-api.surepass.app`
- `endpoint_path`: `/api/v1/pan/pan-comprehensive`
- `http_method`: `POST`, `request_mode`: `json`
- `auth_type`: `BEARER_TOKEN`, header `Authorization: Bearer {{token}}`
- `request_body_template`: `{ "id_number": "{{id_number}}" }`
- `response_data_mapping`:
  - `pan_number` → `data.pan_number`
  - `full_name` → `data.full_name`
  - `category` → `data.category`
  - `status` → `data.status`
  - `dob` → `data.dob`
  - `aadhaar_linked` → `data.aadhaar_linked`
  - `gender` → `data.gender`
  - `email` → `data.email`
  - `phone_number` → `data.phone_number`
  - `address` → `data.address.full`

The user will need to add their Surepass API token for this provider in **KYC API Settings** the same way they did for GST/BANK/MSME.

### B. Add PAN to the templates list in KYC API Settings page

`src/pages/KycApiSettings.tsx` — append a new entry to the `TEMPLATES` array so the "Add from template" buttons include **PAN Comprehensive Validation** alongside GST/MSME/BANK. Same fields as the seeded row above.

### C. Wire the PAN validation call in `DocumentVerificationStep.tsx`

In `verifyApi` for `kind === "pan"` (currently a stub returning `simulated: true`), replace with a real call to the configured `PAN` provider:

1. Build `id_number` from the OCR-extracted `pan_number`. If it's not a 10-char alphanumeric (`^[A-Z]{5}\d{4}[A-Z]$`), short-circuit with a friendly error.
2. `callProvider({ providerName: "PAN", input: { id_number } })`.
3. If provider not found → "PAN validation provider is not configured. Add it in KYC & Validation API Settings."
4. If `!ok` → return mapped error message.
5. On success, build a `normalized` snake_case payload with `pan_number`, `holder_name` (from `full_name`), `dob`, `category`, `status`, `aadhaar_linked`, `address`. Return `{ ok, apiData: { name, pan, dob, category, status, ...}, normalized, registeredName: full_name }`.
6. The existing `runDocFlow` already merges `normalized` over OCR data and stores the registry payload in `apiData.normalized` — the verified-fields renderer can just consume it.

Name-mismatch behavior already exists via `nameMatchScore(effectiveLegalName, registeredName)` and the existing `CrossCheckStrip`.

### D. Add field-level green ticks to PAN verified panel

In `DocumentVerificationStep.tsx` PAN `verifiedFields` block (lines ~1050-1064), extend the existing fields and add the new registry-only fields, each using `EditableOcrField` with `verifiedValue` / `verifiedLabel` props (already supported from the previous GST/Bank work):

| UI Field        | Compared against `panDoc.apiData.normalized` field | Verified label                |
|-----------------|----------------------------------------------------|-------------------------------|
| PAN Number      | `pan_number`                                       | "PAN is verified"             |
| Holder Name     | `holder_name`                                      | "Name matches PAN registry"   |
| Date of Birth   | `dob`                                              | "DOB verified from registry"  |
| Category        | `category` (e.g. `company`, `individual`)          | "Verified from registry"      |
| PAN Status      | `status` (e.g. `valid`)                            | "Active per registry"         |
| Aadhaar Linked  | `aadhaar_linked`                                   | "Verified from registry"      |

Only render registry-only fields (DOB, Category, Status, Aadhaar Linked) when present in the API response — they're not OCR fields, so they show as read-only displays with the green tick.

### E. Add field-level green ticks to MSME verified panel

In the MSME verified-fields block of `DocumentVerificationStep.tsx`, pass `verifiedValue` / `verifiedLabel` to each `EditableOcrField` against `msmeDoc.apiData.normalized` (need to add `normalized` mapping in the `verifyApi` MSME branch — currently it returns `apiData` only without `normalized`). Mapping:

| UI Field          | API field             | Verified label                  |
|-------------------|-----------------------|----------------------------------|
| Udyam Number      | `udyam_number`        | "Udyam Number is verified"       |
| Enterprise Name   | `enterprise_name`     | "Enterprise Name matches registry" |
| Enterprise Type   | `enterprise_type`     | "Verified from registry"         |
| Major Activity    | `major_activity`      | "Verified from registry"         |
| Organization Type | `organization_type`   | "Verified from registry"         |
| State             | `state`               | "Verified from registry"         |
| District          | `district`            | "Verified from registry"         |
| City              | `city`                | "Verified from registry"         |
| Pin Code          | `pin_code`            | "Verified from registry"         |
| Registration Date | `registration_date`   | "Verified from registry"         |

Update `verifyApi`'s MSME branch (currently returns only `apiData`) to also return a `normalized` object with the snake_case fields above so `runDocFlow` stores it under `apiData.normalized`. The same change should also be applied to the **manual MSME entry** flow (`handleMsmeManualValidate`) — store the API response on `msmeDoc.apiData.normalized` so the verified panel ticks work whether the user came in via Upload or Manual.

## Files to change

- **DB seed** (one migration / insert): add the `PAN` row to `public.api_providers` (idempotent on `provider_name`).
- `src/pages/KycApiSettings.tsx` — add PAN entry to `TEMPLATES`.
- `src/components/vendor/steps/DocumentVerificationStep.tsx`
  - Replace stub PAN `verifyApi` branch with real `callProvider("PAN", …)` + normalization.
  - Add registry-tick wiring to PAN `verifiedFields` (PAN, Holder Name, DOB, Category, Status, Aadhaar Linked).
  - Add `normalized` to MSME `verifyApi` branch and to `handleMsmeManualValidate`'s state update.
  - Add `verifiedValue` / `verifiedLabel` props to MSME `EditableOcrField`s.

## Out of scope

- Rewriting the PAN/MSME flows beyond field-level ticks.
- Changing the existing PAN ↔ GSTIN cross-check strip.
- Auth token management — the user adds the Surepass token from the API Settings page as today.
