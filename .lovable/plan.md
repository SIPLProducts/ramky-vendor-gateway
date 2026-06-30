## Goal

Allow DMS sync to upload files of any size and any count without being skipped by app-side MB limits. SAP BP sync stays unchanged (`UPLOAD: []`).

## Changes

### 1. `supabase/functions/sync-vendor-to-dms/index.ts`
- Remove the `MAX_UPLOAD_BYTES` (10 MB) per-file skip — large files like bank cheque will no longer be dropped with "(>10MB)".
- Remove the `DMS_BATCH_MAX_BYTES` (1 MB) per-file rejection — single files larger than 1 MB will no longer be skipped with "exceeds safe per-request DMS limit".
- Keep batching logic so multiple files are split across requests, but stop dropping individual files:
  - If adding the next file would exceed the batch threshold and the current batch already has files, close the batch and start a new one.
  - If a single file is larger than the batch threshold, send it on its own as a one-file batch (no skip).
- Keep all existing logging, retry-across-candidate-URLs, SAP response parsing, audit log, and status update behavior.

### 2. `supabase/functions/prepare-dms-payload/index.ts`
- Remove the 10 MB skip in the preview payload so the browser-side preview matches the actual DMS sync (no "(>10MB)" entries).

### 3. Not changed
- `src/lib/sapPayloadBuilder.ts` — SAP BP-create payload continues to send `UPLOAD: []`.
- `supabase/functions/sync-vendor-to-sap/index.ts` — unchanged.
- MSME read-only popup, DMS path mapping, middleware URL handling, frontend upload UI — unchanged.

## Result

Any number of vendor documents of any size stored in `vendor-documents` will be included in DMS sync. The only remaining limits are real ones from middleware/SAP/network, which will now surface as actual errors instead of silent "skipped" entries.

## Note

This removes the app-side safety cap that was originally added to avoid HTTP 413 at the proxy. If the middleware or SAP server rejects very large payloads, those errors will now be reported per batch in the result message rather than pre-empted. The middleware itself may still need its body-size limit raised separately if downstream 413s appear.