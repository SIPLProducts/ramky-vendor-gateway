# Fix: SAP F4 dialog error on server — duplicate `recon_account` codes break upsert

## Root cause

`supabase/functions/sap-master-fetch/index.ts` builds `rows[]` from each SAP F4 array and upserts in chunks of 500 with `onConflict: "master_type,code"`.

The self-hosted SAP endpoint returns **duplicate `SAKNR` codes** in `Fetch_ReconAccount` (and likely other masters). Postgres rejects `INSERT ... ON CONFLICT` when the same conflict target appears more than once in a single statement:

```
ON CONFLICT DO UPDATE command cannot affect row a second time
```

Every affected chunk fails → recon_account is counted as `skipped` → the dialog shows *"Edge Function returned a non-2xx status code. Showing cached F4 options if available."*

Local Lovable doesn't see this because its SAP feed has no duplicate recon-account codes.

## Fix

### 1. `supabase/functions/sap-master-fetch/index.ts` (~L397–414)

Dedupe rows by `(master_type, code)` **before** chunking/upserting. Keep the last occurrence (SAP-order-stable) and count the discarded duplicates into `skipped`:

```text
build rows[] as today
------------------------------------------------------------
const dedup = new Map<string, Row>();
for (const r of rows) dedup.set(r.code, r);   // master_type is constant per loop
const beforeDedup = rows.length;
const uniqueRows = Array.from(dedup.values());
skipped += (beforeDedup - uniqueRows.length);
------------------------------------------------------------
chunk uniqueRows and upsert as today
```

Also log once per master when duplicates are collapsed, e.g. `trace(reqId, SVC, "dedup", { type: mapping.type, removed: n })`, so we can spot bad SAP feeds without a Postgres error.

### 2. No other files need changes

The dialog message text, cache fallback path, and WHOLDTAX logic stay as-is.

## Verification

On the self-hosted server, after redeploying `sap-master-fetch`:

1. Open **SAP Field Confirmation** dialog on any vendor → the red banner disappears, F4 dropdowns populate from live SAP.
2. Edge function logs show `stage:"dedup"` entries instead of `bulk upsert error recon_account …`.
3. `summary.recon_account.upserted > 0`; `sap_master_data` contains recon-account rows.
4. Local Lovable behaviour unchanged (no duplicates → nothing to dedupe).

## Deployment note

Only the edge function needs to be redeployed on the self-hosted server. No frontend rebuild required for this fix.
