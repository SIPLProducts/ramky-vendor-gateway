## Goal
On the SAP Sync → DMS Sync tab, once a vendor's DMS upload is complete (status `dms_synced`, badge "DMS Synced"), do not show the "Resync to DMS" action button. Only the View (eye) button should remain. Vendors still pending will continue to show the green "Sync to DMS" button as before.

## Change
**File:** `src/pages/SAPSync.tsx` (around lines 420–432)

Wrap the sync/resync `<Button>` in `{!isSynced && (...)}` so it only renders for `Pending DMS` rows. The View button stays for all rows.

## Out of scope
- No change to backend, sync logic, status values, or the SAP Sync tab.
- Bulk-select already excludes synced rows (line 76), so no change there.
