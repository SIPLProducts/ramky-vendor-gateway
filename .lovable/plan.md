# Fix: Extract the original scan from PDFs instead of re-rendering

## Diagnosis (validated with your file)

`Avyakth - Cancelled Cheque.pdf` is a scanner-produced PDF (HP Scan). It contains exactly one embedded JPEG image — the original scan at 1654×2338 px, 200 dpi.

The current conversion re-draws that image onto a canvas at 3400 px and re-encodes it as a new JPEG. Two quality losses happen:
1. Upscaling beyond the original 2338 px adds no detail, only interpolation blur.
2. A second JPEG compression pass adds artifacts on top of the original scan's compression.

Side-by-side crops of the IFSC line confirm the converted version is visibly softer than the embedded original. Uploading the JPG directly to Surepass works because Surepass receives the untouched original pixels.

## Fix

**`src/lib/pdfToImage.ts`** — for scanned PDFs, extract the embedded JPEG losslessly instead of rasterizing:

1. Add `extractEmbeddedJpeg(pdfBytes)`: scan the raw PDF bytes for image objects with `/Filter /DCTDecode` (the standard way scanners embed JPEGs) and pull out the exact JPEG stream — byte-for-byte identical to the original scan.
2. In the PDF branch: if the PDF is **single-page** and contains **exactly one large DCTDecode image** (covering most of the page), return that JPEG directly as the file sent to Surepass. This makes a scanned-PDF upload equivalent to uploading the original JPG.
3. Otherwise (text-based PDFs, multi-page PDFs, PNG/Flate scans), keep the existing high-resolution rasterization path unchanged as the fallback.
4. Keep the 8 MB Surepass cap check; if the extracted image exceeds it, fall back to rasterization.
5. Log which path was taken (`pdf→embedded-jpeg (lossless)` vs `pdf→rasterized`) with dimensions and size, so we can confirm in the console.

## How we validate

1. Upload this same cheque PDF in the bank KYC step.
2. Console should log the lossless path with size ≈ 180 KB (matching the embedded scan), not a ~950 KB re-encoded image.
3. Surepass response should return `ifsc_code: KARB0000916` and populate the IFSC field — identical to the direct-JPG result.
4. Smoke-test a multi-page / text-based PDF to confirm the fallback rasterization path still works.

## Out of scope

No changes to the edge function, OCR UI, or how the IFSC is read from the response — only the image quality reaching Surepass.