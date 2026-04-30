## Problem

The Surepass OCR responses are nested differently than what our code expects, so values aren't populating in the verified fields:

- **PAN OCR** returns `data.ocr_fields[0].pan_number.value` and `full_name.value` — code looks for flat `extracted.pan_number` / `extracted.full_name`.
- **GST OCR** returns `data.ocr_fields[0].gstin.value` only — code looks for `extracted.gstin`. Surepass GST OCR genuinely returns only GSTIN; Legal Name / Trade Name / Constitution must come from a follow-up GST verification call using that GSTIN.
- **Bank (Cheque) OCR** returns `data.account_number.value`, `data.ifsc_code.value` — code looks for `extracted.account_number`. Bank Name / Branch / Account Holder Name aren't in the cheque OCR response either; they must be fetched via a follow-up bank verification (penny-drop / IFSC lookup) call.

Also, the admin response-mapping rows are misconfigured: PAN_OCR / GST_OCR mappings are empty, and BANK was saved with a literal sample response instead of dotted paths. The shared `ApiResponseDetails` card therefore renders the nested `{value, confidence}` objects as JSON instead of clean values.

## Fix Plan

### 1. Database — fix provider response mappings (migration)

Update `api_providers.response_data_mapping` to use the correct nested Surepass paths:

- **PAN_OCR** →
  ```
  pan_number:        data.ocr_fields.0.pan_number.value
  full_name:         data.ocr_fields.0.full_name.value
  father_name:       data.ocr_fields.0.father_name.value
  dob:               data.ocr_fields.0.dob.value
  document_type:     data.ocr_fields.0.document_type
  ```
- **GST_OCR** →
  ```
  gstin:             data.ocr_fields.0.gstin.value
  document_type:     data.ocr_fields.0.document_type
  ```
- **BANK** (cheque OCR) →
  ```
  account_number:    data.account_number.value
  ifsc_code:         data.ifsc_code.value
  micr:              data.micr.value
  ```

(MSME mapping is already correct.)

### 2. Auto-trigger follow-up verification to populate the "missing" fields

Surepass cheque OCR and GST OCR don't return the full record. To deliver Legal Name / Trade Name / Constitution / Bank Name / Branch / Account Holder Name, after the OCR step succeeds the frontend will automatically call the corresponding verification provider:

- **GST tab**: after OCR returns a GSTIN, call the existing `GST` provider (Surepass GST verification) with `{ gstin }`. Merge the verification response (`legal_name`, `trade_name`, `constitution_of_business`, etc.) into `extracted` before name-match and before showing the response card.
- **Bank tab**: existing flow already calls `BANK` for penny-drop after OCR, so it just needs the OCR mapping fix above plus a `BANK_VERIFY` (or reuse `BANK` with a different endpoint) call to fetch `bank_name`, `branch`, `account_holder_name`. We'll reuse the existing penny-drop call already wired in `BankKycTab.handleVerify`; once mappings are correct, those merged values will display.

If a `GST` verification provider isn't configured yet, the UI will still show the GSTIN + a soft notice — no hardcoded fallback.

### 3. Frontend — clean field rendering

`ApiResponseDetails.tsx` will be updated to:

- When a value is an object shaped like `{ value, confidence }` (Surepass convention), render `value` and show confidence as a small subtitle.
- When a value is an array of such objects (e.g. `ocr_fields`), flatten the first entry's fields into the rendered list with prettified labels.
- Continue to render every field returned by the API verbatim — no hardcoded field names.

### 4. PAN / GST / Bank tab logic

- `PanKycTab.handleVerify`: keep using `extracted.pan_number` and `extracted.full_name` (now populated by the corrected mapping). No hardcoded values.
- `GstKycTab.handleOcrVerify`: after OCR, if a GSTIN was extracted and the `GST` validation provider is enabled, call it to fetch full GST details, then merge into `extracted` so Legal/Trade/Constitution show up.
- `BankKycTab.handleVerify`: keep current penny-drop call; merged values from the verification response (bank_name, branch, account_holder_name) will fill the "missing" cheque fields.

### 5. Files Touched

- New migration: `supabase/migrations/<timestamp>_fix_kyc_ocr_mappings.sql` — sets correct `response_data_mapping` for PAN_OCR, GST_OCR, BANK.
- `src/components/vendor/kyc/ApiResponseDetails.tsx` — handle `{value, confidence}` and `ocr_fields[]` shapes generically.
- `src/components/vendor/kyc/GstKycTab.tsx` — chain GST OCR → GST verification call to populate Legal Name / Trade Name / Constitution.
- `src/components/vendor/kyc/BankKycTab.tsx` — no logic change beyond benefiting from corrected mapping; ensure merged verification values surface in the rendered card.
- `src/components/vendor/kyc/PanKycTab.tsx` — unchanged logic; benefits from corrected mapping.
- (No edge function changes — the existing `getPath` already supports `data.ocr_fields.0.pan_number.value` style paths.)

## Result

- PAN: PAN Number + PAN Holder Name (+ DOB, Father Name) populate from the Surepass API response, dynamically.
- GST: GSTIN populates from OCR; Legal Name / Trade Name / Constitution populate from the chained GST verification call — all from API responses, nothing hardcoded.
- Bank: Account Number + IFSC populate from cheque OCR; Bank Name / Branch / Account Holder Name populate from the chained penny-drop verification — all from API responses.
- The "View details" card displays clean field/value pairs (with confidence) instead of raw nested JSON.