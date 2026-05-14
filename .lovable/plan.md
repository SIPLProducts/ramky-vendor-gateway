## What I found

The hosted backend looks healthy, and the main issue is in the integrated registration flow:

- The active vendor registration screen uses `DocumentVerificationStep.tsx`, not only the smaller `BankKycTab.tsx` component.
- In the cheque flow, after OCR extracts account + IFSC, the app calls the `BANK` provider once, but then it has an internal retry loop for rate-limit responses:
  - first call immediately
  - retry after 15 seconds
  - retry again after 30 seconds
- That means one user action can trigger up to 3 Surepass bank-verification transactions, which can itself cause or prolong `Transaction rate limit exceeded`.
- When that fails, the app opens the manual bank popup; submitting that popup calls the same `BANK` provider again, creating an additional transaction attempt for the same account/IFSC.
- The database configuration for `BANK` is also misconfigured: the saved request body currently contains hardcoded sample values (`1714348594`, `KKBK0007746`) instead of placeholders. The edge function has a partial safety merge, but because the hardcoded values are not empty, it will not replace them. This is a real hardcoded-value problem.
- The `BANK` response mapping is also misconfigured: it appears to contain a pasted sample response instead of JSON-path mappings. The edge function falls back to flattening data, but fixing the config will make results deterministic.

## Fix plan

1. **Remove retry behavior from bank verification**
   - Remove the 15s/30s retry loop in `DocumentVerificationStep.tsx`.
   - A single click/upload/manual submit should trigger only one `BANK` provider call.
   - If Surepass returns 429/rate-limit, show the real provider message and do not auto retry.

2. **Prevent duplicate user-triggered bank calls**
   - Add an in-flight guard for bank verification requests keyed by account + IFSC.
   - If the same bank verification is already running, the UI will not start another call.
   - Disable/ignore repeated upload/manual submit actions while bank verification is busy.

3. **Fix hardcoded BANK provider payload configuration**
   - Update the active `BANK` provider configuration in the database from hardcoded sample values to:
     ```json
     {
       "id_number": "{{id_number}}",
       "ifsc": "{{ifsc}}",
       "ifsc_details": true
     }
     ```
   - Keep the application payload as:
     ```json
     {
       "account": "...",
       "ifsc": "...",
       "id_number": "..."
     }
     ```
     so both existing placeholders and provider templates continue working.

4. **Fix BANK response mapping**
   - Update the active `BANK` mapping to JSON paths, for example:
     ```json
     {
       "account_number": "data.account_number",
       "account_exists": "data.account_exists",
       "full_name": "data.full_name",
       "name_at_bank": "data.full_name",
       "ifsc": "data.ifsc_details.ifsc",
       "bank_name": "data.ifsc_details.bank_name",
       "branch_name": "data.ifsc_details.branch",
       "branch_address": "data.ifsc_details.address",
       "branch_city": "data.ifsc_details.city",
       "branch_state": "data.ifsc_details.state",
       "micr": "data.ifsc_details.micr",
       "imps_ref_no": "data.imps_ref_no"
     }
     ```

5. **Add better diagnostic logging without exposing secrets**
   - Log one safe line in the edge function for each provider call: provider name, request mode, and sanitized payload keys/placeholder status.
   - Do not log API tokens or full Authorization headers.
   - This will make it clear whether the app is sending one request or multiple.

6. **Validate after implementation**
   - Use the deployed edge function test endpoint with the exact payload you provided.
   - Confirm the backend sends dynamic values, not the hardcoded sample values.
   - Confirm the UI path cannot auto-trigger multiple bank-verification calls from one upload or repeated submit.