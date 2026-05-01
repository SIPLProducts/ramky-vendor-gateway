# Fix GST OCR → Verification chain with match check + auto-fill

## Problems found in current state

1. **GST provider misconfigured in DB**
   - `request_body_template` is `{"id_number": "37ABDCS6352G1Z7"}` — a hardcoded sample value, no `{{id_number}}` placeholder. Every call sends the same GSTIN.
   - `response_data_mapping` is a literal copy of a sample response object instead of JSON-path strings — same bug we just fixed for MSME. Fields don't populate even though the API succeeds.

2. **No OCR ↔ Verification match comparison**
   - `GstKycTab.handleOcrVerify` already chains `GST_OCR` → `GST` and merges responses, but it does NOT compare the OCR-extracted GSTIN against the GSTIN returned by the verification API.
   - On mismatch, the user sees a generic "verified" instead of an error.
   - On missing OCR fields, the merge happens but there's no explicit "populated from registry" indication.

3. **Success indicator is generic**
   - Current success Alert says whatever message we return. We need it to clearly read **"GSTIN is verified"** with the green check (the CheckCircle2 icon already exists in `OcrUploadAndVerify`).

## Fix plan

### 1. Database migration — fix GST provider config

```sql
UPDATE api_providers SET
  request_body_template = '{"id_number": "{{id_number}}"}'::jsonb,
  response_data_mapping = '{
    "gstin": "data.gstin",
    "pan_number": "data.pan_number",
    "legal_name": "data.legal_name",
    "business_name": "data.business_name",
    "trade_name": "data.business_name",
    "constitution_of_business": "data.constitution_of_business",
    "taxpayer_type": "data.taxpayer_type",
    "gstin_status": "data.gstin_status",
    "date_of_registration": "data.date_of_registration",
    "address": "data.address",
    "state_jurisdiction": "data.state_jurisdiction",
    "center_jurisdiction": "data.center_jurisdiction",
    "nature_of_core_business_activity_description":
      "data.nature_of_core_business_activity_description"
  }'::jsonb
WHERE provider_name = 'GST';
```

The edge function's existing auto-flatten safety net will still cover any drift, but with proper paths the response cleanly populates the form.

### 2. `KycApiSettings.tsx` seed template — sync the same fix

Update the seed `GST` template (`request_body_template` + `response_data_mapping`) so a future "reset to defaults" doesn't re-introduce the broken sample.

### 3. `GstKycTab.tsx` — add match comparison + populate-from-API + clear success message

In `handleOcrVerify(extracted)`:

- Capture `ocrGstin = extracted.gstin?.toUpperCase().trim()`.
- After chaining the `GST` verification call, capture `apiGstin = verify.data.gstin?.toUpperCase().trim()`.
- **Match cases:**
  - Both present and equal → success: `"GSTIN is verified"` (clean, exact wording the user asked for).
  - OCR missing GSTIN, API returned one → success: `"GSTIN populated and verified from registry"`.
  - Both present and different → fail: `"GSTIN mismatch: OCR read ${ocrGstin} but registry shows ${apiGstin}"`.
  - API call failed → fail: surface upstream message.
- After a successful verify, ensure `props.onGstinChange(apiGstin)` runs so the form field reflects the registry value (covers OCR misreads of single chars).
- Continue passing the merged record (`{ ...extracted, ...verify.data }`) into `props.onVerifiedDetails` so legal name, trade name, constitution, address, etc. fill any blanks in the form.
- Keep existing legal-name fuzzy match as a secondary check; only run when the user already typed a legal name.

For the manual-entry path (`handleManualVerify`), no behavior change needed — it already verifies the typed GSTIN; we'll just standardise its success line to `"GSTIN is verified — ${legalName}"`.

### 4. `OcrUploadAndVerify.tsx` — no structural changes

The component already renders:
- Green `CheckCircle2` Alert on success ✓ (this is the green tick the user asked for)
- Red `XCircle` Alert on failure with Retry ✓
- API response details panel below ✓

We're just feeding it cleaner messages from `GstKycTab`.

## Files to change

- New SQL migration — fix `GST` provider `request_body_template` and `response_data_mapping`.
- `src/pages/KycApiSettings.tsx` — sync seed template for `GST`.
- `src/components/vendor/kyc/GstKycTab.tsx` — match comparison logic, set GSTIN from API on success, standardise success/failure messages.

## Validation after deploy

1. **Manual entry** `37ABDCS6352G1Z7` → green "GSTIN is verified — SHARVI INFOTECH PRIVATE LIMITED" + all fields (legal name, trade name, constitution, PAN, address) populated.
2. **Upload certificate** whose OCR cleanly reads the GSTIN → green "GSTIN is verified", missing fields filled from registry.
3. **Upload certificate** where OCR misreads a character (e.g. `O` vs `0`) but registry returns the correct one → red mismatch alert showing both values.
4. **Upload certificate** where OCR fails to read the GSTIN at all → if registry call still works via any fallback, message reads "GSTIN populated and verified from registry"; otherwise red error with retry.
5. The seed template in KYC API Settings UI now shows `{{id_number}}` placeholder instead of the hardcoded sample.
