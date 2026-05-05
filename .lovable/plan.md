## Goal

Make the PAN tab reliably auto-fill from the verified GST data when the vendor selects "Yes" for GST registration — even if the GST verification provider's response payload doesn't include an explicit `pan_number` field.

## Root cause

The PAN (positions 3–12 of any GSTIN) is mathematically derivable from the GSTIN itself, but `ComplianceStep.handleGstVerified` only sets `gstPanNumber` when the API response contains a `pan_number` key. Many GST registry providers omit that field, so `gstPanNumber` stays empty, and the PAN tab — even when correctly entering the "GST = Yes + verified" branch — has nothing to display or pass downstream.

Additionally, the PanKycTab's auto-mark-passed logic is gated on `gstPanNumber.length === 10`, so without that value it never calls `onStatusChange('passed')`, leaving the PAN tab "Pending" forever.

## Files to change

### 1. `src/components/vendor/steps/ComplianceStep.tsx`

In `handleGstVerified`, after attempting `d.pan_number`:

- If still empty, derive PAN from the verified GSTIN: `const gstinStr = pickStr(d.gstin).toUpperCase().trim(); if (gstinStr.length === 15) panFromGst = gstinStr.slice(2, 12);`
- Validate against the standard PAN regex `^[A-Z]{5}[0-9]{4}[A-Z]$` before setting state.
- Set `gstPanNumber` and `setValue('pan', ...)` from this derived value.

Also: when GST is the manual-entry path, `handleManualVerify` returns the verified data via `onVerifiedDetails` — same logic applies; no extra change needed since both flows feed `handleGstVerified`.

### 2. `src/components/vendor/kyc/PanKycTab.tsx`

Small robustness tweaks in the GST=Yes branch:

- If `gstPanNumber` is empty but `gstVerified` is true and the parent has already pre-filled `props.pan` (10-char PAN derived from GSTIN), use `props.pan` as the displayed value and trigger the auto-`passed` effect on it as well.
- Update the effect dependency list to also depend on `props.pan` so the auto-mark fires when PAN arrives slightly after `gstVerified` flips to true.

### 3. (Optional, defensive) Ensure the GST=Yes verified card always renders

In the "GST=Yes + verified" return block, if neither `gstPanNumber` nor `props.pan` is available (extremely unlikely after step 1), show a small inline "PAN could not be derived from GST — please enter manually" fallback rather than a blank card. This prevents a confusing empty state.

## Out of scope

- No changes to the GST tab itself, MSME tab, Bank tab, or any backend / edge function.
- No DB migrations.

## Expected result after fix

1. Vendor selects "Yes" → uploads GST certificate or enters GSTIN → GST is verified.
2. PAN tab automatically shows the read-only "Auto-verified from GST" card with the PAN (derived from GSTIN if not returned by API) and legal name.
3. PAN tab status pill flips from "Pending" → "Verified" without any upload.
4. MSME and Bank tabs receive the `panHolderName` (= GST legal name) for their downstream cross-checks.
