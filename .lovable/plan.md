## Changes

### 1. Aadhaar Linked value not showing (approver side)
Apply the previously-identified fix in `src/components/vendor/kyc/PanKycTab.tsx`:
- **Robust parser** for Aadhaar-linked flag: accept `true/false`, `"Y"/"N"`, `"yes"/"no"`, `1/0`, `"linked"/"not_linked"`, `"seeded"`, `aadhaar_seeding_status`, `is_aadhaar_linked`, `aadhaar_link_status`, etc.
- **Immediate DB persistence** — after PAN comprehensive verification succeeds and `vendorId` is known, fire-and-forget update `vendors.pan_status`, `vendors.pan_aadhaar_linked`, `vendors.pan_comprehensive_verified_at` so the value lands in the DB without waiting for final registration save.
- Backfill existing verified vendors' `pan_aadhaar_linked` where parseable from `validation_api_logs` response payload.

### 2. Turnover input validation (Financial step)
In `src/components/vendor/steps/FinancialStep.tsx`:
- Change all 3 turnover inputs (`turnoverYear1/2/3`) and `creditPeriodExpected` to:
  - Reject alphabets and negative sign
  - Accept only digits (and optionally a single decimal point) ≥ 0
  - `min={0}`, `onKeyDown` blocks `-`, `e`, `+`, `E`
  - `onChange` strips non-numeric chars
- Update zod schema to enforce non-negative numeric string.
- Change placeholder from "Enter amount" to **"Enter Amount in Lakhs"**.

### 3. Turnover labels — clarify "last three years"
In `FinancialStep.tsx`, the section header already says "Audited Turnover (Last 3 Years)". Update the field labels to include "Turnover" prefix, e.g. `Turnover FY 2023-24`, so it's explicit in preview/approval too.

### 4. Preview & Approval screens — Financial Information card
In `src/components/vendor/VendorSubmissionPreviewDialog.tsx` and `src/components/vendor/VendorReviewDialog.tsx` (Financial Information section):
- Rename row labels from "Turnover Year 1/2/3" to the actual FY label using `formatIndianFy` from `src/lib/indianFy.ts` (matching what vendor saw when entering) — e.g. "Turnover FY 2023-24".
- Append " Lakhs" suffix to displayed amount, e.g. `₹ 12,50,000 Lakhs`.
- Ensure only these turnover-related fields appear under "Financial Information" (they already do; verify no unrelated fields).

## Files to change
- `src/components/vendor/kyc/PanKycTab.tsx` — parser + immediate persistence
- `src/components/vendor/steps/FinancialStep.tsx` — input validation, placeholders, labels
- `src/components/vendor/VendorSubmissionPreviewDialog.tsx` — FY labels, Lakhs suffix
- `src/components/vendor/VendorReviewDialog.tsx` — FY labels, Lakhs suffix
- One-time SQL backfill for `pan_aadhaar_linked` from existing validation logs
