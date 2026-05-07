## Problem

After CEO Office approval, the vendor's status is set to `pending_sap_sync` (by `process-approval-action`). The "All Vendors" list correctly shows the vendor with the **Pending SAP Sync** badge (visible in screenshot — vendor `a0a0b224…`). But the **SAP Sync** screen shows "No vendors pending SAP sync".

Root cause: `src/pages/SAPSync.tsx` line 61 queries:
```ts
useVendors(['purchase_approved'])
```
while the workflow now uses `pending_sap_sync` as the ready-for-sync status. The two values don't match, so the list is always empty.

The dashboard counters in `src/hooks/useVendors.tsx` (lines 585, 591, 601) have the same stale assumption.

## Fix

1. **`src/pages/SAPSync.tsx`** — change the status filter to include both values so historical and current records both show:
   ```ts
   useVendors(['pending_sap_sync', 'purchase_approved'])
   ```

2. **`src/hooks/useVendors.tsx`** — update the three dashboard aggregations to also count `pending_sap_sync`:
   - `pendingSAPSync` count (line 585)
   - `activeVendors` set (line 591)
   - status-grouping logic (line 601)

3. **Verification** — after the change, reload `/sap/sync`. The SHARVI vendor (`a0a0b224…`) currently in `pending_sap_sync` will appear in the Ready-for-Sync list and the counter will read 1. After clicking Sync, status becomes `sap_synced` and it disappears from the list as expected.

No database changes, no edge-function changes — purely a client-side filter fix.
