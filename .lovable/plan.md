## Why bank verification is not firing today

Two issues in the current setup:

1. In `DocumentVerificationStep.tsx`, the `cheque` branch of `verifyApi` is still simulated — it just echoes the OCR data back as `apiData` with `simulated: true` and never calls the configured `BANK` provider. So after cheque OCR succeeds, no `/api/v1/bank-verification/` call is made.
2. The `BANK` provider row in `api_providers` is misconfigured:
   - `request_body_template` has hardcoded values (`id_number: "1714348594"`, `ifsc: "KKBK0007746"`) instead of placeholders.
   - `response_data_mapping` was saved as a literal example response object instead of JSON paths, so even if the call ran, no fields would be extracted.

## Plan

### 1. Fix the `BANK` provider configuration in `api_providers`

Update the row where `provider_name = 'BANK'`:

- `endpoint_path`: `/api/v1/bank-verification/` (already correct)
- `http_method`: `POST` (already correct)
- `request_mode`: `json` (already correct)
- `request_headers`: `{ "Content-Type": "application/json" }` (already correct)
- `request_body_template` →
  ```json
  { "id_number": "{{account}}", "ifsc": "{{ifsc}}", "ifsc_details": true }
  ```
- `response_success_path`: `success`
- `response_success_value`: `true`
- `response_message_path`: `message`
- `response_data_mapping` → real JSON paths:
  ```json
  {
    "account_number": "data.account_number",
    "account_exists": "data.account_exists",
    "name_at_bank": "data.full_name",
    "imps_ref_no": "data.imps_ref_no",
    "remarks": "data.remarks",
    "status": "data.status",
    "ifsc": "data.ifsc_details.ifsc",
    "micr": "data.ifsc_details.micr",
    "bank_name": "data.ifsc_details.bank_name",
    "branch_name": "data.ifsc_details.branch",
    "branch_address": "data.ifsc_details.address",
    "branch_city": "data.ifsc_details.city",
    "branch_district": "data.ifsc_details.district",
    "branch_state": "data.ifsc_details.state",
    "branch_centre": "data.ifsc_details.centre",
    "branch_contact": "data.ifsc_details.contact"
  }
  ```

### 2. Replace the simulated bank branch in `verifyApi`

In `src/components/vendor/steps/DocumentVerificationStep.tsx`, change the `cheque` branch of `verifyApi` to actually call the configured `BANK` provider:

- Read `account_number` and `ifsc_code` from OCR.
- Validate locally first:
  - Account number must be 8–18 digits.
  - IFSC must match `^[A-Z]{4}0[A-Z0-9]{6}$`.
  - On failure → return `ok:false` with a clear message; the existing `runDocFlow` already surfaces that as the error message under the card.
- Call `callProvider({ providerName: "BANK", input: { account, ifsc } })` (matches the `{{account}}` / `{{ifsc}}` placeholders).
- Surface results via `toastKycResult("Bank", r)` like the GST flow.
- On `!r.found` → "Bank validation provider is not configured."
- On `!r.ok || !r.data` → "Bank verification failed. Please check the details or try again." (with upstream message if present).

### 3. Compare OCR vs API and decide pass/fail

After a successful API response:

- Compare normalized `account_number` (digits only) — must match OCR.
- Compare normalized `ifsc` (upper-cased) — must match OCR.
- If `account_exists` is `false` → fail with "Bank account not found at the bank."
- If account or IFSC mismatch → return `ok:false` with a precise message, e.g.:
  - `Bank details mismatch: cheque shows account "XXXX1234" but registry returned "XXXX5678".`
  - `IFSC mismatch: cheque shows "KKBK0007746" but registry returned "KKBK0007999".`
- If everything matches → success. The existing `name_at_bank` from the API is also used to compute `nameMatchScore` against the vendor's legal name (already wired through `runDocFlow`'s `afterVerifiedOcrName`).

### 4. Auto-fill missing fields from the API response

Return a `normalized` object from the bank branch (same pattern already used by GST), so `runDocFlow` will merge it into `ocrData`:

```text
normalized = {
  account_number, ifsc_code, bank_name, branch_name,
  account_holder_name: name_at_bank,
  branch_address, branch_city, branch_state, micr
}
```

This way, if cheque OCR misses Bank Name, Branch, or Account Holder Name, they get populated automatically from the API response — no manual entry needed.

The existing `setBankDoc` post-processing that calls Razorpay's IFSC lookup will still run as a fallback, but the API's `ifsc_details` will normally cover everything first.

### 5. Verification status UI

The card already renders status-driven UI from `bankDoc.status`. With this change:

- On success: card shows the existing green "Verified" header plus a small success line under the fields — "Bank details are verified" with the existing `BadgeCheck` indicator and (when available) `— {name_at_bank}`.
- On any failure: the existing red error block under the card displays the specific mismatch / not-found / network-failure message produced above.
- The bank tab is only marked verified after the API call passes (already gated by `bankDoc.status === "verified"`).

### 6. Files / data touched

- DB: `UPDATE public.api_providers ... WHERE provider_name = 'BANK'` to fix template + mapping (data update, not schema).
- Frontend: `src/components/vendor/steps/DocumentVerificationStep.tsx` — replace the simulated `cheque` branch in `verifyApi`, add the comparison + small success label.

No new secrets, no new tables, no edge-function changes. The existing `kyc-api-execute` edge function and `useConfiguredKycApi` hook already handle JSON payload substitution and bearer-token auth from the provider row.
