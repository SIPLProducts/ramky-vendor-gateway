## Goal
Three SAP Sync corrections: NAME1 derivation rule, address/contact mapping (with new "Individual" org type), and VEN_CLASS rule.

---

### 1. NAME1 source rule

Currently `name1` resolves to `{{vendor.legal_name|trunc:40}}` in both the built-in template (`src/lib/sapDefaultTemplate.ts`) and the DB template, and the same value is shown across the app.

Change to:
- If `vendor.gstin` is non-empty → use **Trade Name** (`vendor.trade_name`).
- Otherwise → use **PAN Account Holder Name** (`vendor.pan_holder_name` / fallback `account_holder_name`).

Implementation:
- Add a new resolver token `vendor.name1_value` in both:
  - `src/lib/sapPayloadBuilder.ts` (`resolveExpr`)
  - `supabase/functions/sync-vendor-to-sap/index.ts` (`resolveExpr`)
  
  Logic: `gstin ? (trade_name || legal_name) : (pan_holder_name || account_holder_name || legal_name)`.
- Update `src/lib/sapDefaultTemplate.ts` so `name1`, `vendors[0].name1`, `sterm1` use `{{vendor.name1_value|trunc:40}}` (and trunc:20 for sterm1).
- In the UI: wherever the SAP "Name / NAME1" value is shown (SAP Sync view, vendor preview, review dialog), compute and display the same derived value. Add a tiny helper `getSapName1(vendor)` in `src/lib/sapPayloadBuilder.ts` and reuse in:
  - `src/pages/SAPSync.tsx` (vendor name column in result tables)
  - `src/components/sap/SapFieldsDialog.tsx` (preview of NAME1)
  - `src/components/vendor/VendorSubmissionPreviewDialog.tsx` (where legal_name is shown as SAP name)

No DB column changes.

---

### 2. Organization Type + contact/email mapping

**2a. Add "Individual" option** to `ORGANIZATION_TYPES` in `src/types/vendor.ts`. It will automatically surface in:
- `OrganizationStep.tsx`
- `EnterpriseOrganizationStep.tsx`
- any read-only displays that just print `organization_type`.

**2b. Fix SAP contact/email mapping**

Today the template uses:
- `mob_number = {{vendor.primary_phone_or_fallback}}` (resolver prefers `primary_phone` first)
- `smtp_addr = {{vendor.primary_email_or_fallback}}` (resolver prefers `primary_email` first)
- `tel_number = {{vendor.registered_phone}}` (legacy column, usually empty)

Required mapping:
| Form field | SAP key |
|---|---|
| Contact 1 (`registered_contact_1`) | `MOB_NUMBER` |
| Contact 2 (`registered_contact_2`) | stored as Secondary Contact (also sent as `tel_number` so SAP keeps it) |
| Email 1 (`registered_email`) | `SMTP_ADDR` |
| Email 2 (`registered_email_2`) | stored as Secondary Email (`smtp_addr2` in payload, empty if blank) |

Changes:
- In both resolvers update:
  - `vendor.primary_phone_or_fallback` → `registered_contact_1 || primary_phone` (Contact 1 wins)
  - `vendor.primary_email_or_fallback` → `registered_email || primary_email` (Email 1 wins)
  - Add new token `vendor.secondary_phone_value` → `registered_contact_2 || secondary_phone`
  - Add new token `vendor.secondary_email_value` → `registered_email_2 || secondary_email`
- In `src/lib/sapDefaultTemplate.ts`:
  - `tel_number` → `{{vendor.secondary_phone_value|trunc:30}}` (top-level + `vendors[0]`)
  - Add `smtp_addr2: "{{vendor.secondary_email_value|trunc:241}}"` (top-level + `vendors[0]`)
- Keep the existing `mob_number` / `smtp_addr` template strings — only the resolver priority changes.

---

### 3. VEN_CLASS rule

Today `ven_class` uses `{{override.ven_class}}` and the override defaults from `sap_default_fields`. There is no GST-aware rule.

New rule:
- `gstin` present → `VEN_CLASS = ""`
- `gstin` absent → `VEN_CLASS = "0"`

Implementation:
- Add resolver token `vendor.ven_class_value` in both resolvers: `gstin ? "" : "0"`.
- Update `src/lib/sapDefaultTemplate.ts` so `ven_class` (top-level + `vendors[0]`) becomes `{{override.ven_class|default_ven_class}}` — implement a `default_ven_class` filter that, when the override value is empty, returns the GST-aware default. (Keeps manual overrides from SapFieldsDialog still working.)
- Display the same computed value in the UI:
  - `SapFieldsDialog.tsx` — initialise `ven_class` default with the GST-aware value when no tenant default exists, and show a small helper note "Auto: empty when GST present, 0 otherwise."
  - `SAPSync.tsx` — show the computed `ven_class` in the per-vendor result/preview row.

---

### Files to edit

- `src/types/vendor.ts` — add "Individual".
- `src/lib/sapDefaultTemplate.ts` — `name1`, `sterm1`, `tel_number`, add `smtp_addr2`, `ven_class` template strings.
- `src/lib/sapPayloadBuilder.ts` — new resolver tokens + `default_ven_class` filter + exported `getSapName1` helper.
- `supabase/functions/sync-vendor-to-sap/index.ts` — mirror resolver tokens + filter.
- `supabase/functions/sync-vendors-to-sap-bulk/index.ts` — same resolver/filter changes if it has its own copy.
- `src/components/sap/SapFieldsDialog.tsx` — Name1 preview, GST-aware ven_class default.
- `src/pages/SAPSync.tsx` — use `getSapName1` for vendor name column; show `ven_class`.
- `src/components/vendor/VendorSubmissionPreviewDialog.tsx` — show NAME1 derived value.

Then redeploy `sync-vendor-to-sap` and `sync-vendors-to-sap-bulk`.

### Out of scope
- No DB schema migration. `registered_contact_1/2` and `registered_email/2` columns already exist.
- No retroactive data backfill for vendors already synced to SAP.
