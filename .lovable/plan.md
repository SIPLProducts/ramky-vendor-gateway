## Root Cause

The Surepass API is returning `"Invalid UAN."` because the request body it receives has an **empty** `id_number`, even though the UI sends the correct Udyam number.

Verified from the database:

```
provider_name | request_body_template | request_mode
MSME          | {"id_number": ""}     | json
```

The saved `request_body_template` for the MSME provider is the literal value `{"id_number": ""}` — there is **no `{{id_number}}` (or `{{msme}}`) placeholder**, so the edge function's `substitute()` never injects the Udyam number. Surepass therefore receives `{"id_number": ""}` → returns `verification_failed` / `Invalid UAN.`.

The frontend correctly sends `input: { id_number: "UDYAM-AP-04-0057131", msme: "UDYAM-AP-04-0057131" }`, and the edge function works correctly when the template contains `{{id_number}}`. The bug is purely in the stored provider configuration (which was overwritten at some point with a literal empty string instead of the placeholder template).

## Fix

### 1. Database — correct the saved MSME provider template
Run a migration to update the existing MSME provider row so its `request_body_template` actually references the variable:

```json
{ "id_number": "{{id_number}}" }
```

This makes substitution work for the payload the frontend already sends (`id_number`).

### 2. KYC API Settings — align the seed template with the frontend
In `src/pages/KycApiSettings.tsx`, the MSME / Udyam Manual seed currently uses `{{msme}}`:

```ts
request_body_template: { id_number: "{{msme}}" }
```

Change it to `{{id_number}}` so that:
- it matches the key the vendor registration UI sends (`id_number`)
- if an admin re-seeds or re-saves the provider, the working template is restored instead of the broken one
- it stays consistent with the GST / Bank templates which also use the actual input key names

### 3. Edge function — defensive guard (small hardening)
In `supabase/functions/kyc-api-execute/index.ts`, add a safety check before calling Surepass for `request_mode === "json"`: if the substituted body still contains an empty `id_number` while the caller provided a non-empty one in `input`, fall back to using `input.id_number` directly. This prevents a recurrence if the template is ever saved blank again, and surfaces a clearer error otherwise.

### 4. No UI changes required
The Step 1 MSME Manual Entry tab, Validate button, response mapping, and field auto-population are already implemented correctly and will start working as soon as the template is fixed.

## Files Touched

- `supabase/migrations/<new>.sql` — UPDATE `api_providers` SET `request_body_template = '{"id_number":"{{id_number}}"}'::jsonb` WHERE `provider_name = 'MSME'`.
- `src/pages/KycApiSettings.tsx` — change MSME seed template from `{{msme}}` to `{{id_number}}`.
- `supabase/functions/kyc-api-execute/index.ts` — add fallback so an empty templated `id_number` is replaced by `input.id_number` when present.

## Expected Result

After the fix, clicking **Validate** on the MSME tab with `UDYAM-AP-04-0057131` will send `{"id_number":"UDYAM-AP-04-0057131"}` to `https://kyc-api.surepass.app/api/v1/corporate/udyog-aadhaar`, and the populated response (enterprise name, type, NIC code, address, etc.) will fill the MSME fields exactly as it does in Postman.
