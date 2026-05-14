## 1. Name-match logic (KYC tabs)

Per the bank API response shown ("M V R ENGINEERING WORKS" vs PAN "M V Engineering Works" — fuzzy ≈40% token overlap), relax the matcher and switch the source of truth to **PAN holder name**.

### `src/components/vendor/kyc/BankKycTab.tsx`
- Replace `fuzzyNameMatch` with `nameMatchPercentage` from `src/lib/nameMatch.ts`.
- Compute `panScore` and `gstScore`. Pass if `max(panScore, gstScore) >= 40`.
- Update result message to show which name matched + the % (e.g. *"Account Holder Name verified with PAN Holder Name (62% match)."*).
- Failure message stays: *"Account Holder Name does not match with the provided PAN/MSME details."*

### `src/components/vendor/kyc/MsmeKycTab.tsx`
- Drop the GST-legal-name comparison. Validate enterprise name **only** against `panHolderName` using `nameMatchPercentage(...) >= 40`.
- Simplify `enterpriseCheck` states to `'idle' | 'pan' | 'failed'` and update the message ("Enterprise Name verified with PAN Holder Name.").

### `src/components/vendor/kyc/GstKycTab.tsx`
- Remove the user-entered `legalName` fuzzy comparison block (in both `handleManualVerify` and `handleOcrVerify`). GST stays as the registry source of truth; cross-checks now happen on the PAN tab (already in place) and on MSME/Bank tabs against PAN.

No edge-function or DB changes.

## 2. Numeric-only enforcement

Restrict to digits only (strip any non-numeric on input) and enforce length.

### Mobile / phone fields — exactly 10 digits
Files + fields:
- `src/components/vendor/steps/ContactStep.tsx` — `ceoPhone`, `ceoPhone2`, `marketingPhone`, `productionPhone`, `customerServicePhone`. Use `Controller` (or `register` with `onChange` interceptor) to `value.replace(/\D/g, '').slice(0, 10)`. Set `inputMode="numeric"`, `maxLength={10}`. Tighten zod: `z.string().regex(/^\d{10}$/, '10-digit mobile number required')` for required fields; optional fields use `.regex(/^\d{10}$/).optional().or(z.literal(''))`.
- `src/components/vendor/steps/AddressStep.tsx` — `registeredPhone`, `manufacturingPhone`, `branchContactPhone` (and any other `*Phone` inputs). Same digit-strip + maxLength=10 + zod regex (optional variant for non-required ones).
- `src/components/vendor/DynamicStep.tsx` — `case 'phone'`: change handler to `setField(f.field_name, e.target.value.replace(/\D/g, '').slice(0, 10))`, add `inputMode="numeric"` and `maxLength={10}`.

### Pincode fields — exactly 6 digits
Files + fields (`registeredPincode`, `manufacturingPincode`, `branchPincode`) in `src/components/vendor/steps/AddressStep.tsx`:
- Strip non-digits on input, `maxLength={6}`, `inputMode="numeric"`.
- Zod for required: `z.string().regex(/^\d{6}$/, 'Valid 6-digit pincode required')` (already in place for `registeredPincode`); add the same regex (optional) for `manufacturingPincode` / `branchPincode`.

### Helper
Introduce a tiny `digitsOnly(value, max)` helper inside the steps (or in `src/lib/utils.ts`) to avoid repetition.

## Out of scope
- SAP, middleware, edge functions, dynamic field-config-driven phone fields (those already flow through `DynamicStep` which is covered).
- Changes to `nameMatchPercentage` itself.

## Verification
- Bank tab with the sample response → "verified with PAN Holder Name (≈60% match)" instead of fail.
- Pasting "+91 98765 43210" into a phone field → becomes `9876543210`.
- Typing letters/symbols into pincode → blocked; only 6 digits accepted.
