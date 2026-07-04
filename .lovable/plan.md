## Issue found

The frontend payload builder already includes these fields inside `CLASSIFY`:

```json
"CASHFLOW": [{ "CASH": "..." }],
"VENCATEGORY": [{ "VENCAT": "..." }]
```

But the backend sync function rebuilds/normalizes `CLASSIFY` before sending to SAP, and in that backend path it only keeps:

- `MAT_GRP_VENDOR`
- `CAT_VENDOR`
- `LOCATION_VENDOR`
- `IDENTIFICATION_SOURCE`

So `CASHFLOW` and `VENCATEGORY` are being dropped by the app sync function before the request reaches SAP. That is why the same payload works from Postman but SAP does not receive those two blocks from the application.

## Plan

1. Update `sync-vendor-to-sap` backend function:
   - Include `CASH` and `TIER` in the `classifyArrays` mapping for both paths:
     - client-supplied `sapPayload` path
     - server-side template fallback path
   - Emit:
     - `CLASSIFY.CASHFLOW` as `[{ CASH: value }]`
     - `CLASSIFY.VENCATEGORY` as `[{ VENCAT: value }]`

2. Update `sync-vendors-to-sap-bulk` backend function:
   - Apply the same mapping for bulk SAP sync so multiple-vendor sync does not drop these fields.

3. Keep existing frontend behavior unchanged:
   - SAP confirmation dialog already captures `CASH` and `TIER`.
   - `buildSapPayload` already creates the correct `CLASSIFY` shape.
   - No UI changes needed.

4. Verify the outgoing app-built payload shape:
   - Confirm `CLASSIFY` includes all six blocks before SAP call:

```json
{
  "MAT_GRP_VENDOR": [{ "MGV": "..." }],
  "CAT_VENDOR": [{ "CATV": "..." }],
  "LOCATION_VENDOR": [{ "LOCV": "..." }],
  "IDENTIFICATION_SOURCE": [{ "IDS": "..." }],
  "CASHFLOW": [{ "CASH": "..." }],
  "VENCATEGORY": [{ "VENCAT": "..." }]
}
```

## Files to change

- `supabase/functions/sync-vendor-to-sap/index.ts`
- `supabase/functions/sync-vendors-to-sap-bulk/index.ts`