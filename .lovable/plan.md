## Fix the missing retry button

The row is marked `DMS Synced`, so the current UI hides the DMS action button. To retry that same vendor, the DMS table needs to show a button even when the status is already synced.

## Planned change

Edit `src/pages/SAPSync.tsx` only:

1. In the DMS Sync table action column, remove the condition that hides the button when `isSynced` is true.
2. Show:
   - `Sync to DMS` for pending rows.
   - `Resync to DMS` for rows already showing `DMS Synced`.
3. Keep both buttons connected to the same working function:
   ```ts
   handleDmsSync([v.id])
   ```
4. Keep the existing eye/view button unchanged.

## Result

For the vendor currently showing `DMS Synced`, you will see a **Resync to DMS** button next to the eye icon, so you can upload the documents again and get the proper SAP DMS response.