## Problem

The success popup shows `5E8222AA` (first 8 chars of the vendor UUID) instead of the daily-sequence reference like `20260609001`.

The DB trigger `assign_vendor_reference_number` already populates `vendors.reference_number` in the correct `YYYYMMDD###` format on insert (IST, resets daily). The bug is only in the notification edge function: it ignores that column and synthesizes a reference from the UUID.

```ts
// supabase/functions/notify-vendor-submission/index.ts:292
const vendorRef = vendor.id.replace(/-/g, "").slice(0, 8).toUpperCase();
```

That `vendorRef` is what the dialog renders as "# 5E8222AA" and what the buyer notification email shows as "Vendor Reference".

## Fix

Edit `supabase/functions/notify-vendor-submission/index.ts`:

1. Add `reference_number` to the vendor `.select(...)` on line 100.
2. Replace the UUID-slice line with:
   ```ts
   const vendorRef = (vendor as any).reference_number
     || vendor.id.replace(/-/g, "").slice(0, 8).toUpperCase();
   ```
   The fallback only kicks in for legacy rows missing the column; new submissions always have it.

That single change fixes both:
- the "Application Submitted Successfully" popup (`vendorIdentity.vendorRef`)
- the "Vendor Reference" row in the buyer notification email

## Scope notes

- No DB / migration changes — the trigger and `vendor_reference_counters` table are already in place from the earlier migration and were reset during the wipe.
- The "Create Invitation" flow does not produce a reference number by itself; the reference is assigned only when the vendor row is created during registration (either direct or invite-based). Both paths go through the same insert + trigger, so this one fix covers both.
- `SuccessScreen.tsx` already prefers `referenceNumber` when provided, so no UI changes needed there.
