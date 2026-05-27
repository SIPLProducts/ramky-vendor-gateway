## Goal
Stop the "Could not convert your PDF to an image for OCR" hard-fail when a vendor uploads a PDF on the Document Verification step. Make the flow self-healing.

## Root cause
- `src/lib/pdfToImage.ts` (`normalizeUploadToImage`) throws on this PDF — likely pdf.js worker load issue on the self-hosted nginx (`.mjs` MIME / CSP) or a page pdf.js can't render.
- `OcrUploadAndVerify.runPipeline` calls `normalizeUploadToImage` with **no try/catch** → UI stuck or shows generic failure.
- `DocumentVerificationStep.extractFromFile` catches but hard-fails with the screenshot's message instead of falling back.
- Most configured KYC providers (Surepass etc.) actually accept PDFs directly, so refusing the upload locally is unnecessary.

## Changes

### 1. `src/lib/pdfToImage.ts`
- Wrap pdf.js `getDocument` in try/catch.
- If worker init fails, retry once with `disableWorker: true` before giving up.
- If a single `page.render(...)` throws, skip that page rather than aborting the whole stitching.
- Throw a clearer error (`PDF_CONVERSION_FAILED: <reason>`) so callers can decide to fall back.

### 2. `src/components/vendor/kyc/OcrUploadAndVerify.tsx`
- Wrap the `normalizeUploadToImage(file)` call in try/catch.
- On failure: log the error, **call `runOcr(file)` with the original PDF** as a fallback (providers usually accept PDFs).
- Only if the provider itself also returns failure, show: *"We couldn't read this PDF. Please upload a clearer scan or a JPG/PNG image."*

### 3. `src/components/vendor/steps/DocumentVerificationStep.tsx`
- In `extractFromFile`, replace the two
  `"Could not convert your PDF to an image for OCR…"` early-returns with the same fallback: when `normalizeUploadToImage` throws or returns the original file, still call `callProvider({ providerName, file: originalPdf })`. Surface the friendly message only if the provider call also fails.

### 4. Self-hosted deployment note (no code change)
The error string in the screenshot only exists in `DocumentVerificationStep`, but the GST tab uses `OcrUploadAndVerify`. That means the bundle currently served from `10.200.1.7` is a stale build from before the previous "all tabs" fix. After these changes are deployed:
- On Lovable Cloud — auto-rebuilds.
- On the self-hosted server — re-run `scripts/lib/60-frontend.sh` (or the full `setup-selfhost.sh`) so the new `dist/` is rsynced to nginx and the browser actually loads the updated code. I'll remind the user in the follow-up message.

## Files
- `src/lib/pdfToImage.ts`
- `src/components/vendor/kyc/OcrUploadAndVerify.tsx`
- `src/components/vendor/steps/DocumentVerificationStep.tsx`

## Verification
1. Upload the same `BWR GST Certificate Bangalore (1).pdf` on the GST tab in Lovable preview — pipeline should succeed, or (if provider can't read it) show the new friendly fallback message, not the old "Could not convert…" message.
2. Repeat on PAN, MSME, Bank tabs.
3. After redeploying to `10.200.1.7`, repeat there.