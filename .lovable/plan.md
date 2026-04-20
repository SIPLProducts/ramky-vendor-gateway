
## Plan: Remove All Mock/Simulation APIs — Switch to Live Verification

Goal: eliminate all simulated/mock validation responses and route every check through real third-party APIs. Real API failures will return real errors (no silent fallback to fake "success").

### Scope of Mocks to Remove

| Validation | Current Mock | Replacement |
|---|---|---|
| GST | `simulateGSTVerification()` + `simulationMode=true` default | Live Cashfree GST API only |
| PAN | `simulatePANVerification()` + `simulationMode=true` default | Live Cashfree PAN API only |
| MSME / Udyam | `simulateMSMEValidation()` + `USE_SIMULATION_MODE` env | Live Cashfree Udyam API only |
| Bank | Any simulation fallback in `validate-bank` | Live Cashfree Bank API only |
| Penny Drop | Fully mocked `validate-penny-drop` | New real **Surepass Reverse Penny Drop** function |
| Name Match | Internal Levenshtein (not a mock — keep) | Unchanged |

### Phase 1 — Strip Simulation from Cashfree Functions

For `validate-gst`, `validate-pan`, `validate-msme`, `validate-bank`:
- Delete all `simulate*()` helper functions
- Delete `simulationMode` request param and `USE_SIMULATION_MODE` env checks
- Delete fallback-to-simulation branches when API fails or credentials missing
- If `CASHFREE_CLIENT_ID` / `CASHFREE_CLIENT_SECRET` missing → return `{ valid: false, message: "Verification service not configured" }` with 500
- If Cashfree API returns non-OK → return real error message + status, log to `validation_api_logs`
- Keep format validation (regex) — that's not a mock, it's input validation

### Phase 2 — Implement Real Surepass Reverse Penny Drop

Replace `supabase/functions/validate-penny-drop/index.ts` with real Surepass integration per `pennydrop.md`:

- **Action `initialize`**: POST `https://kyc-api.surepass.io/api/v1/bank-verification/reverse-penny-drop/initialize` → returns `client_id`, `payment_link`, app deep links (gpay/phonepe/paytm/bhim/whatsapp)
- **Action `status`**: POST `https://kyc-api.surepass.io/api/v1/bank-verification/reverse-penny-drop/status` with `{client_id}` → returns `account_number`, `ifsc`, `holder_name`, `upi_id`, `status`
- Routes via `?action=initialize` or `?action=status` query param (single function)
- On success: persist into `vendors.pennydrop_status` (jsonb), `vendors.pennydrop_init`, `vendors.pennydrop_verification_status`
- Auth header: `Bearer ${SUREPASS_TOKEN}` (user adds secret manually)

### Phase 3 — Frontend UPI Verification UI

Update `BankStep.tsx` + `useVendorValidations.tsx`:
- Add **"Verify Bank via UPI Penny Drop"** button → calls `initialize`
- Render QR code (use `qrcode` lib) of `payment_link` + buttons for GPay / PhonePe / Paytm / BHIM / WhatsApp using returned deep links
- Poll `status` every 5s for up to 5 min
- On `status=success`: auto-fill account_number, ifsc_code, account_holder_name; lock fields; mark validation passed
- Stages shown: Awaiting Payment → Payment Received → Account Verified

### Phase 4 — Remove Mock Data from UI Demo Components

- `src/components/vendor/PennyDropDemo.tsx` — replace simulated flow with real `initialize`/`status` calls (or remove if no longer needed)
- `src/components/vendor/EmailNotificationDemo.tsx` — leave (not a validation mock)
- `src/data/mockVendors.ts` — keep only if used for admin seeding; flag for user

### Phase 5 — Audit Logging

Every real API call (Cashfree + Surepass) writes a row to `validation_api_logs` with `is_success`, `response_status`, `execution_time_ms`, `request_payload`, `response_payload`. The existing `ValidationApiLogs` admin page already displays these.

### Technical Details

**Files to modify**
- `supabase/functions/validate-gst/index.ts` — strip simulation
- `supabase/functions/validate-pan/index.ts` — strip simulation
- `supabase/functions/validate-msme/index.ts` — strip simulation
- `supabase/functions/validate-bank/index.ts` — strip simulation (verify current state)
- `supabase/functions/validate-penny-drop/index.ts` — replace with Surepass impl
- `supabase/config.toml` — already has all functions registered; no change
- `src/components/vendor/steps/BankStep.tsx` — UPI QR + polling UI
- `src/hooks/useVendorValidations.tsx` — add `initiatePennyDrop()` + `pollPennyDropStatus()`
- `src/components/vendor/PennyDropDemo.tsx` — wire to real function or remove

**New dependency**
- `qrcode` (and `@types/qrcode`) for rendering UPI QR

**Secrets needed**
- `SUREPASS_TOKEN` — user will add manually in Lovable Cloud secrets
- `CASHFREE_CLIENT_ID` + `CASHFREE_CLIENT_SECRET` — already configured ✓

**Cashfree IP whitelisting note**
Cashfree production typically requires whitelisting caller IPs. Supabase Edge Function egress IPs are not static. After this change, if Cashfree returns auth/IP errors, the user must either (a) request Cashfree to disable IP whitelisting on the account, or (b) we proxy through a fixed-IP service. This is operational, not a code issue — flagged here so the user knows.

**No DB migrations required** — all required columns already exist.

### Out of Scope
- Replacing Cashfree with another provider
- Building a fallback "test mode" toggle (explicitly removed by this request)
- Cashfree IP-whitelisting setup
