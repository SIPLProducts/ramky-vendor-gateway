## Root cause

The SAP Sync dialog's Confirm handler already sends the correct `classify` override — e.g., in `cfstmt` mode it sets `CATV: []`, `MGV: []`, `IDS: []` (and vice versa for `details` mode).

However, the payload construction in three places treats an empty override array as "not provided" and falls back to the vendor DB row. That's why `CAT_VENDOR` (and friends) still appear in the outgoing SAP payload even after selecting Vendor_CFSTMT.

Current logic pattern (all three sites):
```ts
CATV: toArr(ovClassify.CATV).length
  ? toArr(ovClassify.CATV)
  : toArr(vendor.vendor_categories)   // ← runs even when caller sent []
```

## Fix

Treat `overrides.classify` (or `row.classify` in the bulk edge function) as authoritative **when the key exists on that object** — even if the array is empty. Only fall back to the vendor row when no `classify` object was supplied at all (legacy/direct API callers).

Per site, add:
```ts
const hasClassifyOverride =
  overrides && typeof overrides.classify === 'object' && overrides.classify !== null;
const hasOv = (k: string) =>
  hasClassifyOverride && Object.prototype.hasOwnProperty.call(overrides.classify, k);

MGV:  hasOv('MGV')  ? toArr(ovClassify.MGV)  : <existing vendor fallback>,
CATV: hasOv('CATV') ? toArr(ovClassify.CATV) : <existing vendor fallback>,
LOCV: hasOv('LOCV') ? toArr(ovClassify.LOCV) : <existing vendor fallback>,
IDS:  hasOv('IDS')  ? toArr(ovClassify.IDS)  : <existing vendor fallback>,
CASH: hasOv('CASH') ? toArr(ovClassify.CASH) : <existing vendor fallback>,
TIER: hasOv('TIER') ? toArr(ovClassify.TIER) : <existing vendor fallback>,
```

Additionally, in `SapFieldsDialog.tsx` Confirm handler, extend the `cfstmt` branch to also clear `LOCV` (so the outgoing payload matches the spec: `LOCATION_VENDOR` empty in CFSTMT mode). The `details` branch already handles `CASH`/`TIER` correctly.

```ts
const finalClassify = classifyMode === 'details'
  ? { ...form.classify, CASH: [], TIER: [] }
  : { ...form.classify, MGV: [], CATV: [], LOCV: [], IDS: [] };
```

No UI reset — user's on-screen selections in the inactive card remain intact.

## Files to change

1. `src/components/sap/SapFieldsDialog.tsx` — add `LOCV: []` to the `cfstmt` `finalClassify`.
2. `src/lib/sapPayloadBuilder.ts` (~lines 312–333) — apply `hasOv(...)` gating for all six classify arrays.
3. `supabase/functions/sync-vendor-to-sap/index.ts` — two duplicated `classifyArrays` blocks (~lines 389 and 455): same `hasOv(...)` gating.
4. `supabase/functions/sync-vendors-to-sap-bulk/index.ts` (~line 102) — same `hasOv(...)` gating, using `row.classify` as the source-of-truth object.

Edge functions `sync-vendor-to-sap` and `sync-vendors-to-sap-bulk` will be redeployed after the edits.

## Out of scope

- No UI changes to the classification cards; the user's picks are preserved.
- No SAP template or mapping changes.
- No changes to `MultipleSapSyncDialog` UI (it flows through the same fixed edge functions).
