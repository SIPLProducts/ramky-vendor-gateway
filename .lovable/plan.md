## Deploy & Verify Multi-Sync Workflow

### Steps

1. **Deploy edge functions**
   - `sync-vendors-to-sap-bulk`
   - `sync-vendor-to-dms`
   - (Re-deploy `sync-vendor-to-sap` since it was updated to set `dms_sync_pending` + store `sap_reference_no`.)

2. **Smoke check**
   - Run TypeScript/build verification on the changed frontend files (`SAPSync.tsx`, `MultipleSapSyncDialog.tsx`, `useVendors.tsx`, phone-validation pages).
   - Tail edge function logs for any boot errors after deploy.
   - Fix any compile / import / type issues that surface.

3. **Report results**
   - Confirm deployment succeeded.
   - List any issues found and the fixes applied.

### Out of scope
- No new features, schema changes, or UI changes beyond fixing issues exposed by the build/deploy.
- No end-to-end live SAP/DMS call (requires real backend); only confirm functions deploy cleanly.