# Improve PDF → JPEG quality for Surepass OCR

## Problem

When a PDF cheque/document is uploaded, `src/lib/pdfToImage.ts` rasterizes pages with a hard cap of `MAX_PAGE_EDGE = 2200px` and re-encodes at `JPEG_QUALITY = 0.9`. For a cheque, the MICR/IFSC line ends up as only ~40-60px tall on the rendered page — too soft for Surepass to read reliably. Direct JPG uploads work because the original scan is much higher resolution.

The Base64 step itself is lossless. The loss happens at pdf.js render scale + canvas JPEG re-encode.

## Changes

**File: `src/lib/pdfToImage.ts`** (PDF branch only — image/DOCX/TXT paths untouched)

1. Raise the per-page render ceiling for PDFs:
   - `MAX_PAGE_EDGE` stays `2200` for the image/DOCX/TXT branches (they already work).
   - Introduce `MAX_PDF_PAGE_EDGE = 3400` and `MAX_PDF_RENDER_SCALE = 4` used only inside the PDF rasterization loop. This gives a typical A4 cheque page ~3300px on the long edge instead of ~2200px — roughly 2.3× more pixels on the IFSC line.

2. Raise JPEG quality for PDF output to `0.95` (`PDF_JPEG_QUALITY`). The image branch keeps `0.9` so we don't regret-encode well-sized scans.

3. Keep the existing 8 MB safety net: after encoding the final JPEG, if `out.size > 8 * 1024 * 1024`, fall back to re-encoding the same canvas through `fitCanvas(..., MAX_PAGE_EDGE)` + `quality 0.9` so Surepass's multipart cap is respected. Single-page and multi-page stitched paths both go through this check.

4. Multi-page master height cap stays (`MAX_MASTER_HEIGHT = 4400`) — only single-page PDFs benefit from the new ceiling, which is the cheque case in the screenshot. Multi-page docs (POA, registration certs) keep the existing behaviour.

5. Add `console.log` of the final JPEG dimensions + size for both PDF paths so we can confirm in DevTools that the cheque is now landing at ~3300px / ~95% quality.

No changes to `kyc-api-execute`, `BankKycTab`, `useProviderVerify`, or how the IFSC value is parsed from the Surepass response.

## Verification

1. Upload the same Avyakth cheque PDF in the bank step.
2. In DevTools → Network → `kyc-api-execute` request, the `fileBase64` payload size should jump from ~206 kB to roughly ~450-700 kB (a real higher-resolution JPEG, not a bigger Base64 string of the same image).
3. Console should log `pdf(1pg)→jpeg { output: { w: ~3300, h: ~1500, size: ... } }`.
4. Surepass response should now contain `ifsc_code: "KARB0000916"` (matches the direct-JPG case) and the IFSC field auto-populates correctly.
5. Smoke-test a multi-page PDF (e.g. GST certificate) to confirm it still encodes within the 8 MB cap.

## Out of scope

- No edge function changes.
- No change to direct JPG/PNG uploads (they already work).
- No change to the OCR UI or comparison card.
