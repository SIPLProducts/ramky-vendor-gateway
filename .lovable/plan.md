## Two issues, one plan

### Issue 1 — 403 "Edge Function returned non-2xx" on Sync to SAP

**Root cause:** `supabase/functions/sync-vendor-to-sap/index.ts` gates access with
`requireAuthenticatedUser(req, ['admin', 'sharvi_admin', 'customer_admin', 'finance'])`.
The logged-in user `sunil` ([sunilakula243@gmail.com](mailto:sunilakula243@gmail.com)) has base role `approver` and the **SAP Team** custom role. The shared auth helper only loads base roles from `user_roles`, so SAP Team members are rejected with 403 before the payload is ever built. That is exactly the error shown in the popup.

**Fix:**

1. Extend `supabase/functions/_shared/auth.ts` to also load the user's custom-role names from `user_custom_roles` joined with `custom_roles`, and merge them into the returned `roles` array.
2. Add `'SAP Team'` to the allowlist in `sync-vendor-to-sap/index.ts` (and to `sap-api-test-connection` for parity).
3. Deploy both edge functions and re-test as sunil with `supabase--curl_edge_functions` to confirm the 403 is gone.

### Issue 2 — SAP payload contains hardcoded values instead of dynamic data

**Today** `buildPayload` in the edge function and `buildDefaults` in `SapFieldsDialog.tsx` hardcode `partn_grp=ZDOM`, `title=0003`, `taxtype=IN3`, `bukrs=1000`, `akont=155000005`, `zuawa=014`, `fdgrv=A1`, `vkorg=1000`, `waers=INR`, `kalsk=L1`, `cdi=X`, `webre=X`, `lebre=X`, etc. The vendor row never drives them, and there is no per-tenant override.

**Fix:**

1. **DB migration** — create `public.sap_default_fields` keyed by `tenant_id` with text columns: `partn_cat, partn_grp, title, taxtype, bukrs, akont, zuawa, fdgrv, vkorg, waers, kalsk, cdi, webre, lebre, ven_class`. Enable RLS: `select` for any authenticated user belonging to the tenant; `insert/update/delete` only for `sharvi_admin` / `customer_admin`. Seed one row for the existing tenant matching today's constants so behaviour is unchanged on day one.
2. **Edge function `sync-vendor-to-sap**`
  - Load the tenant's `sap_default_fields` row using the vendor's `tenant_id`.
  - Initialise every previously hardcoded field in `buildPayload` from that row (fall back to `""` if missing).
  - Map `idnum` from `vendor.msme_number` when MSME, else `""`.
  - `name2` → `vendor.relative_name` (S/o, W/o, D/o) — see step 4 — instead of `trade_name`.
  - `accountholder` / `bankaccountname` → `vendor.account_holder_name` (see step 4) instead of legal_name / bank_name.
  - `CLASSIFY` defaults filled from vendor data:
    - `MGV` ← first `vendor.product_categories[0]`
    - `CATV` ← `vendor.organization_type` (or `entity_type`)
    - `LOCV` ← `vendor.registered_state`
    - `IDS` ← blank (still editable in dialog)
  - `overrides` from the dialog continue to win on top of these defaults.
3. **Dialog `SapFieldsDialog.tsx**`
  - Fetch `sap_default_fields` for the vendor's tenant on open and use it to populate `buildDefaults`. Fall back to today's literals only if no row exists.
  - Add `idnum` and `idtype` fields back (read-only when `msme === 'MIC'`, prefilled from `vendor.msme_number`).
4. **DB migration — extend `vendors**`
  - Add nullable `relative_name text` and `account_holder_name text` columns (after verifying they don't already exist).
  - No backfill needed; both default to `""` in payload when null.
5. **Skip the admin UI for editing tenant SAP defaults** for now (you can ask later). Seeded row matches today's behaviour, so nothing visibly changes for existing tenants until they edit the row.

### Verification after edits

- Call `sync-vendor-to-sap` via `supabase--curl_edge_functions` as the logged-in preview user (sunil) for vendor `a0a0b224-d741-4911-8b89-ee36e5e0003b`; expect no more 403 and a SAP/middleware response in the body.
- Read back `sap_default_fields` and confirm the seeded row exists.
- Inspect edge function logs to confirm the outgoing payload now contains the resolved (not hardcoded) values for the test vendor.

### Out of scope (call out)

- Per-tenant admin screen to edit `sap_default_fields` — easy follow-up.
- Re-mapping `bank_key` (currently IFSC) vs the SAP spec example showing it blank — leaving IFSC mapping as-is since that's correct for Indian SAP setups; tell me if you want it forced blank.