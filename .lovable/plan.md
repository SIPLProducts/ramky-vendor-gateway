I found the root cause: the OCR backend is already extracting `major_activity` correctly as `Services`, but the UI in your preview is still rendering the old MSME field block with only 3 fields. I will make the field rendering more robust and ensure loaded draft data also carries the extracted value.

Plan:
1. Update the MSME verified details UI so `Major Activity` always renders beside `Enterprise Type`, even when the value is empty.
2. Add explicit fallback display logic so if OCR does not fill it, the input still appears with a clear placeholder/manual-entry message instead of disappearing.
3. Fix draft hydration in `VendorRegistration.tsx` so existing verified MSME data maps back into the document step with `enterpriseType` and `majorActivity` instead of only `udyamNumber` and `enterpriseName`.
4. Fix the Step 1 to form merge so MSME enterprise type/category is carried into the statutory data where appropriate.
5. Keep OCR backend as-is for now because recent logs/database records confirm it is already returning:
   - `enterprise_type`: `Micro`
   - `major_activity`: `Services`

Technical details:
- `src/components/vendor/steps/DocumentVerificationStep.tsx` already has `major_activity` in OCR output and build output, but I will make the field block more defensive so it cannot be hidden by missing data or older state.
- `src/pages/VendorRegistration.tsx` currently rehydrates existing draft MSME data with only:
  `udyamNumber` and `enterpriseName`.
  I will extend that mapping to include `enterpriseType` and `majorActivity` when available.
- If the database/form model does not currently persist a dedicated `majorActivity` field, I will preserve the visible Step 1 value in the verified data and avoid breaking existing schema.