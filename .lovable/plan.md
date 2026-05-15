## Problem
Autosave + manual save both call `uploadAllDocuments`, which does `SELECT → DELETE → INSERT` per document. Two concurrent runs race and the second `INSERT` violates the unique index `vendor_documents_vendor_type_unique` on `(vendor_id, document_type)`. The toast shown is:

> Failed to save document metadata for gst_self_declaration: duplicate key value violates unique constraint "vendor_documents_vendor_type_unique"

## Fix (frontend only — `src/hooks/useVendorRegistration.tsx`)

### 1. Use `upsert` instead of delete-then-insert
Change `saveDocumentMetadata` to:
```ts
supabase
  .from('vendor_documents')
  .upsert(
    { vendor_id, document_type, file_name, file_path, file_size, mime_type },
    { onConflict: 'vendor_id,document_type' }
  );
```
This is atomic against the unique index — no second writer can fail with a duplicate-key error. Drop the explicit `delete().eq('id', existing.id)` block; storage cleanup of the old object stays.

### 2. Serialize `uploadAllDocuments` per vendor
Add a module-level `Map<string, Promise<void>>` (or a `useRef`) so a second invocation for the same `vendorId` `await`s the in-flight one before starting:
```ts
const inFlight = useRef<Promise<void> | null>(null);
const uploadAllDocuments = async (...) => {
  if (inFlight.current) await inFlight.current.catch(() => {});
  inFlight.current = (async () => { /* existing body */ })();
  try { await inFlight.current; } finally { inFlight.current = null; }
};
```

### 3. Clear in-memory `File` refs after a successful upload (defensive)
After each successful upload of a doc, set the corresponding `formData.*.File` field to `null` (already partially done in earlier work — verify it covers `gst_self_declaration`, `msme_self_declaration`, both cancelled cheques, financial docs, and dealership cert). This stops autosave from re-uploading the same file.

## Verify
- Open vendor registration, upload GST cert + GST self-declaration, then move to MSME step and upload MSME cert.
- Confirm: no "Couldn't save — will retry" / no duplicate-key toast.
- Check `vendor_documents` for the test vendor: exactly one row per `document_type`.

## Out of scope
- No DB migration. The unique index stays — it's the safety net that exposed this bug.
- No edge-function changes.
