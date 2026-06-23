## What the error actually means

The URL in the request is the **unauthenticated** storage endpoint:

```
/storage/v1/object/vendor-documents/<vendor_id>/cancelled_cheque/<file>.pdf
```

- No `/sign/...?token=` segment → it is **not** the signed URL the app produces via `createSignedUrl`.
- `vendor-documents` is a **private** bucket, so a direct GET to `/object/<bucket>/<path>` will always return `404 not_found` on a self-hosted Supabase, even if the file exists.

So one of two things is happening on the self-hosted server:

1. **The object genuinely is not in storage on the self-hosted instance.** The `vendor_documents` row was migrated (or created against this DB) but the underlying file in the `vendor-documents` bucket was never copied over. The app calls `createSignedUrl`, storage replies "object does not exist", code falls back to `download()` which also fails, and the UI shows "File is missing in storage."
2. **The storage service is misconfigured** (wrong S3/file backend, bucket name mismatch, or `vendor-documents` bucket not created on the self-hosted Supabase). Same symptom for every file.

The app code itself (upload path, `file_path` convention `{vendorId}/{documentType}/{timestamp}_{name}`, `createSignedUrl` + `download` fallback) is correct and unchanged — this is an environment/data issue on the self-hosted box.

## Verification steps on the self-hosted server

Run these on the self-hosted Supabase to localize the cause:

1. Confirm the bucket exists:
   ```sql
   select id, name, public from storage.buckets where name = 'vendor-documents';
   ```
2. Confirm the object row exists in storage metadata:
   ```sql
   select name, bucket_id, created_at
   from storage.objects
   where bucket_id = 'vendor-documents'
     and name = 'f30c1a63-e593-43b2-b8b1-878db58ae0c9/cancelled_cheque/1781761907875_LN_Cheque.pdf';
   ```
3. Confirm the physical file exists in the storage backend (S3 bucket or `/var/lib/storage` mount, depending on how Supabase Storage is configured).
4. Test a signed URL from the server:
   ```bash
   curl -X POST \
     -H "Authorization: Bearer <service_role_key>" \
     -H "Content-Type: application/json" \
     -d '{"expiresIn":3600}' \
     http://206.1.23.95:9009/supabase/storage/v1/object/sign/vendor-documents/<path>
   ```
   - 200 + token → storage works, the original failing URL was just the wrong (unsigned) one.
   - 404 → the object truly isn't there; this is a data-migration gap.

## Likely outcomes and remediation

- **Object missing (most likely)** — re-sync the `vendor-documents` bucket from the source environment to the self-hosted backend (S3 sync or rsync of the storage volume). No code change needed; once files land at the expected `file_path`, the SAP Sync viewer will work.
- **Bucket missing / misnamed** — create a `vendor-documents` private bucket on the self-hosted Supabase and re-run the storage data sync.
- **Storage service misconfigured** — fix the storage container's S3/file backend env vars so `storage.objects` rows actually resolve to bytes.

## Small UI hardening (only code change proposed)

To make the SAP Sync screen more useful when this happens again, I'd make one tiny change in `src/components/vendor/VendorDocuments.tsx`:

- When both `createSignedUrl` and `download` fail, include the failing `file_path` in the toast description (currently it just says "Document file is missing in storage."). This lets the admin/operator copy the exact key to investigate on the storage server without opening DevTools.

Example new toast:

```
Preview unavailable
Storage object not found: f30c1a63-.../cancelled_cheque/1781761907875_LN_Cheque.pdf
```

No other code changes. Upload pipeline, RLS, and `createSignedUrl` usage are already correct.

## Out of scope

- Migrating the actual files between environments (must be done on the self-hosted infra).
- Changing the bucket to public — that would expose vendor PII and is not appropriate.

Approve this and I'll apply the toast/error-detail change; the storage migration must be done on the self-hosted box per the verification steps above.
