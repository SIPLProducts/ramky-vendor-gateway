# Fix: On-behalf vendors not seeding SCM Manager queue

## What the screenshots prove

1. `seed_vendor_approval_progress('e5d1cfa9…')` → returned `6, scm_manager_review`. Vendor `20260619002` will now appear in Soumendukumar's SCM Manager queue. Refresh the page to confirm.
2. The 6 levels are correctly seeded: BUYER approved (on-behalf auto), then SCM_MANAGER / SCM_HEAD / FINANCE_1 / FINANCE_2 / CEO_OFFICE all pending.

So the seeding logic itself works perfectly. The on-behalf flag was read correctly (BUYER level was auto-approved). The problem was only that **the seeder was never called for this vendor when it was created**.

## Root cause

`SELECT … FROM pg_trigger WHERE tgname = 'trg_vendors_seed_approval'` returned **0 rows** on your self-hosted DB.

The trigger function `public.trg_vendors_seed_approval()` exists (it's in your DB functions list), but the trigger **binding** that fires it on `vendors` INSERT/UPDATE was never installed on the self-hosted server. On Lovable Cloud it was created by a migration; on your self-host that migration either didn't run, or was dropped.

That's why:
- Every new vendor on the self-host comes in with `status = scm_manager_review` (set by the create-vendor edge function), but **no rows** are inserted into `vendor_approval_progress`.
- All review queues (SCM Manager, SCM Head, Finance 1/2, CEO Office) filter on `vendor_approval_progress`, so the vendor is invisible everywhere except the "All Vendors" list, which reads `vendors.status` directly.
- The orphan query returned 0 rows now only because vendor `20260619002` is the only one you've tested in this state — every future on-behalf or normal vendor will reproduce the bug until the trigger is installed.

## Fix plan

### Step 1 — Install the missing trigger (one-time, self-host only)

Run on the self-hosted Postgres (psql / SQL editor):

```sql
DROP TRIGGER IF EXISTS trg_vendors_seed_approval ON public.vendors;

CREATE TRIGGER trg_vendors_seed_approval
AFTER INSERT OR UPDATE OF status ON public.vendors
FOR EACH ROW
EXECUTE FUNCTION public.trg_vendors_seed_approval();
```

Verify:

```sql
SELECT tgname, tgrelid::regclass, pg_get_triggerdef(oid)
FROM pg_trigger
WHERE tgname = 'trg_vendors_seed_approval';
```

Expect **1 row** showing the trigger bound to `public.vendors`.

### Step 2 — Backfill any other orphans

Already run; returned 0. Re-run after a few new vendors are created to make sure the trigger is now firing:

```sql
SELECT v.id, v.reference_number, v.legal_name, v.status
FROM public.vendors v
LEFT JOIN public.vendor_approval_progress p ON p.vendor_id = v.id
WHERE v.status IN ('buyer_review','scm_manager_review','scm_head_review',
                   'finance_1_review','finance_2_review','ceo_office_review')
  AND p.id IS NULL;
```

If any rows appear, seed them: `SELECT public.seed_vendor_approval_progress('<id>');`

### Step 3 — End-to-end test

1. Buyer logs in → "Create Vendor on behalf" → submit a fresh vendor.
2. Run the orphan query → must return 0 rows.
3. Inspect the new vendor's `vendor_approval_progress`: BUYER should be `approved` (auto, on-behalf), SCM_MANAGER `pending`.
4. Log in as the SCM Manager mapped to that buyer in `buyer_approval_flows` → the vendor must appear in the queue.

## Why on-behalf "looked broken"

It wasn't the on-behalf branch — that branch only runs **inside** `seed_vendor_approval_progress` (the `IF v_on_behalf THEN auto-approve BUYER`). Since the seeder was never invoked, neither the BUYER auto-approve nor the SCM_MANAGER pending row was ever created, which made it look like on-behalf routing was failing. Once Step 1 installs the trigger, on-behalf will route to SCM Manager correctly for every new vendor.

## No app code changes

This is purely a DB trigger installation on the self-hosted server. The `src/` codebase already calls the seeder via the trigger; nothing in the React/edge-function code needs to change.
