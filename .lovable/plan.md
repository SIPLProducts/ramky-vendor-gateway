## Problem

When a vendor is submitted as **International**, the approval routing still treats them as MSME-registered, so after Finance 2 approval they get routed to the **CEO Office** stage instead of going directly to **SAP Sync**.

International vendors should bypass the MSME-gated CEO stage entirely (treated as MSME = No for routing purposes), regardless of what was filled in `is_msme_registered`.

## Root cause

Two places decide which approval stages are eligible based on `is_msme_registered`:

1. **DB function** `public.seed_vendor_approval_progress(_vendor_id)` — runs at submission time and seeds the approval chain.
2. **Edge function** `supabase/functions/process-approval-action/index.ts` — runs the auto-extend block when new matrix levels are added after submission.

Both read `vendors.is_msme_registered` only. Neither considers `vendors.vendor_type = 'international'`.

## Changes

### 1. Migration: update `seed_vendor_approval_progress`

Change the MSME read so international vendors are forced to non-MSME:

```sql
SELECT tenant_id,
       CASE WHEN COALESCE(vendor_type, 'domestic') = 'international'
            THEN false
            ELSE COALESCE(is_msme_registered, false)
       END
  INTO v_tenant, v_msme
FROM public.vendors WHERE id = _vendor_id;
```

Rest of the function is unchanged. The existing filter `(l.requires_msme = false OR v_msme = true)` will then exclude CEO_OFFICE for international vendors.

### 2. `supabase/functions/process-approval-action/index.ts` (lines ~135–137)

Also select `vendor_type` and derive `isMsme` the same way:

```ts
const { data: vendorRow } = await admin
  .from('vendors')
  .select('is_msme_registered, vendor_type')
  .eq('id', progress.vendor_id).single();
const isMsme = vendorRow?.vendor_type === 'international'
  ? false
  : !!vendorRow?.is_msme_registered;
```

So when Finance 2 approves an international vendor and the function looks for the next pending level, CEO_OFFICE is filtered out and the vendor proceeds straight to SAP sync.

### 3. Finance 2 UI note (optional, `src/pages/approvals/Finance2Approval.tsx`)

The extra panel currently shows "MSME registered: Yes — will route to CEO Office" based on `item.isMsme`. For international vendors, override the label to **"International vendor — will route to SAP Sync"** so the approver isn't misled.

## Out of scope

- No change to MSME registration capture in the registration form.
- No change to the Finance 2 stage itself or rejection paths.
- Existing already-seeded vendors are unaffected unless re-routed; this fix applies to new submissions and to auto-extend after the migration.

## Verification

1. Submit a new vendor as **International** with MSME = Yes.
2. Approve through SCM Manager → SCM Head → Finance 1 → Finance 2.
3. After Finance 2 approval, vendor status should become **SAP Sync** (not CEO Office), and no CEO_OFFICE row should exist in `vendor_approval_progress`.
4. Repeat with a **Domestic + MSME** vendor → CEO Office stage still appears (regression check).
