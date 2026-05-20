
## Goal

In the **Create User** dialog (User Management screen), when the admin enters an email and presses **Enter** (or moves focus away), call the **Tenants From SAP** API with that email. Replace the static tenants checkbox list with the tenants returned by SAP for that email. The admin then picks one or more of those and proceeds to create the user.

## Behavior

1. Admin types an email and presses Enter (or blurs the field).
2. A spinner appears under the Tenants label: "Fetching tenants from SAP…".
3. The dialog calls a new edge function `fetch-tenants-from-sap` with `{ email }`.
4. Edge function looks up the SAP API config named **Tenants From SAP** (already exists, id `142775b2-…`), POSTs `{ email }` to it (using the existing proxy/middleware path used by `sap-master-fetch`), and returns the parsed tenant list.
5. Dialog shows the returned tenants as checkboxes (replacing the static Ramky tenant list). If SAP returns zero tenants, show "No tenants returned by SAP for this email."
6. On submit, the selected SAP tenant codes/names are matched (or created) against the local `tenants` table so `tenant_ids` can be sent to `admin-create-user` as before.

## Files to change / add

- **`supabase/functions/fetch-tenants-from-sap/index.ts`** (new)
  - Auth check, CORS, accepts `{ email }`.
  - Loads `sap_api_configs` row where `name = 'Tenants From SAP'` and `is_active`.
  - Reuses the same proxy/direct call pattern as `sap-master-fetch` (calls middleware `/sap/proxy` with `x-middleware-key`, body `{ url, method: 'POST', headers, body: { email }, useBasicAuth }`).
  - Returns `{ success, tenants: [{ code, name, raw }] }`.
  - Response parsing: returns the raw SAP payload too so we can adjust mapping once SAP's exact field names are known (user didn't specify). First pass will try common keys (`TENANTS`, `tenants`, `data`, top-level array) and map `BUKRS/CODE/Code` → `code`, `BUTXT/NAME/Name` → `name`.

- **`src/components/admin/CreateUserDialog.tsx`** (edit)
  - Add state: `sapTenants`, `fetchingSap`, `sapError`, `sapFetched`.
  - Add `onKeyDown` (Enter) and `onBlur` on the email input → `fetchSapTenants(email)`.
  - Replace the `{tenants.map(...)}` block with a block driven by `sapTenants` when `sapFetched`, otherwise an instruction text "Enter email and press Enter to load tenants from SAP." While `fetchingSap`, show a spinner row.
  - Each checkbox stores the SAP code; on submit, resolve SAP codes → local `tenants.id` (insert any missing rows into `tenants` via a small RPC or via `admin-create-user` itself — see note below).

- **`supabase/functions/admin-create-user/index.ts`** (edit, small)
  - Accept an optional `sap_tenants: [{ code, name }]` array. For each, upsert into `public.tenants` (by `sap_code` or `name`) and add resulting ids to `tenant_ids` before assigning to the user. This avoids requiring the admin to pre-create tenants.

- **`supabase/config.toml`** — no change (functions deploy with `verify_jwt = false`; auth is enforced in code).

## Open item to confirm after first run

SAP response shape for "Tenants From SAP" was not provided. The edge function will return `raw_sap_response` alongside the parsed tenants so we can inspect logs and tighten the mapping in a follow-up if SAP uses non-standard field names.

## Out of scope

- No change to existing tenant table schema beyond an optional `sap_code` column if not already present (will be added via migration only if needed after inspecting the SAP response).
- No change to other dialogs or to the static tenants list shown elsewhere (e.g. on User Management filters).
