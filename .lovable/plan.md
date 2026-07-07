## Problem

When previewing an uploaded PDF (e.g. `Import Doc.pdf`) from the International vendor flow, Microsoft Edge shows "This page has been blocked by Microsoft Edge" inside the preview `<iframe>`.

Root cause: the preview iframe (`src/components/vendor/VendorDocuments.tsx`) is pointed at the Supabase Storage **signed URL** directly. Edge's SmartScreen / tracking-prevention / cross-origin PDF policy frequently blocks third-origin PDFs rendered inside an iframe (especially against a local `http://127.0.0.1` Storage endpoint on self-hosted Lovable, which is a mixed/foreign origin relative to the app). The same file downloads fine, because the download path uses the URL as a top-level navigation, not an embedded frame.

The same-origin `blob:` fallback that already exists in `downloadBlob` is never used for preview, because `getSignedUrl` succeeds first.

## Fix

Render PDFs (and images) from a **same-origin `blob:` URL** in the preview dialog instead of the remote signed URL. Signed URLs stay in use for "Open in new tab" / download, where Edge does not block them.

### Files to change

1. **`src/components/vendor/VendorDocuments.tsx`**
   - In `handlePreview`, always call `downloadBlob(doc.file_path)` first for PDFs and images, wrap in `URL.createObjectURL`, and set that as `previewUrl`. Only fall back to the signed URL if the blob download fails.
   - Track the created object URL in state and `URL.revokeObjectURL(...)` it when the dialog closes (in the existing `onOpenChange` handler) to avoid leaks.
   - Keep the current signed-URL path for the "Open in New Tab" button and for downloads (unchanged).

2. **`src/components/vendor/PersistedFileActions.tsx`** (View Details button used by `FileUpload` in `IntlDocumentsStep`)
   - `handleView` currently does `window.open(signedUrl)`. That works in a new tab but is also affected by SmartScreen for some tenants. Change it to: download the object via `supabase.storage.from(bucket).download(filePath)`, create a `blob:` URL, and `window.open(blobUrl, '_blank')`. Revoke the URL after ~30 s.
   - Keeps behaviour identical for the user, but the opened tab is a same-origin blob that Edge will not block.

### Out of scope

- No changes to upload, storage bucket, RLS, SAP payload, or the International Company Details form.
- No changes to `useVendorRegistration` or types.
- Domestic flow inherits the same fix automatically because both flows share `VendorDocuments` and `PersistedFileActions`.

## Validation

- Re-upload a PDF in the International flow, open **View Details** — PDF should render inline in the dialog.
- Click **Open in New Tab** — opens a same-origin blob tab (no Edge block page).
- Click **Download** — still saves the original filename.
- Repeat with a JPG/PNG upload to confirm image preview still works.
