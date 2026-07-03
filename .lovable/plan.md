## Problem

International Vendor → Company Details → Country and Region dropdowns render empty even though `sap_master_data` holds 245 country rows and 1583 region rows.

Root cause: the `public.sap_master_data` table has RLS policies (including "Authenticated users can read SAP master data" → `USING (true)`) but **no table-level GRANT** to `authenticated` / `service_role`. Supabase's Data API (PostgREST) requires an explicit GRANT — RLS alone is not enough — so every `select` from the client returns zero rows and the dropdowns fall back to "empty". This also silently affects every other consumer of that table (Classification F4, SAP Sync popup fallback, etc.).

Confirmed via `information_schema.role_table_grants` — the table has zero grants.

## Fix

### Single migration — add missing grants on `public.sap_master_data`

```sql
GRANT SELECT ON public.sap_master_data TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.sap_master_data TO authenticated;  -- admin CRUD is already gated by existing RLS policies
GRANT ALL ON public.sap_master_data TO service_role;                       -- edge functions (sap-master-fetch) write here
```

No policy changes, no schema changes. The existing policies already limit writes to admin roles; the grants just let PostgREST forward the request to Postgres so RLS can evaluate.

### No code changes required

- Country label already renders as `LAND1 — LANDX` (e.g. `IN — India`) via `{c.code} — {c.description}`.
- Region label already renders as `BLAND — BEZEI` (e.g. `13 — Maharashtra`) and is filtered by selected country via `extra.LAND1`.
- SAP payload already sends `country = LAND1` and `region = BLAND` (matches the requested `"country": "IN", "region": "13"` shape).

## Verification

After the migration runs:
1. Open International vendor registration → Company Details step.
2. Country dropdown shows the full SAP country list (LAND1 — LANDX).
3. Selecting a country enables Region and shows only that country's regions (BLAND — BEZEI).
4. On SAP sync, the built payload contains `"country": "<LAND1>"` and `"region": "<BLAND>"` as before.

## Files touched

```text
supabase migration — GRANTs on public.sap_master_data (no code files)
```
