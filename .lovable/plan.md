## Problem

`vendors.sap_duplicate_details` is `NULL` for every duplicate-closed vendor, so the "Existing Vendor Details" table is missing from both the buyer email and the "Duplicate & Closed" card. Verified against the last 5 `sap_team_closed` rows.

The SAP duplicate row you shared:

```
{ "MSGTYP":"E", "LONGMSG":"PAN Number Duplicated",
  "MSG_TEXT":"1017527    - Ashish Shreevas - PEGPS8256R", "REFER_NUM":"13991D9D" }
```

## Root cause

Two bugs in `src/pages/SAPSync.tsx › isPanDuplicateResponse` (which produces the `existingVendorText` sent to `sap-team-reject-vendor`):

1. It only understands two shapes: `{ ACC_RES: [...] }` and `{ sapResponse: [{ ACC_RES: [...] }] }`. When the edge function returns `sapResponse` as a bare array `[{ ACC_RES: [...], TOT_RES: [...] }]` (which is what actually comes back from SAP), `rows`/`totRows` end up empty, so `MSG_TEXT` is never read. The duplicate is still detected because the catch-path fallback matches the regex on the top-level `message`, but by then no row context is available and `msgText` stays `""`.
2. Even when rows are found, it picks the first non-empty `MSG_TEXT` from any row. In your sample the duplicate row has the useful `MSG_TEXT`, but a second `"No Bank Key Available"` row is present too — extraction should be anchored to the row whose `LONGMSG` matches the PAN/GST duplicate regex, not "first non-empty".

## Fix

1. `src/pages/SAPSync.tsx` — rewrite `isPanDuplicateResponse` to:
   - Normalize `resp` into a flat list of `ACC_RES` + `TOT_RES` rows, accepting all shapes we produce today: object with `ACC_RES`, object with `sapResponse` (object or array), bare array of `{ ACC_RES, TOT_RES }`, and per-vendor bulk shapes (`raw` / `totRaw`).
   - Find the row whose `LONGMSG` (or `MSG` / `LONG_MSG`) matches the duplicate regex and read `MSG_TEXT` from that same row. Fall back to the first row with a non-empty `MSG_TEXT` only if no explicit match is found.
   - Return `{ matched, message, msgText }` as today, so the calling code and the reject edge function keep the same contract.

2. `supabase/functions/sap-team-reject-vendor/index.ts` — extend the `existingBlock` parser to also handle the 3-part form `SAPCODE - NAME - PAN` (your sample has no GSTIN). Current code already handles 4 parts and the free-text fallback; the 3-part branch just needs to render SAP Vendor Code + Vendor Name + PAN and omit GSTIN. No auth, no schema, no other logic changes.

3. Same 3-part rendering in the "Duplicate & Closed" tab card in `src/pages/SAPSync.tsx` (lines ~727-790) so the UI table matches the email when GSTIN is absent.

4. No migration, no backfill. Vendors already closed with `sap_duplicate_details = NULL` stay as-is; new closures after the fix will populate correctly.

## Verify

- Trigger a single-vendor SAP sync against a known duplicate PAN.
- Confirm `vendors.sap_duplicate_details` now stores `"1017527 - Ashish Shreevas - PEGPS8256R"` (or the 4-part form when GSTIN is returned).
- Confirm the buyer email body shows the "Existing Vendor Details" table with SAP Vendor Code / Vendor Name / PAN (+ GSTIN when present).
- Confirm the "Duplicate & Closed" card renders the same table.
- Repeat via the bulk sync path (`handleMultipleSync`) — it uses the same `isPanDuplicateResponse` helper so it's covered by the same fix.
