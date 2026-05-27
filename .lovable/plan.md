## Why classification fails while tenants work

Both edge functions hit `${middleware_url}/sap/proxy` with the same logic. The difference is which `sap_api_configs` row they pick.

- `fetch-tenants-from-sap` deterministically loads the row named **`Tenants From SAP`** → its own `middleware_url` (currently a working ngrok / `10.200.1.7`).
- `sap-master-fetch` picks the first active row whose name matches `/f4|master/i`. In your DB there are **two** matches:
  - `SAP Fields F4` (GET, ngrok `curfew-thinning-shadow…`)
  - `Classification F4s` (PUT, ngrok `curfew-thinning-shadow…`)

  So the function may grab the wrong row, send GET against a PUT-only endpoint (or vice-versa), or hit a middleware URL that's no longer live. Classification dropdowns (`MAT_GRP_VENDOR`, `CAT_VENDOR`, `LOCATION_VENDOR`, `IDENTIFICATION_SOURCE`) therefore fail while `Tenants From SAP` keeps working.

Each config already carries its own `middleware_url`, so this works for both Lovable Cloud (ngrok) and self-host (`10.200.1.7`) without any path or nginx change — we just have to pick the right row.

## Fix (edge function only, no DB, no frontend, no nginx changes)

### 1. `supabase/functions/sap-master-fetch/index.ts`

Replace the regex-based `findConfig` with deterministic, name-based lookup per master-type group:

- Classification group → row named **`Classification F4s`**
  Master types: `material_group_vendor`, `vendor_category`, `vendor_location`, `identification_source`.
- General F4 group → row named **`SAP Fields F4`**
  All other master types in `MASTER_MAP` (vendor account group, company code, planning group, recon account, purchase org, currency, country, region).

Behaviour:

1. Look at `body.master_type` / `body.master_types`. If any requested type belongs to the classification group, fetch using `Classification F4s`; if any belongs to the general group, fetch using `SAP Fields F4`. If both groups are requested (or no specific type), run **both** configs sequentially and merge `summary` + `sap_response`.
2. For each chosen config: use that row's own `base_url`, `endpoint_path`, `http_method`, `connection_mode`, `middleware_url`, `proxy_secret`, credentials — i.e. exactly the same per-config flow `fetch-tenants-from-sap` already uses.
3. Fall back to the previous regex behaviour only if the named row is missing, so existing single-config setups keep working.
4. Error messages should name the config that failed (e.g. `SAP Fields F4: middleware HTTP 502 …`) so we can tell which one is misconfigured.

No signature change for callers (`useSapMasterData`, `useRefreshSapMaster` keep invoking `sap-master-fetch` with `{ master_type }` / `{}`).

### 2. No changes to

- Frontend hooks/components.
- `fetch-tenants-from-sap` or any other SAP function.
- Database rows, RLS, or nginx/middleware routing.
- Self-host deployment scripts.

## Why this is safe

- Same proxy URL shape (`${middleware_url}/sap/proxy`) as today and as the working tenant API — no `/api` vs `/sap` divergence.
- Each config row already stores the correct `middleware_url` for its environment, so Lovable Cloud and self-host both keep working with their existing rows.
- Other functionality (vendor create, document upload, tenant fetch, sync) untouched — they each load their own named config and are unaffected.

## Deployment

- Lovable Cloud: auto-deploys on save.
- Self-host `10.200.1.7`: re-run `scripts/deploy-vms-server.sh --skip-docker --skip-migrations` (or rsync `supabase/functions/sap-master-fetch` + `docker compose restart functions`) so the self-hosted Supabase picks up the new function.

## Follow-up (optional, only if user wants)

Once this lands, we can also surface in SAP API Settings which config row each feature uses (Tenants / Classification / General F4 / Vendor Create / Documents) so future name changes can't silently break a feature.