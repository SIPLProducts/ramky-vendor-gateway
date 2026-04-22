

## Remove Penny Drop validation — keep bank account validation only

### What changes

**1. Finance Review screen (`src/pages/FinanceReview.tsx`)**
- Remove the `isApproveDisabled` gating that requires `pennydrop_verification_status === 'verified'`.
- Remove any "Penny Drop" status badge/section from the vendor details dialog.
- Approve and Reject buttons become always enabled for vendors in `finance_review` (and `validation_failed` for re-review).
- Add the **Purchase / SCM Approval Trail** section (level name, approver, status, timestamp, comments from `vendor_approval_progress`).

**2. Vendor Registration — Financial step**
- `src/components/vendor/steps/FinancialStep.tsx` and `FinancialInfrastructureStep.tsx`: remove the Penny Drop verify button/UI block. Keep the existing **Bank Account Verification** (validate-bank) flow as the sole bank check.
- `src/hooks/useValidationOrchestrator.tsx` / `useFieldValidation.tsx`: drop any `penny_drop` step from the orchestrated validations.

**3. Validation hook (`src/hooks/useVendorValidations.tsx`)**
- Remove any penny-drop invocation. Only `validate-bank` runs for bank verification.

**4. Edge function**
- Stop invoking `validate-penny-drop` from the app. The function file itself can stay (unused) — no deletion needed unless you want it gone.

**5. Database**
- No schema change required. The columns `pennydrop_verification_status`, `pennydrop_utr`, `pennydrop_verified_at` on `vendors` will simply be ignored by the UI. (We will not drop columns to avoid touching historical data.)

**6. Approval flow (unchanged)**
- Submit → Purchase/SCM matrix (sequential) → Finance review → Finance approves → `purchase_approved` → SAP sync. This was already implemented.

### Hook addition
- `useVendorApprovalTrail(vendorId)` in `src/hooks/useVendors.tsx` — fetches `vendor_approval_progress` joined with `approval_matrix_levels` + approver `profiles`, ordered by `level_number DESC`, used by the Finance Review dialog to show the Purchase/SCM trail with comments.

### Out of scope
- No removal of `validate-penny-drop` edge function file or vendor table columns.
- No change to bank validation logic.
- No change to approval ordering, SAP sync, or notifications.

### Files touched
- `src/pages/FinanceReview.tsx` — remove penny-drop gating + UI; add Purchase/SCM trail section
- `src/components/vendor/steps/FinancialStep.tsx` — remove penny-drop UI
- `src/components/vendor/steps/FinancialInfrastructureStep.tsx` — remove penny-drop UI (if present)
- `src/hooks/useVendorValidations.tsx` — remove penny-drop call
- `src/hooks/useValidationOrchestrator.tsx` — drop penny-drop step
- `src/hooks/useVendors.tsx` — add `useVendorApprovalTrail` hook

