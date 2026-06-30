## Changes

### 1. Email "Synced At" → IST time
`supabase/functions/sync-vendor-to-sap/index.ts` (line ~717)

Currently:
```ts
const syncedAt = new Date().toLocaleString();
```

Change to format in IST (Asia/Kolkata):
```ts
const syncedAt = new Date().toLocaleString('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: true,
}) + ' IST';
```
So the success email shows correct India time (e.g. `30/06/2026, 04:22:18 PM IST`) regardless of server timezone.

### 2. SAP Sync screen vendor card
`src/pages/SAPSync.tsx` (lines ~498 and ~502)

- Remove the green `CEO Office Approved` / `Finance 2 Approved` badge next to the vendor name (delete the `<Badge>` line and keep `getApprovalLabel` helper untouched in case used elsewhere — actually only used here; safe to remove the badge usage only).
- Replace `ID: 27b38218...` chip with `Ref: <reference_number>`:
  ```tsx
  <span className="font-mono bg-muted px-2 py-0.5 rounded">
    Ref: {(vendor as any).reference_number || vendor.id.slice(0, 8).toUpperCase()}
  </span>
  ```

### Out of scope
- DMS Sync tab, Duplicate & Closed tab, dialogs, email subject, DB schema — unchanged.
- SAP sync / DMS sync upload logic — unchanged.
