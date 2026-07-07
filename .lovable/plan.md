## Problem

`The API version "5.4.296" does not match the Worker version "6.1.200".`

`react-pdf@10` bundles its own `pdfjs-dist@5.4.x`, but I also installed `pdfjs-dist@6.1.200` and pointed the worker at that version — versions must match exactly.

## Fix

Load the worker from the same `pdfjs-dist` copy that `react-pdf` uses, and drop the extra top-level `pdfjs-dist` dependency.

1. **`src/components/vendor/PdfPreview.tsx`** — change the worker import to resolve through `react-pdf`'s bundled pdfjs:
   ```ts
   import pdfWorker from 'react-pdf/dist/pdf.worker.min.mjs?url';
   ```
   (Fallback if that path isn't exported: `import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'` after aligning the version — see step 2.)

2. **`package.json`** — remove the explicit `pdfjs-dist` dependency so only the version bundled with `react-pdf` is used, avoiding future drift. If step 1's `react-pdf/dist/...` path doesn't exist, keep `pdfjs-dist` but pin it to the version `react-pdf@10` requires (`^5.4.x`) instead of `6.1.x`.

## Validation
- Reopen `Import_Doc.pdf` — all 25 pages render, page nav + zoom work.
- No console warning about API/Worker version mismatch.
