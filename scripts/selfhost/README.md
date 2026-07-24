# Self-host deploy — fixing the “migrations not reflecting” problem

These two scripts fix the issue you hit on `10.200.1.7`:

```
ERROR: must be owner of function update_updated_at_column
```

…and the fact that `docker compose restart functions` alone does NOT pick up
new edge-function code or new frontend bundles.

---

## What was wrong

1. The migration runner was connecting as `postgres`, but
   `public.update_updated_at_column()` was created by `supabase_admin`
   (the role the official Supabase docker stack uses for the `public` schema).
   `CREATE OR REPLACE FUNCTION` therefore failed with “must be owner”.
2. Because that migration aborted, every later migration was skipped —
   including the new `seed_vendor_approval_progress()` that routes vendor
   submissions to Buyer → SCM → Finance. Vendors stayed stuck.
3. Edge functions only update when you `rsync` the new sources into
   `backend/volumes/functions/` and THEN restart the `functions` container.
4. The frontend only updates when the new `dist/` is copied into the nginx
   root (`/opt/Ramky_Applications/DEV/VMS/frontend/dist/`) and nginx is
   reloaded — that’s why your UI still showed the “Skip Buyer Approval”
   column even after `docker compose down/up`.

---

## One-time install on the server

```bash
sudo mkdir -p /opt/Ramky_Applications/DEV/VMS/backend/migrations
sudo cp scripts/selfhost/run-migrations.sh /opt/Ramky_Applications/DEV/VMS/run-migrations.sh
sudo chmod +x /opt/Ramky_Applications/DEV/VMS/run-migrations.sh
```

---

## Every time you pull new code

From a checkout of the latest repo on the server (or scp the repo across),
run:

```bash
sudo bash scripts/selfhost/deploy-latest.sh
```

That single command will:

1. Copy `supabase/migrations/*.sql` into `backend/migrations/`
2. Run them as `supabase_admin` (fixes the ownership error)
3. Copy `supabase/functions/` into `backend/volumes/functions/`
4. Restart the `functions` container
5. `npm run build` and copy `dist/` into the nginx root
6. Reload nginx
7. Re-seed `vendor_approval_progress` for any vendor that submitted but has
   no approval chain yet (this is what makes the request show up in the
   Buyer / SCM / Finance approval screens)
8. `NOTIFY pgrst, 'reload schema'` so PostgREST sees new tables/columns

Flags if you want to skip steps:

```bash
sudo bash scripts/selfhost/deploy-latest.sh --skip-build       # reuse existing dist/
sudo bash scripts/selfhost/deploy-latest.sh --skip-migrations  # only redeploy code
sudo bash scripts/selfhost/deploy-latest.sh --skip-functions
sudo bash scripts/selfhost/deploy-latest.sh --skip-frontend
```

---

## Diagnosing `InvalidWorkerCreation: could not find an appropriate entrypoint`

This error means the self-host functions runtime cannot see the function folder
or the required `index.ts` entrypoint inside the mounted functions volume.

Run this on the server from the latest repo checkout:

```bash
sudo APP_ROOT=/opt/Ramky_Applications/PROD/VMS bash scripts/selfhost/diagnose-functions.sh
```

For DEV, change `APP_ROOT` to `/opt/Ramky_Applications/DEV/VMS`.

The diagnostic checks:

1. `backend/volumes/functions/main/index.ts` — the self-host router
2. `backend/volumes/functions/upload-vendor-document/index.ts`
3. `backend/volumes/functions/kyc-api-execute/index.ts`
4. Whether the same files are visible inside the `functions` container
5. Recent runtime logs for entrypoint errors

To repair the functions volume and recreate the runtime container:

```bash
sudo APP_ROOT=/opt/Ramky_Applications/PROD/VMS bash scripts/selfhost/deploy-latest.sh --skip-build --skip-migrations --skip-frontend
```

---

## Just fix the migration error, nothing else

```bash
sudo bash /opt/Ramky_Applications/DEV/VMS/run-migrations.sh
```

The first thing it does is re-own `update_updated_at_column()` to
`supabase_admin`, so the failing migration will now succeed and every
migration after it will apply.

---

## Verifying the vendor request reaches the buyer

After running `deploy-latest.sh`, in Studio SQL editor (or psql):

```sql
-- 1. Did the latest routing migration apply?
SELECT filename FROM public._vms_migrations
WHERE filename LIKE '20260602115254%';

-- 2. For your specific vendor ref, is there an approval chain?
SELECT level_number, stage, status
FROM public.vendor_approval_progress
WHERE vendor_id = '<vendor-uuid>'
ORDER BY level_number;

-- 3. Is the buyer mapped to an SCM CO in that tenant?
SELECT * FROM public.buyer_scm_mappings
WHERE buyer_user_id = '<buyer-uuid>';
```

The first pending row’s `stage` should be `BUYER` — that’s why the request
appears on the Buyer’s screen. After the Buyer approves, the next row
(`SCM_MANAGER`) becomes pending and the SCM CO screen lights up.
