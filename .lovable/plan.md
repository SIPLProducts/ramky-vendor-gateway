## SAP Sync — Duplicate-rejection updates

Scope: SAP Sync screen only. Edit `src/pages/SAPSync.tsx`.

### 1. Rename "Reject" → "Duplicate Reject"
- SAP Sync vendor card action button label changes from `Reject` / `Rejecting...` to `Duplicate Reject` / `Marking duplicate...`.
- Reject confirmation dialog: title → "Duplicate Reject Vendor"; description → "The vendor will be marked as a duplicate (already available in SAP) and moved to the Duplicate Rejected Data tab."; confirm button → "Confirm Duplicate Reject".
- Default remarks placeholder stays ("e.g. Vendor already exists in SAP").

No behavior change — the existing `sap-team-reject-vendor` edge function already moves the vendor to the rejected list, which is exactly the requested flow.

### 2. Rename tab "Rejected" → "Duplicate Rejected Data"
- TabsTrigger label updated.
- Empty-state heading: "No duplicate-rejected vendors".
- Rejected card badge: `SAP Team Rejected` → `Duplicate Rejected`.
- Rejected card remarks header: `Reject Remarks` → `Duplicate Reject Remarks`.

### 3. Auto-move on PAN duplicate SAP failure
In `handleConfirmSync`, after the SAP sync result is set, inspect the response. If the sync failed (`success === false` OR any `ACC_RES` row has `MSGTYP === 'E'`) AND any message text matches `/pan\s*number\s*duplicat|duplicate\s*pan/i`:

1. Call `supabase.functions.invoke('sap-team-reject-vendor', { body: { vendorId, remarks: <matched message or "PAN Number Duplicated — vendor already exists in SAP"> } })` silently.
2. On success, show a toast "Moved to Duplicate Rejected Data" and call `refreshAllLists()` so the rejected tab updates while the SAP result dialog stays visible for the user to review.
3. Swallow any error from this auto-move (log only) — the result dialog already explains the failure.

Bulk sync results (`handleMultipleSync`) get the same detection: iterate `bulkResult.results` (or `ACC_RES`), and for each vendor whose response includes a PAN-duplicate message, fire the same edge call. Refresh lists once at the end.

### Out of scope
No edge-function, schema, or payload-builder changes — `sap-team-reject-vendor` already handles the state transition and `last_rejection_comments` field used by the rejected card.
