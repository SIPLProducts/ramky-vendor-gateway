## Fix PDF worker load failure on self-hosted server

### Problem
On `http://10.200.1.7`, PDF-to-image conversion fails with:
> Setting up fake worker failed: Failed to fetch dynamically imported module: /assets/pdf.worker.min-BZ_6UHJF.mjs

Even with `disableWorker: true`, pdf.js v4 still does a runtime `import(workerSrc)` of the `.mjs` chunk. Over plain HTTP behind Nginx, that dynamic import is failing (MIME / module-script handling), so `getDocument` throws before any page is rendered.

### Fix (single file)
`src/lib/pdfToImage.ts` — swap the `?url` worker import for Vite's `?worker` import, and let pdf.js use it via `workerPort`. This makes Vite emit the worker as a proper module worker that Nginx serves as a normal static asset, bypassing the failing dynamic `import()`.

```ts
import * as pdfjsLib from "pdfjs-dist";
// Vite bundles pdf.js worker and gives us a Worker constructor.
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker";

(pdfjsLib as any).GlobalWorkerOptions.workerPort = new PdfWorker();
```

In `getDocument(...)`:
- Remove `disableWorker: true`
- Keep `isEvalSupported: false` and `useSystemFonts: true`
- Keep the existing try/catch that falls back to sending the original PDF to the OCR provider if `getDocument` ever throws.

Everything else in the file stays exactly the same (page rendering, fit/stitch, JPEG encoding, image/DOCX/TXT branches, logging, exports).

### Out of scope (unchanged)
- OCR pipeline, KYC API calls, verification flow
- `OcrUploadAndVerify`, FileUpload, vendor steps
- Nginx config, build scripts, `vite.config.ts`
- Edge functions, DB, RLS, business logic

### Deploy
Rebuild and redeploy the frontend on the self-hosted server (no backend/migration work needed).

### Verification
1. Open MSME / PAN step on `http://10.200.1.7`, upload a PDF.
2. Console: no "Setting up fake worker failed" error; `[pdfToImage] pdf(Npg)→jpeg` log appears.
3. OCR runs and verification proceeds.
4. JPG / PNG / DOCX / TXT uploads still convert and submit as before.