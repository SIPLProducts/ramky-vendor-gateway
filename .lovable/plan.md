## Goal

Switch the GST filing compliance logic in vendor registration from **GSTR3B** to **GSTR1**, and make the GST self-declaration upload conditional on the **11th-of-month** rule.

The `GST_FILING` provider (Surepass `gstin-advanced` with `filing_status_get: true`) is already seeded in `KycApiSettings.tsx` — no new provider row needed. It returns the same `filing_status` array containing both GSTR1 and GSTR3B rows.

## Changes

### 1. `src/components/vendor/kyc/GstFilingStatusTable.tsx`
- **`isLatestPeriodFiled(rows)` → replace with `evaluateGstr1Compliance(rows, now)`** returning:
  ```
  {
    previousMonthFiled: boolean,   // is previous month's GSTR1 filed?
    declarationRequired: boolean,  // true only if today > 11th AND previous month GSTR1 not filed
    checkedPeriod: string          // e.g. "November 2026"
  }
  ```
  - Match only `return_type === "GSTR1"` (drop the GSTR3B primary + GSTR1 fallback).
  - "Previous month" = current month − 1, in the correct Indian FY.
  - Grace period: if `now.getDate() <= 11`, `declarationRequired` is always `false` regardless of filing status.
- **`dedupeByPeriod`** — change priority so `GSTR1` wins over `GSTR3B` (so the table row shown per period is the GSTR1 one).
- Table filter: only render `GSTR1` rows (drop GSTR3B entirely from the table). Header already labels the table "GST Return Filing Status" — add a small caption clarifying "GSTR1 (last 3 months)".

### 2. `src/components/vendor/kyc/GstKycTab.tsx`
- Replace the `isLatestPeriodFiled` import + `latestFiled` boolean with the new `evaluateGstr1Compliance` result.
- In `runFilingStatusCheck`:
  - If `declarationRequired === false` → auto-advance (compliant OR within grace period).
  - If `declarationRequired === true` → open the declaration dialog (mandatory upload).
- Update the badge UI:
  - `previousMonthFiled === true` → green "GSTR1 Filed for {previousMonth}" badge.
  - `previousMonthFiled === false && declarationRequired === false` → neutral badge "GSTR1 for {previousMonth} not yet filed — within grace period (due 11th)".
  - `declarationRequired === true` → amber "GSTR1 for {previousMonth} not filed — declaration required".

### 3. `src/components/vendor/steps/ComplianceStep.tsx`
- The `isStepValid` gate already requires `statuses.gst === 'passed'`. GstKycTab only sets `passed` after either (a) filing compliant or (b) declaration uploaded via dialog, so behaviour naturally follows.
- No schema change needed — `gstSelfDeclarationFile` stays optional at the Zod level; the mandatory-ness is enforced by the GstKycTab dialog gating tab-status.

### 4. `src/components/vendor/steps/DocumentVerificationStep.tsx` and `src/components/vendor/VendorReviewDialog.tsx`
- These also render the filing table and consume `filing_status`. Update them to pass only GSTR1 rows into the table (via the same normalized helper) so the review/reports views stay consistent with the vendor-facing view.

### 5. KYC API Settings (no code change)
- The `GST_FILING` provider config is already present in the seed list in `src/pages/KycApiSettings.tsx` (lines 90–98) pointing to Surepass `gstin-advanced` with `filing_status_get: true`. Admins can open it from the settings screen and paste their API token if not already saved. Nothing to change in the provider record for the GSTR1 switch — the switch is purely client-side interpretation of the same response.

## Notes / Assumptions
- "After the 11th" is interpreted strictly as `day-of-month > 11` in the server/browser local time (India). If you need Asia/Kolkata explicitly regardless of browser TZ, we can compute using `Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata' })`.
- Table continues to show last 3 periods (`limit={3}`), now GSTR1-only.
- No DB migration required.
