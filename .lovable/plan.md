# Dynamic SAP Payload Mapping

## Why

Today `supabase/functions/sync-vendor-to-sap/index.ts` builds the SAP request with a hardcoded `buildPayload()` function. Only the keys explicitly listed there (~40 top-level keys + a hardcoded `vendors[]` / `customers[]` / `CLASSIFY` block) are ever sent. Any new SAP key (`zvkorg`, `taxkd01..07`, `bzirk`, `kdgrp`, `ktokk`, etc.) cannot be sent without a code change.

The user wants every key in their reference SAP payload to be sent automatically, and to be able to add/remove/remap keys later without redeploying code.

Note: the `{ vendorId, overrides }` object the user sees in their app's network tab is the request to our edge function — **not** the request to SAP. The edge function expands it into the full SAP body. So the fix is in how the edge function constructs that body.

## Approach

Replace the hardcoded `buildPayload` with a **template-driven** payload builder backed by a new config table. The template stores the full SAP shape (all keys, including nested `customers[]`, `vendors[]`, `CLASSIFY.*[]`, `UPLOAD[]`), and each leaf value is either:

- a constant (e.g. `"IN"`, `"EN"`, `"0001"`),
- a vendor-column reference (e.g. `{{vendor.legal_name|trunc:40}}`),
- a derived value (e.g. `{{region(vendor.registered_state)}}`, `{{msme_flag}}`, `{{uploads}}`),
- or an override reference (e.g. `{{override.partn_grp}}`, `{{override.classify.MGV}}`).

The edge function loads the template, walks it, and resolves each placeholder. Anything unresolved stays as `""` (matches today's SAP spec behavior).

## Changes

### 1. New table `sap_payload_templates`

```text
id uuid pk
tenant_id uuid (nullable = global default)
name text
template jsonb            -- the full SAP payload shape with placeholders
is_active boolean
created_at / updated_at
```

Seed one row containing the **complete reference payload** the user shared (all ~100 top-level keys + `customers[]`, `vendors[]`, `CLASSIFY.*`, `UPLOAD[]`) with placeholders pre-filled to today's behavior, e.g.:

```json
{
  "bpartner": "",
  "partn_cat": "{{override.partn_cat|default:2}}",
  "name1":   "{{vendor.legal_name|trunc:40}}",
  "region":  "{{region(vendor.registered_state)}}",
  "taxnumxl":"{{vendor.gstin|trunc:20}}",
  "...": "...",
  "zvkorg": "", "vtweg": "", "spart": "", "bzirk": "",
  "taxkd01": "", "...": "",
  "customers": [ { "kunnr": "", "...": "" } ],
  "vendors":   [ { "lifnr": "", "partn_cat": "{{override.partn_cat}}", "...": "" } ],
  "CLASSIFY": {
    "MAT_GRP_VENDOR":       [ { "MGV":  "{{override.classify.MGV|upper}}"  } ],
    "CAT_VENDOR":           [ { "CATV": "{{override.classify.CATV|upper}}" } ],
    "LOCATION_VENDOR":      [ { "LOCV": "{{override.classify.LOCV|upper}}" } ],
    "IDENTIFICATION_SOURCE":[ { "IDS":  "{{override.classify.IDS|upper}}"  } ]
  },
  "UPLOAD": "{{uploads}}"
}
```

RLS: read for `admin / sharvi_admin / customer_admin / SAP Team`; write for `admin / sharvi_admin`.

### 2. Edge function rewrite — `sync-vendor-to-sap/index.ts`

- Remove hardcoded `buildPayload` body (keep the function signature).
- Add a `resolveTemplate(template, ctx)` walker that:
  - recursively traverses arrays/objects,
  - replaces `"{{...}}"` strings with resolved values,
  - supports filters: `trunc:N`, `upper`, `lower`, `default:X`, `bool_x`,
  - supports helpers: `region(...)`, `msme_flag`, `msme_idtype`, `msme_idnum`, `uploads`.
- `ctx` exposes `vendor` (full row), `override` (the request body's overrides object, including `classify`), and tenant defaults from `sap_default_fields` as fallbacks.
- Load template by tenant → fallback to global default. If none exists, fall back to today's hardcoded shape (so nothing breaks during rollout).
- Keep all existing pre-validation (state→region check), upload building, middleware/proxy logic, and response handling untouched.

### 3. Frontend — `SapFieldsDialog.tsx`

- No structural change; it still collects the same human-friendly overrides (partn_cat, msme, classify.*, etc.).
- The `SapFieldOverrides` type stays the same and is sent through as `overrides` — the template references it via `{{override.*}}`.
- Optional: surface a small "Advanced — view full SAP payload" preview using a new `preview-sap-payload` edge call (out of scope for this iteration unless desired).

### 4. Admin UI — new page `SAP Payload Template` (under SAP API Settings)

- Monaco/textarea JSON editor bound to `sap_payload_templates.template`.
- "Reset to default" button that reloads the seeded reference template.
- "Test render" button: pick a vendor, render the resolved JSON in a read-only viewer so admins can confirm what will be sent.
- Save → upserts the row for the current tenant.

## Result

- Every key present in the template is sent to SAP, even if blank — matching the user's 100-key reference payload exactly.
- Adding a new SAP key (e.g. `zterm2`) becomes a JSON edit in the admin UI, no code change.
- `overrides.classify.LOCV = "Andhra Pradesh"` will be auto-uppercased to `"ANDHRA PRADESH"` via the `|upper` filter, and `MGV/CATV/IDS` will pull from `vendor.material_group_vendor / vendor_category / identification_source` (already added) when the override is blank.

## Out of scope

- Changing the middleware contract.
- Schema changes to `vendors` (the four classification columns already exist).
- Reworking document upload encoding.
