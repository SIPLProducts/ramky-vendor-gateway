## Changes

**1. Rename "Submit Application" to "Submit"**
- `src/components/vendor/StickyActionBar.tsx` — update the final step button label.
- `src/pages/VendorRegistration.tsx` — update the inline review-step submit button label.

**2. `src/components/vendor/VendorSubmissionPreviewDialog.tsx`**
- Remove the entire "Contact Information" section (Users-icon block with Primary Contact, CEO/MD, etc.).
- Rename the "Address Information" section header to "Contact Details".
- Remove the following rows from the Financial Information section: Credit Period Expected, Major Customer 1, Major Customer 2.

**3. Global consistency rename "Address Information" → "Contact Details"**
- `src/hooks/useFormBuilder.tsx` — built-in step label.
- `src/components/vendor/EnterpriseStepIndicator.tsx` — registration step title.
- `src/components/vendor/steps/ReviewStep.tsx` — review section header.
- `src/types/vendor.ts` and `src/lib/builtInFields.ts` — comments/section labels.

## Out of scope
- No changes to form logic, validations, or data model.
- Underlying DB fields (`credit_period_expected`, `major_customer_*`) remain intact; only preview UI hides them.
