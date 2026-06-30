## Goal

Send Contact 2 and Email 2 from the Registration Form on the **secondary** SAP fields (`mob_number2` / `smtp_addr2`) and restore the **primary** fields (`mob_number` / `smtp_addr` / `tel_number`) to their original meaning — both at the top level and inside `vendors[]`. Top-level already does this correctly; the `vendors[]` entry currently overwrites the primary fields with the secondary values and is missing `mob_number2` entirely.

## Final mapping (after change)

Top-level (already correct, no change needed):
- `smtp_addr`  → Email 1 (`primary_email_or_fallback`)
- `smtp_addr2` → Email 2 (`secondary_email_value`)
- `mob_number` → Contact 1 (`primary_phone_or_fallback`)
- `mob_number2` → Contact 2 (`secondary_phone_value`)  ← add at top level
- `tel_number` → Contact 2 (kept as-is for backward compat)

`vendors[0]` entry (fix):
- `smtp_addr`  → Email 1
- `smtp_addr2` → Email 2
- `mob_number` → Contact 1
- `mob_number2` → Contact 2  ← new key
- `tel_number` → `""`

## Files to change

1. **`src/lib/sapDefaultTemplate.ts`** — built-in fallback template
   - Top-level: add `mob_number2: "{{vendor.secondary_phone_value|trunc:30}}"` next to `mob_number`.
   - `vendors[0]`:
     - `smtp_addr`  → `"{{vendor.primary_email_or_fallback|trunc:241}}"`
     - `smtp_addr2` → `"{{vendor.secondary_email_value|trunc:241}}"`
     - `mob_number` → `"{{vendor.primary_phone_or_fallback|trunc:30}}"`
     - Add `mob_number2: "{{vendor.secondary_phone_value|trunc:30}}"`
     - `tel_number` stays `""`

2. **`supabase/functions/sync-vendor-to-sap/index.ts`** — patch the embedded default template the same way (top-level add `mob_number2`; vendors[] restore primary and add `mob_number2`).

3. **`sap_payload_templates` table** — update the active row's `template` JSONB so live tenants pick up the new mapping immediately (no schema change, just a `jsonb_set` on the existing row, mirroring the file edits above).

## Out of scope

- No new resolver helpers — `secondary_phone_value` / `secondary_email_value` / `primary_*_or_fallback` already exist in `src/lib/sapPayloadBuilder.ts`.
- No registration-form changes; Contact 2 / Email 2 are already captured as `registered_contact_2` / `registered_email_2`.
- No edge-function logic changes beyond the embedded default template literal.
