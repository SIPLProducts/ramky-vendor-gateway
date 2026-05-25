## Goal

Produce a single SQL seed file containing the **KYC & Validation API Settings** data (providers + credentials + validation configs, **including live tokens**) from Lovable Cloud, so you can load it into the self-hosted Supabase with one `psql` command.

## Tables included

- `public.api_providers` — full row (endpoint, request template, response mapping, flags)
- `public.api_credentials` — full row, **including `credential_value` (real tokens)**
- `public.validation_configs` — orchestrator settings

## What I'll do (in build mode)

1. Query the three tables from cloud (`supabase--read_query`).
2. Generate `kyc-config.sql` with:
   - `BEGIN;`
   - `TRUNCATE public.api_credentials, public.validation_configs, public.api_providers RESTART IDENTITY CASCADE;`
   - One `INSERT ... VALUES (...);` per row, all columns explicit, JSONB cast as `'...'::jsonb`, timestamps as text, NULLs preserved
   - `COMMIT;`
3. Save to `/mnt/documents/kyc-config.sql` and surface it as a downloadable artifact.
4. Print row counts in chat so you can verify before running.

**Nothing else changes** — no edits to scripts, edge functions, React, or `setup-selfhost.sh`.

## How you'll use the file on your server

```text
# 1. copy the file to the server
scp kyc-config.sql root@server:/tmp/

# 2. load into the self-hosted Postgres container
docker exec -i supabase-db psql -U postgres -d postgres < /tmp/kyc-config.sql

# 3. (or) if you run psql on the host
PGPASSWORD='<POSTGRES_PASSWORD from .env.secrets>' \
  psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -f /tmp/kyc-config.sql
```

After loading, open `http://<server>/admin/kyc-api-settings` — same providers and tokens as cloud.

## Security note

The file contains real API tokens in plain text. Keep it out of git, transfer over SSH only, and delete from `/tmp` after loading.