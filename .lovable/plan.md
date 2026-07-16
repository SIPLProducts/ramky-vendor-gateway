## Updated Plan

You are right: adding another static size limit is not the correct fix. I will remove the app-level DMS payload caps and fix the actual upload path.

## Root Cause

The current DMS flow sends large base64 files through the browser first:

```text
Browser
  -> prepare-dms-payload returns full FILE_UPLOAD base64
  -> Browser sends same full FILE_UPLOAD again
  -> sync-vendor-to-dms
  -> nginx / middleware
  -> SAP DMS
```

That doubles the large payload through the public web path and makes the browser/function request hit whichever nginx/proxy limit is active. The 413 HTML response is from nginx rejecting a request before the SAP response is fully handled.

Postman works because it sends directly to the SAP endpoint in one simpler path, while the app currently bounces the same large base64 payload through browser + edge function + middleware.

## What I Will Change

### 1. Remove app-level hardcoded DMS limits

Remove unused/static size constants from:
- `supabase/functions/prepare-dms-payload/index.ts`
- `supabase/functions/sync-vendor-to-dms/index.ts`

Do not add hardcoded limits like 20 MB, 50 MB, 500 MB, or a fixed batch-size cap in application logic.

### 2. Stop sending full base64 payload through the browser

Change the frontend DMS sync flow from this:

```text
prepare-dms-payload -> browser receives all base64 files -> sync-vendor-to-dms sends all base64 files again
```

to this:

```text
Browser sends only vendorIds
sync-vendor-to-dms downloads documents server-side
sync-vendor-to-dms sends documents to middleware/SAP
```

This removes the biggest failing path: browser-to-function giant JSON payloads.

### 3. Send DMS files one-by-one or stream-like sequentially without static total cap

Inside `sync-vendor-to-dms`, process each document independently:

```text
for each vendor:
  for each document:
    download document
    build one FILE_UPLOAD item
    send to SAP DMS
    record SAP row/result
```

This supports any number of files because the app no longer builds one huge combined payload. There is no hardcoded total file-count limit.

Important: no software can truly accept “infinite” payload size. Browser, nginx, runtime memory, network, SAP, and storage all have physical limits. The correct design is not “one unlimited request”; it is sequential document upload so the app does not impose an artificial combined-payload cap.

### 4. Prefer the correct DMS middleware route

Update the DMS function to prefer:

```text
/sap/dms/upload
```

and only fall back to `/sap/bp/create` if needed. This matches the middleware’s explicit DMS endpoint and avoids ambiguity.

### 5. Correct uploaded count and result reporting

Currently `uploadedCount: 4` can appear even when SAP confirms only 2 or 3 files. I will change it to count SAP-confirmed success rows only.

Response will clearly show:

```json
{
  "attemptedCount": 4,
  "uploadedCount": 3,
  "failedCount": 1,
  "sapRows": [...],
  "failedDocuments": [...]
}
```

### 6. Keep nginx/server fix as deployment instruction, not app restriction

On the server, confirm the active nginx config and reload:

```bash
sudo nginx -T | grep -n "client_max_body_size\|server_name vendx.ramky.com\|location"
sudo nginx -t
sudo systemctl reload nginx
```

If 413 still appears after the app change, the next check is which nginx produced it:
- public nginx in front of `/supabase/` or `/sap/`
- middleware nginx
- SAP-side nginx

The function/middleware logs will include the exact URL and document path for the failed request so the rejecting hop is identifiable.

## Files To Update After Approval

- `src/hooks/useVendors.tsx`
  - call `sync-vendor-to-dms` directly with `{ vendorIds }`
  - remove browser-side base64 DMS transfer

- `supabase/functions/sync-vendor-to-dms/index.ts`
  - remove static size/batch limit
  - process documents sequentially
  - prefer `/sap/dms/upload`
  - improve per-document success/failure reporting

- `supabase/functions/prepare-dms-payload/index.ts`
  - remove unused static limit
  - keep only if needed for manual/debug payload preview, not production DMS sync

- `middleware/README.md` and `.env.example`
  - update wording so it does not imply the application has a fixed payload-size policy

## Verification

After implementation:

1. DMS sync sends only `vendorIds` from the browser, not `FILE_UPLOAD` base64.
2. Upload 4 files for BP `1017573`; expect SAP to confirm all files or report the exact failed document.
3. Upload 20 files; expect sequential upload attempts without an app-level file-count or total-size cap.
4. If SAP/nginx rejects one individual large file, the response identifies the exact document and rejecting endpoint instead of hiding it behind a generic batch 413.