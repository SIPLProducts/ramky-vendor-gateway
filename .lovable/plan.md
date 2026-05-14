Do I know what the issue is? Yes.

The BANK provider is currently configured with `ifsc_details: true`, and the latest backend log shows the app is sending keys `ifsc,id_number,ifsc_details` for BANK. Your screenshot with `ifsc_details: false` explains the behavior: when it is false, Surepass can return incomplete/failing bank validation and still consumes a transaction attempt, which can quickly lead to `429 Transaction rate limit exceeded` during repeated testing.

The problem is not the other APIs. It is specifically the BANK verification request shape and config hardening.

Plan to fix permanently:

1. Lock the BANK payload in the backend executor
   - In `kyc-api-execute`, when `providerName === "BANK"`, force the outgoing payload to exactly include:
     - `id_number: <account number>`
     - `ifsc: <IFSC>`
     - `ifsc_details: true`
   - This prevents any admin/provider template mistake or frontend input from accidentally sending `false`.

2. Normalize account input keys
   - The frontend sometimes sends both `account` and `id_number` for compatibility.
   - The backend will canonicalize this so Surepass receives only the required BANK fields, not extra or empty fields.

3. Fix the existing BANK provider mapping/config data
   - Update the active BANK provider config so `request_body_template.ifsc_details` is `true`.
   - Replace the currently bad `response_data_mapping` sample-response object with proper dotted paths, so successful responses map cleanly.

4. Keep duplicate-call protection but make it safer
   - Keep the frontend in-flight dedupe already added.
   - Add a backend-side short cache only for identical successful BANK calls so accidental double-clicks do not create repeated Surepass transactions.
   - Do not auto-retry BANK on 429.

5. Verify after implementation
   - Test the deployed `kyc-api-execute` function with the same account/IFSC payload.
   - Confirm logs show BANK payload keys include `ifsc_details` and no `false` value.
   - Confirm the UI receives the real Surepass response and not a designed/mock response.