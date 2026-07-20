
## 1. Tabs: hide Contact Details, rename Address Information → Contact Details

In `src/pages/VendorRegistration.tsx` (and any step indicator / tab list where step keys are defined):

- Remove the existing **Contact Details** tab/step from the visible steps list (keep the underlying data/fields in state so nothing breaks on submit).
- Rename the **Address Information** tab label to **Contact Details** wherever the label is rendered (step indicator, headers, breadcrumb, validation messages).
- Update step-completion / navigation logic so the removed tab is not required and the renamed tab is treated as the new "Contact Details" step.

No field-level logic changes — purely tab visibility + label rename.

## 2. Hide extra cards on the Vendor Registration form

Hide (do not delete — wrap so they can be re-enabled later) the following cards/sections wherever they appear in the vendor registration steps:

- Existing Major Customers
- Authorized Distributor Details
- Manufacturing Facility Details
- Connectivity Details
- Type of Products
- Production Facilities
- QHSE Details (Quality, Health, Safety, Environment)

Also hide the **Expected Credit Period (Days)** field everywhere it renders (registration form, review/preview dialogs, admin views).

Approach: comment/guard each card with a simple `{false && (...)}` or an internal `HIDDEN_SECTIONS` constant, so restoring later is a one-line change. Keep the underlying form state / schema untouched so saved data and submissions continue to work.

## 3. MSME tab: gate certificate upload behind Udyam verification

In `src/components/vendor/kyc/MsmeKycTab.tsx`:

- After the user selects **Are you MSME registered? → Yes**, initially render **only** the left column (MSME/Udyam Number + Verify button).
- Hide the right column (Upload Udyam Certificate + its required warning) until the manual Verify call returns a successful API response (i.e. `state.status === 'passed'` or `manualApiResult?.ok` is true).
- Once verification succeeds, reveal the upload card so the user can upload the certificate.
- If the user edits the Udyam number after a successful verify, reset the verified state and re-hide the upload card until they verify again.

No changes to the OCR flow, cross-name-match logic, or downstream `onVerifiedDetails` behaviour.

## Files touched

- `src/pages/VendorRegistration.tsx` — hide Contact Details tab, rename Address Information → Contact Details, hide Expected Credit Period + listed cards if they live here.
- Step files under `src/components/vendor/steps/` (e.g. the step rendering the listed cards, and the Address/Contact step) — hide the listed sections and the Expected Credit Period field.
- `src/components/vendor/kyc/MsmeKycTab.tsx` — gate the Udyam certificate upload card behind a successful Udyam number verification.
- Any step-indicator component (e.g. `EnterpriseStepIndicator` / `HorizontalStepIndicator`) if step labels are defined there rather than in the page.
