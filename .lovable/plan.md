## Root cause

On the self-hosted server, the latest migrations that teach the approval engine about the **BUYER** stage (and the related `skip_buyer_stage` / `buyer_scm_mappings` columns) never applied successfully — earlier `update_updated_at_column` ownership error halted the runner, so everything after it was skipped.

Evidence:
- Screenshot 2 shows the vendor sitting at **SCM Manager Review** immediately after submission, with **no BUYER row** ever created. The current `seed_vendor_approval_progress()` in code always inserts a BUYER row at level 1 when an inviting buyer exists. The only way to land directly on SCM_MANAGER is the **old** version of this function (pre-BUYER-stage).
- SCM Manager screen is also empty because `list-pending-approvals-by-stage` now filters SCM_MANAGER through `buyer_scm_mappings` — that table/columns also come from the un-applied migrations, so the filter returns zero.

So: the function code on the self-host DB is stale, the helper table is missing/empty, and the buyer-stage rows are never seeded.

## Fix plan

### 1. Make the migration runner survive the ownership error
Update `scripts/selfhost/run-migrations.sh` so that before applying any file it runs (as `supabase_admin`):

```sql
ALTER FUNCTION public.update_updated_at_column() OWNER TO supabase_admin;
ALTER FUNCTION public.handle_new_user() OWNER TO supabase_admin;
GRANT USAGE ON SCHEMA public TO supabase_admin;
```

and connects with `-U supabase_admin -v ON_ERROR_STOP=1`. This unblocks the failing migration and lets the rest of the chain apply.

### 2. Re-run the full deploy
`sudo bash scripts/selfhost/deploy-latest.sh` from the repo. With step 1 fixed, this will:
- Apply all pending SQL migrations (including `BUYER` stage, `skip_buyer_stage`, `buyer_scm_mappings`, new `seed_vendor_approval_progress`).
- Sync edge functions (`route-vendor-approval`, `list-pending-approvals-by-stage`, `process-approval-action`) into `backend/volumes/functions` and restart the `functions` container.
- Rebuild + redeploy the frontend `dist/`.
- Re-seed `vendor_approval_progress` for any vendor already stuck at `*_review` with no rows.

### 3. Repair the one vendor already stuck (Ashish Shreevas)
That vendor was seeded by the old function, so its chain starts at SCM_MANAGER with no BUYER row. After step 2 finishes, on the self-host DB run:

```sql
SELECT public.seed_vendor_approval_progress('5914bf9f-...'::uuid);
UPDATE public.vendors SET status='buyer_review' WHERE id='5914bf9f-...';
NOTIFY pgrst, 'reload schema';
```

(deploy-latest.sh already loops this for every stuck vendor, but only for those with **zero** progress rows — this vendor has rows from the old seed, so we must delete-then-reseed; the function already does `DELETE FROM vendor_approval_progress WHERE vendor_id = _vendor_id` at the top, so a single RPC call is enough.)

### 4. Verify
On the self-host DB:

```sql
-- a) latest migration is applied
SELECT filename FROM public._vms_migrations ORDER BY filename DESC LIMIT 5;

-- b) BUYER row exists for the stuck vendor
SELECT level_number, stage, status
FROM public.vendor_approval_progress
WHERE vendor_id='5914bf9f-...'
ORDER BY level_number;

-- c) buyer_scm_mappings has the buyer↔SCM link for this tenant
SELECT * FROM public.buyer_scm_mappings WHERE tenant_id='<ramky tenant>';
```

Then refresh the Buyer Approval screen — the vendor should now appear there exactly like on `vms.siplproducts.com`. After buyer approves, it should move to the mapped SCM Manager.

## Files to change

- `scripts/selfhost/run-migrations.sh` — connect as `supabase_admin`, re-own `update_updated_at_column()` / `handle_new_user()` before the loop, keep `ON_ERROR_STOP=1`, keep `_vms_migrations` tracking, end with `NOTIFY pgrst, 'reload schema'`.
- `scripts/selfhost/deploy-latest.sh` — no logic change needed; relies on the fixed runner. (Optionally widen the re-seed loop to also reseed vendors whose **first** pending row is `SCM_MANAGER` while a buyer invitation exists, so vendors stuck by the old seed get healed automatically.)

No application/UI code changes — the bug is purely on the self-host DB + functions sync.