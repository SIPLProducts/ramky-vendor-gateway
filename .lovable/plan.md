Root cause found:
- The live PAN provider configuration is hardcoded: `request_body_template` is `{ id_number: "ABDCS6352G" }`.
- Its `response_data_mapping` is also wrong: it contains a pasted sample Sharvi response object, not JSON-path mappings.
- Because of that, when you send `AAUFM3575C`, the backend still calls Surepass with `ABDCS6352G`, so Surepass correctly returns Sharvi data for the hardcoded PAN.
- The middleware log is unrelated for this KYC call. The app calls the hosted backend function directly, not the local `middleware/server.js`, so nothing will appear in the local middleware console.
- For Bank verification, the backend code already forces `ifsc_details: true` and recent function logs show `ifsc_details=true`; however, the function can still be strengthened so saved admin misconfiguration cannot send `false` or stale templates.

Plan:
1. Correct the PAN provider configuration in the backend database:
   - Change PAN request template to use the actual input value: `{ "id_number": "{{id_number}}" }`.
   - Replace the pasted sample response mapping with real JSON paths, for example:
     - `pan_number -> data.pan_number`
     - `full_name -> data.full_name`
     - `status -> data.status`
     - `category -> data.category`
     - `dob -> data.dob`
     - `aadhaar_linked -> data.aadhaar_linked`
     - `client_id -> data.client_id`
   - Keep success check as `success == true`.

2. Harden `kyc-api-execute` so this cannot recur:
   - For provider `PAN`, always normalize the outgoing payload from the runtime input, not from any saved literal sample.
   - Send only the Surepass-required payload shape: `{ id_number: <entered PAN> }`.
   - Add safe logs showing provider name and keys only, not PAN/account values.

3. Harden Bank verification similarly:
   - Continue normalizing `BANK` payload server-side as `{ id_number: <account>, ifsc: <IFSC>, ifsc_details: true }`.
   - Ensure any saved `ifsc_details: false` or hardcoded sample template cannot override it.

4. Validate with direct backend function calls:
   - Call `kyc-api-execute` with the user’s PAN payload and confirm logs show keys only and payload uses runtime input.
   - Confirm response data is no longer Sharvi hardcoded data unless that exact PAN is submitted.
   - Call BANK payload and confirm `ifsc_details` remains true.

5. Optional UI safeguard:
   - If the app shows raw provider response details, surface the requested PAN/account alongside returned PAN/account so mismatches are visible immediately to admins/testers.