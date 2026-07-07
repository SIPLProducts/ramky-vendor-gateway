## Goal
Fix both reported issues across the vendor flow:

1. `Is Aadhaar Linked` must be saved from PAN Comprehensive Validation and displayed consistently everywhere.
2. Vendor submission must not fail because of non-critical post-submit logging/routing checks, and the actual error must be clearer if a required submit update fails.

## Findings
- The database already has `vendors.pan_aadhaar_linked` as a nullable boolean.
- Several screens already read `pan_aadhaar_linked`, but formatting is inconsistent: some places show `-` for null, while the requested behavior is `false/null → Aadhaar Not Linked with PAN`.
- PAN Comprehensive parsing misses common response shapes such as nested `data.data`, `raw.response.data`, and string values like `Y/N`, `seeded/not seeded` in some paths.
- In the new Step-1 document flow, PAN Comprehensive persistence currently writes `pan_aadhaar_linked: null` when parsing cannot find a value, which can erase a previously saved value.
- Vendor submission includes non-critical writes after the main status update, especially audit logging/progress checks. If those fail due to permissions or server policy, the user can see `Submission Failed` even though the vendor row may already have been submitted.

## Implementation Plan

### 1. Make Aadhaar-linked formatting match the requirement
Update `src/lib/panComprehensive.ts`:
- `true` → `Aadhaar Linked with PAN`
- `false`, `null`, `undefined` → `Aadhaar Not Linked with PAN`
- Keep PAN status formatting unchanged unless the source explicitly says invalid.

This automatically fixes display in Preview, View Details, approval screens, Document Verification, Reports UI, and SAP Sync Preview where they use the shared helper.

### 2. Strengthen PAN Comprehensive value extraction
Update both PAN flows:
- `src/components/vendor/kyc/PanKycTab.tsx`
- `src/components/vendor/steps/DocumentVerificationStep.tsx`

Changes:
- Parse Aadhaar-linked from more provider response shapes:
  - `aadhaar_linked`, `aadhaarLinked`, `aadhaar_seeding`, `aadhaar_seeding_status`, `aadhaar_linked_with_pan`
  - nested `data.data`, `raw.data`, `raw.response.data`
  - values like `Y`, `N`, `yes`, `no`, `linked`, `not linked`, `seeded`, `not seeded`
- Only persist `pan_aadhaar_linked` when the API returns a definitive boolean.
- If the API does not return the field, do not overwrite an existing saved value.
- Still display null as “Aadhaar Not Linked with PAN” per your requirement.

### 3. Preserve false values correctly through form state
Update form merge/save logic where needed:
- Ensure `false` is treated as a real saved value, not as empty/missing.
- Keep `panAadhaarLinked: false` in form state, review screen, save payload, and preview payload.
- Avoid converting `false` to `null` during edit, save draft, submit, or resubmit.

### 4. Normalize exports and reports
Update export-only formatting paths:
- `src/pages/VendorList.tsx` CSV export currently returns `-` for null; change it to “Aadhaar Not Linked with PAN”.
- `src/lib/reports/exportExcel.ts` and `src/lib/reports/exportPdf.ts` currently stringify raw booleans in single-vendor details; format `pan_aadhaar_linked` using the shared helper.

### 5. Make submission robust against non-critical failures
Update `src/hooks/useVendorRegistration.tsx`:
- Keep the main vendor submit update as a hard failure if it fails.
- Make post-submit audit-log insert non-blocking so an audit permission/server issue does not show `Submission Failed` after the vendor has already moved into review.
- Keep notification failure non-blocking as it already is.
- Keep approval-routing warnings visible, but do not throw unless the vendor status update itself fails.
- Improve the final toast error message by preferring backend `details/hint/code` when present.

### 6. Validate after implementation
After changes:
- Check TypeScript/build signals.
- Use the preview/runtime logs and backend logs again for submission errors.
- Verify source paths show:
  - PAN tab: Aadhaar value retained.
  - Preview: Aadhaar value visible.
  - View Details/SAP Sync Preview/approval screens/reports: same label.
  - Submit flow: no false failure from audit/logging after the status update.

## Files expected to change
- `src/lib/panComprehensive.ts`
- `src/components/vendor/kyc/PanKycTab.tsx`
- `src/components/vendor/steps/DocumentVerificationStep.tsx`
- `src/hooks/useVendorRegistration.tsx`
- `src/pages/VendorList.tsx`
- `src/lib/reports/exportExcel.ts`
- `src/lib/reports/exportPdf.ts`