## Goal

In the SAP payload, the `vendors[]` array entry should send **Contact 2** and **Email 2** from the Registration Form for `mob_number` and `smtp_addr`.

## Storage check (no schema change needed)

Contact 2 and Email 2 are already captured on the Registration Form (Address step → `registeredContact2`, `registeredEmail2`) and persisted to `vendors.registered_contact_2` / `vendors.registered_email_2`. The resolver tokens `{{vendor.secondary_phone_value}}` and `{{vendor.secondary_email_value}}` already pull from those columns, so no DB or form changes are required.

## Change

Inside the `vendors: [{ ... }]` block only (top-level `mob_number` / `smtp_addr` outside the array stay on primary):

| Field        | Current source                                  | New source                                       |
|--------------|-------------------------------------------------|--------------------------------------------------|
| `mob_number` | `{{vendor.primary_phone_or_fallback\|trunc:30}}` | `{{vendor.secondary_phone_value\|trunc:30}}`     |
| `smtp_addr`  | `{{vendor.primary_email_or_fallback\|trunc:241}}`| `{{vendor.secondary_email_value\|trunc:241}}`    |

`smtp_addr2` and `tel_number` inside the same `vendors[]` entry currently point to the secondary fields. To avoid duplication, they will be blanked (`""`) so primary contact data does not silently drop out — Contact 2 / Email 2 become the sole values sent in this array.

## Files / data to update

1. **`src/lib/sapDefaultTemplate.ts`** — update the two fields inside `vendors: [{...}]`; blank `smtp_addr2` and `tel_number` in that same entry.
2. **`supabase/functions/sync-vendor-to-sap/index.ts`** — apply the same change to the inline `DEFAULT_SAP_PAYLOAD_TEMPLATE` fallback so self-hosted/edge runs match.
3. **`sap_payload_templates` table** — patch the active row (`is_active = true AND tenant_id IS NULL`) JSON `template -> vendors[0]` with the same four field updates, since the live SAP Sync screen reads from this row (built-in default is only the fallback).

## Out of scope

- No changes to Registration Form fields, validation, resolver functions, region mapping, classification, banking, or any other SAP field.
- Top-level (non-`vendors[]`) `smtp_addr` / `mob_number` / `tel_number` keep their current mappings.
