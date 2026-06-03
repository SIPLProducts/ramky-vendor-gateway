## Root cause

The browser sends a PATCH to `/rest/v1/vendors` that includes `msme_enterprise_name` (and `msme_major_activity`). PostgREST on the self-hosted server replies with `PGRST204 — Could not find the 'msme_enterprise_name' column of 'vendors' in the schema cache`.

These two columns were added in cloud by migration `supabase/migrations/20260602093746_ed6aee96-460b-44da-b30b-aa308435bd91.sql`:

```
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS msme_enterprise_name text,
  ADD COLUMN IF NOT EXISTS msme_major_activity text;
```

On the self-hosted box one of two things is true:
1. The deploy script (`scripts/lib/30-migrations.sh`) was not re-run after that migration was added, so the columns do not exist on the self-host Postgres; **or**
2. The columns exist but PostgREST's schema cache was never reloaded, so it still rejects the field.

Either way, the cure is the same: re-run migrations on the self-host AND tell PostgREST to refresh its schema cache. Nothing in the frontend is wrong — the column is legitimately part of the schema.

## Fix (no behaviour changes)

1. **Add a new idempotent migration** `supabase/migrations/20260603<ts>_ensure_msme_columns_and_reload.sql` that:
   - Re-asserts both columns with `ADD COLUMN IF NOT EXISTS` (safe no-op on cloud, fixes self-host if step 1 was skipped).
   - Issues `NOTIFY pgrst, 'reload schema';` so PostgREST picks the columns up immediately without restarting the stack.

   This is purely additive — no data touched, no RLS / GRANT changes, no other tables affected.

2. **Self-host action** the user runs once on the VM (documented in the chat reply, not a code change):
   - Re-run the deploy script (or just `bash scripts/lib/30-migrations.sh`) so the new migration is applied.
   - Equivalent manual one-liner if they don't want to redeploy:
     ```
     docker compose -f <backend>/docker-compose.yml exec -T db \
       psql -U postgres -d postgres -c \
       "ALTER TABLE public.vendors
          ADD COLUMN IF NOT EXISTS msme_enterprise_name text,
          ADD COLUMN IF NOT EXISTS msme_major_activity text;
        NOTIFY pgrst, 'reload schema';"
     ```

## Out of scope

- No frontend changes — the PATCH payload is correct.
- No edge function, RLS, GRANT, or other schema changes.
- No cloud impact (migration is idempotent; cloud already has these columns).

## Verification

After running migrations on self-host, reload the Vendor Registration page and click Continue to PAN / MSME — the PATCH to `/rest/v1/vendors` should return `204` instead of `400 PGRST204`, and the "Error Saving Data" toast should disappear.
