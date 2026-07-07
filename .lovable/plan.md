## Problem

`Import_Doc.pdf` (25 pages, ~2.5 MB, valid PDF 1.7) still fails to open in the preview dialog even after the blob-URL fix, because Microsoft Edge is blocking its built-in PDF viewer from rendering the file inside our iframe. Depending on the tenant's Edge/SmartScreen/Group Policy, the browser's native PDF handler is unreliable — the file is fine, the viewer is the problem.

## Fix — render PDFs ourselves with pdf.js

Stop relying on the browser's PDF plugin. Render pages client-side with `pdf.js` (via `react-pdf`) inside the existing preview dialog. This works identically across Edge, Chrome, Firefox, and Safari, and does not depend on any browser policy.

### Changes

1. **Install dependency**
   - `react-pdf` (bundles `pdfjs-dist`).
   - Configure the pdf.js worker via a Vite-friendly `?url` import so no `public/` copy is needed.

2. **New component `src/components/vendor/PdfPreview.tsx`**
   - Props: `blob: Blob` (preferred) or `url: string`.
   - Loads the PDF with `<Document file={blob}>`, iterates pages with `<Page pageNumber={n} width={containerWidth} />`.
   - Toolbar: page counter (`1 / 25`), prev/next, zoom −/+ (0.5x–2x), and a "Download" button (uses signed URL).
   - Scrollable container capped at `max-h-[70vh]` matching the existing dialog.
   - Loading spinner + error state ("Could not render PDF, try Download").

3. **`src/components/vendor/VendorDocuments.tsx`**
   - Keep the blob-first `handlePreview` from the previous fix.
   - In the Dialog body, replace the `<iframe src={previewUrl}>` branch with `<PdfPreview blob={previewBlob} />`.
   - Store the downloaded `Blob` in state (`previewBlob`) alongside `previewUrl` so pdf.js gets the bytes directly (no network re-fetch, no iframe).
   - Images branch unchanged. Non-PDF/non-image fallback unchanged.

4. **`src/components/vendor/PersistedFileActions.tsx`** — no change needed for this fix; "View Details" already opens the blob in a new tab. (Optional follow-up: route "View Details" through the same `PdfPreview` dialog, but out of scope here.)

### Out of scope
- No changes to upload flow, storage bucket, RLS, SAP payload, or International form.
- No server / edge-function changes.

## Validation
- Open `Import_Doc.pdf` (25 pages) from the International vendor's Documents card → all pages render, page nav + zoom work.
- Test in Edge (the browser that was blocking), Chrome, and Firefox.
- Test a 1-page PDF and a JPG/PNG to confirm no regressions.
- Confirm dialog cleanup: closing revokes the blob URL (no memory leaks in DevTools).
