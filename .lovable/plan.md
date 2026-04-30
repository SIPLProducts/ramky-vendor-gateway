## Problem

The MSME tab itself runs the configured Surepass APIs correctly (no hardcoded responses anywhere — the edge function is fully dynamic). But the user's screenshot shows two real bugs:

1. After verification, **Enterprise Type** and **Major Activity** stay empty in the form.
2. Manual Entry → Validate succeeds (toast says verified), but no extracted details appear and nothing is committed back to the parent form.

Root causes found in code:

- `ComplianceStep.tsx` wires `onVerifiedDetails={handleGstVerified}` for GST but **does not pass `onVerifiedDetails` for MSME**. So even when `MsmeKycTab` calls `props.onVerifiedDetails?.(merged)`, the parent ignores it and never writes Enterprise Type / Major Activity / State / District into form state.
- `MsmeKycTab` Manual Entry path uses `ManualEntryAndVerify`, which has no panel to render the API response. The Upload path renders `ApiResponseDetails`, but Manual does not — that's why "details don't replicate" between tabs.
- `api_providers.response_data_mapping` for `MSME` is missing `major_activity` (and `social_category`, `pin_code`), and for `MSME_OCR` is missing `major_activity` — so even when Surepass returns it, the edge function never surfaces it.

## Plan

### 1. Database migration — extend dynamic mapping (still no hardcoding)

Update `api_providers.response_data_mapping` for the existing `MSME` and `MSME_OCR` rows to include all useful Surepass fields. Values remain dotted JSON paths that the edge function walks at runtime.

- `MSME` (Surepass `/corporate/udyog-aadhaar`): add
  - `major_activity` → `data.main_details.major_activity`
  - `social_category` → `data.main_details.social_category`
  - `pin_code` → `data.main_details.pin`
  - `mobile` → `data.main_details.mobile`
  - `email` → `data.main_details.email`
- `MSME_OCR` (Surepass `/ocr/udyam-aadhaar`): add
  - `major_activity` → `data.ocr_fields.0.major_activity.value`
  - `organization_type` → `data.ocr_fields.0.organization_type.value`
  - `date_of_incorporation` → `data.ocr_fields.0.date_of_incorporation.value`

### 2. Wire MSME verified details into the form (`ComplianceStep.tsx`)

- Add a `handleMsmeVerified(data)` callback (mirroring `handleGstVerified`) that uses `setValue` to populate:
  - `msmeEnterpriseName`, `msmeEnterpriseType`, `msmeMajorActivity`, `msmeOrganizationType`, `msmeRegistrationDate`, `msmeState`, `msmeDistrict`.
  - Defensively unwrap `{ value, confidence }` shapes (already handled by `pickString` pattern used elsewhere).
- Pass `onVerifiedDetails={handleMsmeVerified}` to `<MsmeKycTab>`.
- If those form fields don't exist yet on the schema, add them to `useVendorRegistration` defaults (string defaults) — purely additive.

### 3. Show "MSME Certificate Details" card after verification (like GST)

Below the `KycTabs` block in `ComplianceStep.tsx`, add a conditional card visible when `isMsmeRegistered && statuses.msme === 'passed'` that renders the populated MSME fields with `Input {...register(...)}` so the user can edit before submit. This is what makes Enterprise Type / Major Activity / State / District actually visible on the page (the "fields are empty" symptom in the screenshot).

### 4. Surface API response details under Manual Entry tab (`MsmeKycTab.tsx`)

After a successful manual `Validate`, render `ApiResponseDetails` with the raw `KycApiResult` returned by `useProviderVerify`, the same way the Upload tab already does via `OcrUploadAndVerify`. Steps:

- Have `useProviderVerify.verify(...)` return the full `KycApiResult` (it already does internally — just expose it).
- Store the last result in local state in `MsmeKycTab` and render `<ApiResponseDetails result={lastResult} title="MSME verification response" />` under the manual `<TabsContent>` when `state.status === 'passed' || 'failed'`.
- This replicates the Upload tab's "View details" experience for Manual Entry.

### 5. Sanity-check the chained call path

`handleOcrVerify` in `MsmeKycTab` already chains OCR → MSME verify and merges results. After the migration in step 1, the merged object will include `major_activity`, etc., so step 2's `onVerifiedDetails` will populate the new card automatically.

## Files to change

- `supabase/migrations/<new>.sql` — extend `response_data_mapping` for `MSME` and `MSME_OCR`.
- `src/components/vendor/steps/ComplianceStep.tsx` — add `handleMsmeVerified`, pass `onVerifiedDetails`, render new MSME details card.
- `src/components/vendor/kyc/MsmeKycTab.tsx` — capture and render API response details under Manual Entry.
- `src/hooks/useVendorRegistration.tsx` — add string fields for `msmeEnterpriseType`, `msmeMajorActivity`, etc. if missing.

## What is intentionally NOT changed

- `supabase/functions/kyc-api-execute/index.ts` — already fully dynamic; the upstream Surepass response drives everything via `response_data_mapping`. No code changes needed.
- No fallback / mock / static response is added anywhere.
