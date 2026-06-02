## Root cause

For this vendor (`AVYAKTH`), SAP shows the BP created but with no email and no bank account holder. The reason is in the active SAP payload template + the client-side payload builder:

| SAP field | Template source | Vendor value sent |
|---|---|---|
| `smtp_addr` | `vendor.primary_email` | `""` (empty) |
| `mob_number` | `vendor.primary_phone` | `""` (empty) |
| `tel_number` | `vendor.registered_phone` | OK |
| `accountholder` | `vendor.account_holder_name` | `null` → `""` |
| `bankaccountname` | `vendor.account_holder_name` | `null` → `""` |
| `bank_acct` | `vendor.account_number` | OK |
| `bank_key` | `vendor.ifsc_code` | OK |

The vendor record actually has the data, just under different columns:
- `primary_email=""` but `registered_email="sureshkumar.b@sharviinfotech.com"` and `branch_email` populated
- `primary_phone=""` but `registered_contact_1="9618888996"` populated
- `account_holder_name=null` but `legal_name="AVYAKTH"` exists (SAP uses NAME1 as holder when blank, so the line stays empty)

So although the payload structurally contains `smtp_addr` / `accountholder` keys, the values resolve to empty strings, and SAP correctly stores nothing for those fields. No SAP integration call shape is changing — we only fix the value resolution.

## Changes (scoped to SAP sync; no other functionality touched)

### 1. `supabase/functions/sync-vendor-to-sap/index.ts` — resolver helpers

Extend `resolveExpr` (or add small named helpers in the same pattern as `vendor.trade_name_first_word`) to support three fallback expressions:

- `vendor.primary_email_or_fallback` → first non-empty of `primary_email`, `registered_email`, `branch_email`, `manufacturing_email`
- `vendor.primary_phone_or_fallback` → first non-empty of `primary_phone`, `registered_contact_1`, `registered_phone`
- `vendor.account_holder_or_legal` → first non-empty of `account_holder_name`, `legal_name`

These remain inside the same template-resolver design; no schema or RFC contract change.

### 2. `supabase/functions/sync-vendor-to-sap/index.ts` — `DEFAULT_SAP_PAYLOAD_TEMPLATE`

Update the built-in fallback template (used when no DB row exists) so it references the new keys:

- top-level `smtp_addr` and `vendors[0].smtp_addr` → `{{vendor.primary_email_or_fallback|trunc:241}}`
- top-level `mob_number` and `vendors[0].mob_number` → `{{vendor.primary_phone_or_fallback|trunc:30}}`
- `accountholder` and `bankaccountname` → `{{vendor.account_holder_or_legal|trunc:60}}`

### 3. `src/lib/sapDefaultTemplate.ts` — keep client preview in sync

Mirror the same three substitutions so the client-side preview / fallback template matches what the edge function sends. International branch (intl bank, intl email) is untouched.

### 4. `src/lib/sapPayloadBuilder.ts` — client resolver

Add the same three helpers in `resolveExpr` (mirroring the existing `vendor.trade_name_first_word` helper) so when the client preview / submission resolves the template, the values are populated. No change to international handling.

### 5. Active DB template (`sap_payload_templates`)

Run a one-time data update (via the insert tool) on the single active row to replace these three placeholders so existing tenants get the fix without re-publishing the template:

- `smtp_addr` (top + nested) → `{{vendor.primary_email_or_fallback|trunc:241}}`
- `mob_number` (top + nested) → `{{vendor.primary_phone_or_fallback|trunc:30}}`
- `accountholder`, `bankaccountname` → `{{vendor.account_holder_or_legal|trunc:60}}`

## Out of scope (will not touch)

- SAP endpoint, auth, middleware, payload shape, CLASSIFY/UPLOAD logic, region resolver, DMS sync, approval workflow, vendor schema.
- Bank `BRANCH_NAME` / `BANK_NAME` / `BANK_ADDRESS` keys — current SAP template does not declare them and adding new keys could be rejected by the SAP RFC. If you want those persisted too, confirm the exact SAP key names (e.g. `banka`, `stras`, `brnch`) and I'll wire them in a follow-up.

## Verification

After the fix, re-trigger SAP sync for vendor `9943cbcf-…` and confirm the request payload (visible in `sync-vendor-to-sap` edge logs) shows non-empty `smtp_addr`, `mob_number`, `accountholder`, `bankaccountname`, and that SAP's BP record stores them.
