## Good news — DEV and PROD Storage are already isolated

Your output confirms it:

| | DEV | PROD |
|---|---|---|
| Storage host path | `/opt/Ramky_Applications/DEV/VMS/backend/volumes/storage` | `/opt/Ramky_Applications/PROD/VMS/backend/volumes/storage` |
| DB host path | `/opt/Ramky_Applications/DEV/VMS/backend/volumes/db/data` | `/opt/Ramky_Applications/PROD/VMS/backend/volumes/db/data` |
| In-container path (identical, and that's fine) | `/var/lib/storage` | `/var/lib/storage` |

Each container mounts a **different host directory** into the same in-container path `/var/lib/storage`. That's how Docker works — it looks like "the same folder" only from inside the container. DEV files never touch PROD's disk and vice versa. No isolation problem.

You can prove it in one command:
```bash
ls -1 /opt/Ramky_Applications/DEV/VMS/backend/volumes/storage/stub/vendor-documents 2>/dev/null | head
ls -1 /opt/Ramky_Applications/PROD/VMS/backend/volumes/storage/stub/vendor-documents 2>/dev/null | head
```
Different file lists = fully isolated.

## So we're back to the original problem

DEV uploads succeed, PROD returns `new row violates row-level security policy`. Same code, isolated storage, different DBs — the divergence is in **PROD's `storage.objects` policies**. Plan below picks up exactly there, unchanged from what you already approved in principle.

## Plan

### 1. Frontend — revert to direct upload
`src/hooks/useVendorRegistration.tsx`: replace the `supabase.functions.invoke('upload-vendor-document', ...)` block with:
```ts
const path = `${vendorId}/${docType}/${Date.now()}_${file.name}`;
const { error } = await supabase.storage
  .from('vendor-documents')
  .upload(path, file, { upsert: true, contentType: file.type });
```
Restore the original toast that surfaces the raw Storage error.

### 2. Delete the Edge Function
- Remove `supabase/functions/upload-vendor-document/` from the repo.
- Delete the deployed function via the delete tool.
- On PROD host:
  ```bash
  rm -rf /opt/Ramky_Applications/PROD/VMS/backend/volumes/functions/upload-vendor-document
  docker compose -p supabase-prod up -d --force-recreate --no-deps functions
  ```

### 3. Dump DEV's `vendor-documents` config as the source of truth
Run on DEV (Studio → SQL) and paste the result:
```sql
-- Bucket row
SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets WHERE id = 'vendor-documents';

-- All policies on storage.objects
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname='storage' AND tablename='objects'
ORDER BY policyname;

-- RLS flag
SELECT relrowsecurity, relforcerowsecurity
FROM pg_class WHERE relname='objects' AND relnamespace='storage'::regnamespace;
```

### 4. Run the same three queries on PROD and diff
Any policy present on DEV but missing/different on PROD is a suspect. Any policy on PROD not on DEV is leftover garbage from earlier attempts.

### 5. Rebuild PROD policies to match DEV exactly
Idempotent:
```sql
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname LIKE 'vendor_documents_%'
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

-- Then paste the CREATE POLICY statements built from DEV's Step-3 dump, verbatim.
```

### 6. Signed-in probe on PROD (should return 200)
```bash
USER_JWT='<paste sb-...-auth-token access_token from browser devtools>'
ANON_KEY='<PROD anon key>'
VENDOR_ID='<vendor id owned by that user>'

curl -i -X POST \
  "http://127.0.0.1:8010/storage/v1/object/vendor-documents/$VENDOR_ID/diagnostic/probe-$(date +%s).txt" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: text/plain" --data 'probe' --max-time 10
```
- 200 → repeat the same call through `https://vendx.ramky.com/supabase/storage/v1/...` — if that's 403, PROD Nginx is stripping `Authorization`/`apikey` on `/supabase/storage/`.
- 403 → policies still don't match; re-diff Step 4.

### 7. Verify in the browser
Submit a vendor application → `gst_certificate` uploads with 200, no `upload-vendor-document` calls in the network tab.

## Not doing

- No service_role policy on `storage.objects`.
- No `ALTER ROLE ... BYPASSRLS`.
- No new Edge Function.
- No schema change that DEV doesn't already have.

## Confirm to proceed

1. OK to delete `upload-vendor-document` (repo + live project + PROD mount) and revert the frontend?
2. Will you run Step 3 on DEV and Step 4 on PROD and paste both outputs so I can generate the exact `CREATE POLICY` statements for Step 5?