## Problem

SAP now returns a wrapped shape:
```json
[{ "ACC_RES": [...], "TOT_RES": [...] }]
```
The current single-sync edge function looks for `MSGTYP === "S"` + `"business partner created"` at the **top level**, never matches, and falls through to the hardcoded `"SAP did not confirm Business Partner creation"`.

`ACC_RES` is the authoritative success block — `MSGTYP`, `BP_LIFNR`, `LONGMSG` (e.g. `"BP Vendor Created with 1061306 Successfully for ..."`). The user wants **only `ACC_RES`** displayed in both single and multiple sync popups.

## Fix

### 1. `supabase/functions/sync-vendor-to-sap/index.ts`
- After parsing `sapResponse`, detect the new shape: if first item has `ACC_RES`, extract `ACC_RES`.
- Determine success purely from `ACC_RES`: success if any row has `MSGTYP === "S"` and a `BP_LIFNR`.
- Take `sapVendorCode` from that ACC_RES row's `BP_LIFNR`.
- Remove the hardcoded `"SAP did not confirm Business Partner creation"` fallback. On failure, surface the first ACC_RES `MSG`/`LONGMSG`, else `"SAP returned no ACC_RES rows"`.
- Return `{ success, sapVendorCode, sapReferenceNo, message, ACC_RES }` (plus raw `sapResponse` for debugging only; UI will not render it).
- Keep flat-array fallback for older SAP responses (no ACC_RES present) — synthesize an `ACC_RES`-shaped row from the first `S`/`E` item so the popup still works.

### 2. `src/pages/SAPSync.tsx`
- **Single sync result dialog**: render only `ACC_RES` rows (`LONGMSG` / `MSG`, `BP_LIFNR`, `BPNAME` if present, MSGTYP badge). Remove the existing `sapResponse.map` block. Show empty state if ACC_RES is empty.
- **Multiple sync result dialog**: already renders `bulkResult.ACC_RES` — keep as-is (no TOT_RES or other blocks).
- Update `handleConfirmSync` error fallback to populate `ACC_RES` (not `sapResponse`) so the dialog renders consistently on failure.

## Out of scope
- No DB schema changes.
- No DMS / middleware changes.
- Bulk sync edge function unchanged (already returns `ACC_RES`).
- Vendor workflow unchanged — successful sync still moves vendor to `dms_sync_pending`.