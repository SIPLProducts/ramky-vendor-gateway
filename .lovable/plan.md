## Change

Stop attaching files in the `sync-vendor-to-sap` payload. The SAP master-data sync should send `UPLOAD: []` (or omit it where allowed), and all document upload continues to flow through the existing dedicated `sync-vendor-to-dms` edge function (which posts `{ BP_LIFNR, FILE_UPLOAD }` to the SAP DMS endpoint).

Today `buildUploads` in `src/lib/sapPayloadBuilder.ts` downloads every vendor document, base64-encodes it, and stuffs it into `row.UPLOAD`, and the legacy server path in `sync-vendor-to-sap/index.ts` does the same via `buildUploadArray`. This bloats the BP-create payload and duplicates what `sync-vendor-to-dms` already does.

## Files

1. **`src/lib/sapPayloadBuilder.ts`**
   - Remove the `buildUploads` call in `buildSapPayload`. Set `row.UPLOAD = []` unconditionally.
   - Remove (or keep unused + comment) `buildUploads`, `MAX_UPLOAD_BYTES`, the `blobToBase64` helper, and the `skipped` field plumbing related to uploads. `skipped` returned from `buildSapPayload` becomes `[]`.

2. **`supabase/functions/sync-vendor-to-sap/index.ts`**
   - Client-supplied payload path: do **not** call `buildUploadArray`. Force `row.UPLOAD = []` before forwarding to SAP (overwrite anything the client sent in `UPLOAD`, since DMS handles files).
   - Legacy server-built payload path: same — `row.UPLOAD = []`, no `buildUploadArray` call.
   - Leave `buildUploadArray` in place but unused (or delete it) — preference: delete to avoid drift.

3. **No change** to `sync-vendor-to-dms/index.ts`, `prepare-dms-payload/index.ts`, the DMS trigger logic in `src/hooks/useVendors.tsx`, or any UI. Files continue to upload via the separate DMS call already wired after a successful BP create.

## Out of scope

- Schema changes, UI changes, bulk-sync edge function.
- DMS batching, retry, or path-rewrite logic — unchanged.
- MSME override fields (`reg_is_msme`, `idnum2`, `IDCATG`, etc.) stay exactly as they are; only the `UPLOAD` array is emptied.
