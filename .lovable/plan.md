The screenshot confirms the issue is in the self-host database data/migrations, not the UI.

## What the screenshot means

Your query result shows:

```sql
level_number | stage | status
1            | NULL  | pending
2            | NULL  | pending
3            | NULL  | pending
4            | NULL  | pending
```

This is why the vendor is not visible to Buyer:

- The Buyer approval screen only loads rows where `vendor_approval_progress.stage = 'BUYER'` and `status = 'pending'`.
- On your self-host DB, all `stage` values are `NULL`.
- That means the approval chain was created by the old approval logic or the latest BUYER-stage migration/function was not applied/re-run for this vendor.
- The vendor status showing `SCM Manager Review` also matches this: the BUYER row was never created.

## Immediate verification queries to run on self-host

Run these in the SQL editor on `10.200.1.7`.

### 1. Check whether the BUYER-stage migrations applied

```sql
SELECT filename, applied_at
FROM public._vms_migrations
WHERE filename IN (
  '20260602102818_fdf94cd7-9ad2-4caa-8092-c566459fea6f.sql',
  '20260602115254_6c4b2d19-a882-4371-ac46-180c02f78c13.sql'
)
ORDER BY filename;
```

Expected: both rows should be present.

### 2. Check required columns exist

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'vendor_approval_progress'
  AND column_name IN ('stage', 'level_id')
ORDER BY column_name;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'buyer_scm_mappings'
  AND column_name IN ('skip_buyer_stage', 'include_scm_stages')
ORDER BY column_name;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'vendor_invitations'
  AND column_name = 'created_on_behalf';
```

Expected:
- `vendor_approval_progress.stage` exists
- `vendor_approval_progress.level_id` allows `NULL`
- `buyer_scm_mappings.skip_buyer_stage` exists
- `vendor_invitations.created_on_behalf` exists

### 3. Check the vendor invitation and buyer mapping

```sql
SELECT
  v.id AS vendor_id,
  v.status AS vendor_status,
  v.tenant_id AS vendor_tenant_id,
  vi.created_by AS buyer_user_id,
  vi.tenant_id AS invite_tenant_id,
  row_to_json(vi)->>'created_on_behalf' AS created_on_behalf,
  m.scm_manager_user_id,
  row_to_json(m)->>'skip_buyer_stage' AS skip_buyer_stage,
  row_to_json(m)->>'include_scm_stages' AS include_scm_stages
FROM public.vendors v
LEFT JOIN public.vendor_invitations vi ON vi.vendor_id = v.id
LEFT JOIN public.buyer_scm_mappings m
  ON m.buyer_user_id = vi.created_by
 AND m.tenant_id = COALESCE(vi.tenant_id, v.tenant_id)
WHERE v.id = '5914bf9f-2a0f-4e4b-b0a0-f8c16b128c69'
ORDER BY vi.created_at DESC
LIMIT 5;
```

Expected:
- `buyer_user_id` should not be null
- `scm_manager_user_id` should not be null
- `skip_buyer_stage` should be `false` or null
- If `created_on_behalf = true`, Buyer is auto-approved by design and the vendor goes directly to SCM Manager.

### 4. Check actual approval chain with matrix fallback

```sql
SELECT
  p.level_number,
  p.stage AS raw_progress_stage,
  l.stage AS matrix_stage,
  COALESCE(p.stage, l.stage) AS resolved_stage,
  p.status,
  p.level_id
FROM public.vendor_approval_progress p
LEFT JOIN public.approval_matrix_levels l ON l.id = p.level_id
WHERE p.vendor_id = '5914bf9f-2a0f-4e4b-b0a0-f8c16b128c69'
ORDER BY p.level_number;
```

Expected after repair:

```text
1 | BUYER       | pending
2 | SCM_MANAGER | pending
3 | ...         | pending
```

## Repair steps

### Step 1: Run the fixed self-host deploy script

From the latest repo checkout on the self-host server:

```bash
cd /opt/Ramky_Applications/DEV/VMS/<your-latest-repo-checkout>
sudo cp scripts/selfhost/run-migrations.sh /opt/Ramky_Applications/DEV/VMS/run-migrations.sh
sudo chmod +x /opt/Ramky_Applications/DEV/VMS/run-migrations.sh
sudo bash scripts/selfhost/deploy-latest.sh
```

This applies the missing SQL migrations, syncs edge functions, deploys latest frontend `dist`, and re-seeds stuck approval chains.

### Step 2: Manually re-seed this specific stuck vendor if still needed

After Step 1 finishes, run:

```sql
SELECT *
FROM public.seed_vendor_approval_progress('5914bf9f-2a0f-4e4b-b0a0-f8c16b128c69'::uuid);

NOTIFY pgrst, 'reload schema';
```

Then check again:

```sql
SELECT
  level_number,
  stage,
  status,
  level_id
FROM public.vendor_approval_progress
WHERE vendor_id = '5914bf9f-2a0f-4e4b-b0a0-f8c16b128c69'
ORDER BY level_number;

SELECT id, status
FROM public.vendors
WHERE id = '5914bf9f-2a0f-4e4b-b0a0-f8c16b128c69';
```

Expected:

```text
level_number | stage       | status
1            | BUYER       | pending
2            | SCM_MANAGER | pending
...
```

And vendor status should become:

```text
buyer_review
```

## If the BUYER row still does not appear

Then one of these is true:

1. The vendor has no row in `vendor_invitations`, so the system cannot identify the inviting buyer.
2. `buyer_scm_mappings.skip_buyer_stage = true` for that buyer.
3. `vendor_invitations.created_on_behalf = true`, so Buyer is auto-approved and the vendor correctly moves to SCM Manager.
4. The latest `seed_vendor_approval_progress()` function is still not installed on self-host.

The most important missing piece shown by your screenshot is: existing approval rows have `stage = NULL`; Buyer needs a pending row with `stage = 'BUYER'`.