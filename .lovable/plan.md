## Changes

**1. `src/components/vendor/steps/ReviewStep.tsx` (in-form preview shown before Submit)**
- Remove the entire **Contact Information** section block (SectionHeader + CEO/MD rows, lines ~207-216).
- Remove these rows from **Financial Information**: `Expected Credit Period`, `Major Customer 1`, `Major Customer 2`, `Major Customer 3` (lines ~301-304).

**2. KYC tabs — filled fields shown in light gray**
Apply light-gray filled styling to inputs in GST / PAN / MSME / Bank tabs to match the rest of the form.

- `src/components/vendor/kyc/ManualEntryAndVerify.tsx` — when the field has a value (and is not in the locked/verified success state), add a light-gray background (`bg-muted/40`) so filled inputs appear grayed. Preserve the existing green-tint styling for the locked/verified state.
- `src/components/vendor/kyc/BankKycTab.tsx` — the bank tab renders IFSC + Account Number + auto-filled Bank Name / Branch / Address / Account Type directly (not through ManualEntryAndVerify). Add the same `bg-muted/40` treatment when the field has a value, and keep read-only fields visibly disabled with the light-gray fill.

## Out of scope
- No changes to `VendorSubmissionPreviewDialog.tsx` (already updated previously; the screenshot is the in-form ReviewStep).
- No form logic, validation, or data-model changes.
- Underlying DB fields for credit period / major customers remain intact.
