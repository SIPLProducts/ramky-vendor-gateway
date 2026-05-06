## Goal

Display a new read-only **Current Year** field beside **Enterprise Type** in the MSME section of the vendor registration form. Its value comes from the MSME verification API response: `data.main_details.enterprise_type_list[0].classification_year` (e.g. `"2026-27"`).

## Changes

### 1. Database migration — extend MSME response mapping
Update `api_providers.response_data_mapping` for the `MSME` provider to include a new key `classification_year` mapped to `data.main_details.enterprise_type_list.0.classification_year`. This makes the value flow through the existing dynamic mapping pipeline used by `kyc-api-execute`.

Also add a sibling fallback in `supabase/functions/kyc-api-execute/index.ts` (the block around line 207 that flattens `enterprise_type_list[0].enterprise_type`) so that `classification_year` is also flattened from the same array entry when the mapping isn't applied.

### 2. ComplianceStep — new form field & population
In `src/components/vendor/steps/ComplianceStep.tsx`:
- In `handleMsmeVerified()`, read `pickStr(d.classification_year)` and `setValue('msmeClassificationYear', ...)`.
- In the MSME details grid (around line 499), replace the row containing **Enterprise Type** + **Major Activity** so that **Current Year** sits beside **Enterprise Type** (read-only Input). Move **Major Activity** to its own row or pair it elsewhere to keep the 2-col layout balanced.

### 3. Built-in field registry
Add `msmeClassificationYear` (display label "Current Year", group "MSME", locked, read-only) to `src/lib/builtInFields.ts` and a short description in `src/lib/builtInFieldInfo.ts` so the field is recognised by the dynamic form/validation layer.

### 4. Vendor type
Add `msmeClassificationYear?: string` to the MSME section of the vendor form type in `src/types/vendor.ts` (matching how `msmeEnterpriseType` is declared).

### 5. DocumentVerificationStep (admin review)
In `src/components/vendor/steps/DocumentVerificationStep.tsx`, surface `classification_year` alongside `enterprise_type` in the OCR/registry comparison views (lines ~1536 and ~1685) so reviewers see the same field. Also include it in the merged objects (lines ~480, ~835) and the `apiData`/payload writes (lines ~305, ~1056).

## Out of Scope
- No changes to OCR extraction (Udyam certificates don't include the FY string consistently; value comes from the registry API only).
- No changes to the simulated `validate-msme` edge function (unused — real path is `kyc-api-execute` + provider mapping).
- No SAP field mapping changes.

## Technical Notes
- Display format: render the API string as-is (e.g. `2026-27`). Field is read-only (populated from API, not user-editable beyond the existing "you may edit if needed" pattern used by sibling fields).
- If the API omits `classification_year`, the field stays empty — no validation error, since this is informational.
