## Fix "DMS Pending" filter in All Vendors screen

**File:** `src/pages/VendorList.tsx`

**Problem:** Selecting the "DMS Pending" status filter shows nothing even though rows with `dms_sync_pending` exist in the table. The filter group currently maps `dms_pending` to `['sap_synced']` only.

**Change (line 112):**

```ts
dms_pending: ['dms_sync_pending', 'sap_synced'],
```

Include both statuses so:
- New rows using `dms_sync_pending` (awaiting DMS sync after SAP sync) are matched.
- Legacy rows still stored as `sap_synced` (SAP done, DMS pending) remain visible.

No other files change.