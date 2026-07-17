## Problem

SAP DMS returns **one aggregate row per vendor** (e.g. `[{ MSGTYP:"S", MSG:"400016988 Document Created" }]`) regardless of how many files were in the batch. Our edge function `sync-vendor-to-dms` currently pairs SAP rows to files by index, so with 6 files and 1 SAP row we mark file[0] as uploaded and files[1..5] as `"SAP DMS returned no row for X"` — showing `1/6 uploaded` and a red Failed popup even though SAP saved all 6 files.

## Fix

In `supabase/functions/sync-vendor-to-dms/index.ts`, replace the per-index row/file pairing with aggregate-response handling:

- If `rows.length === 0`:
  - If HTTP was OK, treat as success for all files (fallback to `res.ok`).
  - Otherwise mark all files failed with the HTTP status/body.
- If `rows.length < fileMeta.length` (typical SAP DMS: one aggregate row):
  - If **every** returned row has `MSGTYP === "S"` → success for all attempted files. `uploadedCount = attemptedCount`, `failedDocuments = []`, `message = firstRow.MSG || "File(s) Uploaded Successfully (N documents)"`.
  - Otherwise → all files failed with the first non-success row's `MSG`/`LONG_MSG`.
- If `rows.length === fileMeta.length` → keep current per-index pairing (future-proof if SAP ever returns one row per file).
- If `rows.length > fileMeta.length` → per-index pairing for the first N; ignore extras.

Aggregate success/failure fields (`success`, `message`, `sap`, `sapRows`, audit log entry) keep the same shape so the UI popup and status update logic stay unchanged.

## Files

- `supabase/functions/sync-vendor-to-dms/index.ts` — only the block that iterates `fileMeta` and builds `failedDocuments`/`uploadedCount`. No other functions, no frontend changes.

## Result

- 6 files + 1 SAP success row → popup shows **"6/6 documents uploaded to DMS"**, green Success, vendor status → `dms_synced`.
- Genuine SAP failure (single row with `MSGTYP !== "S"`) → all files marked failed with that SAP `MSG`.
- No changes to `MultipleSapSyncDialog`, `useVendors`, browser payload construction, middleware, nginx, or SAP endpoint.

## Out of scope

Multi-vendor batching (user confirmed DMS sync is one vendor at a time).
