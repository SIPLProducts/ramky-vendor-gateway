## Problem

The GST filing UI shown on the vendor registration form lives in `src/components/vendor/steps/DocumentVerificationStep.tsx`, not `GstKycTab.tsx`. It still uses the old boolean helper `isLatestPeriodFiled` and forces a mandatory declaration upload whenever last month's GSTR1 is not filed — with no 11th-of-month grace period. That's why on 03‑Jul‑2026 the UI shows "Not filed for last month" and requires the declaration, even though we're inside the grace window.

The shared helper `evaluateGstr1Compliance` (already added to `GstFilingStatusTable.tsx`) already implements:
- GSTR1-only match (ignores GSTR3B)
- Previous calendar month as the target period
- Grace rule: `declarationRequired = !previousMonthFiled && now.getDate() > 11`

We just need to wire the DocumentVerificationStep to it.

## Changes

### 1. `src/components/vendor/steps/DocumentVerificationStep.tsx`

- Replace the `isLatestPeriodFiled` import with `evaluateGstr1Compliance`.
- Replace state:
  ```
  gstLatestFiled: boolean | null
  ```
  with:
  ```
  gstCompliance: { previousMonthFiled, declarationRequired, checkedPeriod } | null
  ```
  Initial value derived from `evaluateGstr1Compliance(rows)` when initial data has filing rows.
- In `runGstFilingStatusCheck`, compute `evaluateGstr1Compliance(rows)` and store it. Update the persisted `vendor_validations.message` to reflect the three states (filed / within grace / declaration required).
- Update gating (`stage1Done` / `gstFilingOk`):
  - Compliant when: filing check done AND (previous month filed OR within grace OR declaration file uploaded).
  - i.e. `gstFilingOk = gstFilingChecked && (!gstCompliance?.declarationRequired || !!gstDeclarationFile)`.
- Update `buildOutput`:
  - `filingCompliant = gstCompliance?.previousMonthFiled ?? undefined`.
  - Only attach `gstSelfDeclarationFile` when `gstCompliance?.declarationRequired` is true.
- Update the UI badges (lines 2184–2195) to three states:
  - Success ("GSTR1 Filed for {period}") when `previousMonthFiled` is true.
  - Muted outline ("GSTR1 for {period} not yet filed — within grace period, due 11th") when not filed but not required.
  - Amber warning ("GSTR1 for {period} not filed — declaration required") when `declarationRequired` is true.
- The declaration upload block (lines 2220–2249) renders only when `gstCompliance?.declarationRequired` is true. Update the alert copy to mention the checked period.
- Include `gstCompliance` in the `useEffect` deps array on line 1998 (replacing `gstLatestFiled`).

### 2. No changes required elsewhere

- `GstFilingStatusTable.tsx` — already GSTR1-only, dedupes GSTR1 rows, and exports `evaluateGstr1Compliance`.
- `GstKycTab.tsx` — already uses the new helper.
- `KycApiSettings.tsx` / `GST_FILING` provider — already seeded with `filing_status_get: true`; no config change needed.
- Zod schema — `gstSelfDeclarationFile` stays optional; mandatory-ness is enforced by the gating logic.

## Behaviour after the fix (verified against today = 03‑Jul‑2026)

- 03‑Jul, June GSTR1 not filed → within grace → declaration NOT required, stage passes.
- 12‑Jul, June GSTR1 not filed → grace passed → declaration required, stage blocked until upload.
- Any date, previous month GSTR1 filed → no declaration ever required.

## Verification

- Manually confirm the badge and declaration block behaviour on the vendor registration page at `/vendor/registration` for a GSTIN whose previous month is unfiled, before and after the 11th (using the shared helper's `now` parameter path if needed for debugging).
- Confirm `tsgo` typechecks pass after the state-shape change.
