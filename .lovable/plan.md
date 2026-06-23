
## Goal
DMS payload `FILE_PATH` must be sent as a Windows-style path the SAP DMS server can resolve, not the Supabase storage key.

Currently sent:
```
f01f4f32-342b-4ce9-8a41-0b23c8301591/pan_card/1782207119684_Pan_Card_Archer__1_.pdf
```

Required (UUID folder stripped, hardcoded prefix added):
```
C:/Users/ADMIN/OneDrive/Desktop/pan_card/1782207119684_Pan_Card_Archer__1_.pdf
```

## Changes

Add a small helper in both edge functions:

```ts
const DMS_PATH_PREFIX = "C:/Users/ADMIN/OneDrive/Desktop/";
function toDmsPath(storagePath: string) {
  // storage path looks like "<vendor-uuid>/<doc_type>/<filename>"
  // drop the leading UUID segment, prepend the hardcoded desktop prefix
  const parts = (storagePath || "").split("/");
  const rest = parts.length > 1 ? parts.slice(1).join("/") : parts.join("/");
  return DMS_PATH_PREFIX + rest;
}
```

### 1. `supabase/functions/prepare-dms-payload/index.ts`
- Line 72: `FILE_UPLOAD.push({ FILE: base64, FILE_PATH: toDmsPath(d.file_path) });`

### 2. `supabase/functions/sync-vendor-to-dms/index.ts`
- Line 251 (explicit payload branch): normalize via `toDmsPath(item.FILE_PATH)` so paths coming from the browser are also rewritten — safe because the helper is a no-op if the prefix is already present (add an early-return check: if it starts with `DMS_PATH_PREFIX`, return as-is).
- Line 269 (server-side fetch branch): `uploads.push({ FILE: base64, FILE_PATH: toDmsPath(d.file_path) });`

No changes to Supabase storage itself — internal downloads still use the original `d.file_path`. Only the value sent to the DMS server is rewritten.

### 3. Deploy
Redeploy `prepare-dms-payload` and `sync-vendor-to-dms`.

## Verification
- Trigger a DMS sync; in DevTools → Network → `sync-vendor-to-dms` payload, every `FILE_PATH` must start with `C:/Users/ADMIN/OneDrive/Desktop/` and contain no UUID.
- DMS server response is success (file resolves on its filesystem).
