## Goal

Export all SAP API Settings data from Lovable Cloud as a runnable SQL seed script, so you can apply it on the self-hosted Postgres (10.200.1.7) — same pattern used for KYC.

## What gets exported

All 4 SAP config tables, in dependency order:

1. `public.sap_api_configs` — 5 rows (Create vendor in SAP, SAP Fields F4, Documents Uploading, Classification F4s, Tenants From SAP)
2. `public.sap_api_credentials` — username + password per config
3. `public.sap_api_request_fields` — request payload field mappings
4. `public.sap_api_response_fields` — response field mappings

## Output

A single file: `scripts/seed-sap-api-settings.sql`

Contents:
- `BEGIN;` … `COMMIT;` wrapper
- One `INSERT … ON CONFLICT (id) DO UPDATE SET …` per row for `sap_api_configs` (idempotent — safe to re-run, will refresh values if rows already exist)
- `DELETE FROM sap_api_request_fields WHERE config_id IN (...); INSERT …` for request/response fields (full replace per config, matches `useReplaceSapRequestFields` semantics)
- `INSERT … ON CONFLICT (config_id) DO UPDATE` for credentials

All real UUIDs, URLs, middleware URL (`https://curfew-thinning-shadow.ngrok-free.dev`), proxy secrets, and credentials are preserved as-is from the cloud DB.

## How you run it on the server

```bash
psql -h 10.200.1.7 -p 5432 -U postgres -d postgres -f scripts/seed-sap-api-settings.sql
```

(or whatever connection string your self-hosted Supabase Postgres uses — same one you used for the KYC seed)

## Notes

- `created_by` is nulled out on insert (the cloud user UUID won't exist in the self-hosted `auth.users`), avoiding FK violations.
- Script is read-only against your cloud DB — it just generates a `.sql` file. Nothing changes in Lovable Cloud.
- After applying, log in as Sharvi Admin on the self-hosted UI → SAP API Settings → all 5 configs + their field mappings + credentials should appear.

Approve and I'll generate the file.