# Auto-convert PDFs to a single image before OCR

## Goal

When a vendor uploads a KYC document (GST certificate, PAN card, MSME certificate, cancelled cheque):

- **Image (JPG / JPEG / PNG)** → send as-is to the configured OCR provider.
- **PDF** → silently render every page to an image, vertically stitch all pages into **one combined JPEG**, then send that single image to the OCR provider.

The user sees no extra step — same drag-and-drop, same "Reading document…" status. Only the bytes hitting the upstream API change.

## Why

Surepass and similar OCR providers reliably accept JPEG/PNG, but multi-page PDFs often come back with `no_*_detected` because only page 1 is read. Merging all pages into one tall JPEG guarantees the OCR sees the full document (stamp / signature / annexures included) in a format every provider supports.

## Approach

All work happens **client-side in the browser** — no edge function changes, no extra round trips, no server cost.

Library: **`pdfjs-dist`** (already a transitive dep in many Vite stacks; if not present we install it). It runs in the browser, decodes PDFs to a `<canvas>`, and we then composite all page canvases onto one tall canvas and export via `canvas.toBlob('image/jpeg', 0.92)`.

### New utility

`src/lib/pdfToImage.ts`

```ts
export async function normalizeUploadToImage(file: File): Promise<File>
```

Behaviour:
1. If `file.type` starts with `image/` → return the file unchanged.
2. If `file.type === 'application/pdf'` (or extension `.pdf`):
   - Lazy-load `pdfjs-dist` and its worker (dynamic `import()` so it doesn't bloat the main bundle).
   - For each page, render at ~2x scale (`viewport({ scale: 2 })`) onto an offscreen canvas. Cap at e.g. 10 pages to bound memory.
   - Compute a combined canvas: width = max page width, height = sum of page heights (with a small white gap between pages).
   - `drawImage` each page canvas onto the combined canvas.
   - Export as JPEG blob (`quality: 0.92`), wrap in a new `File` named `<originalName>.jpg` with type `image/jpeg`.
3. Anything else → return unchanged (let the API reject it with its normal error).

Errors during conversion fall back to returning the original file with a `console.warn`, so the user is never blocked by a converter bug.

### Wire-in points

Single chokepoint: **`src/components/vendor/kyc/OcrUploadAndVerify.tsx`** — `runPipeline(file)` is the one function that every KYC tab routes through (GST, PAN, MSME, Bank). Convert there, before calling `runOcr`:

```ts
const normalized = await normalizeUploadToImage(file);
const ocr = await runOcr(normalized);
```

This keeps the change in **one file** and automatically covers all four KYC tabs plus the admin Live Test panel (which uses the same components).

`FileUpload.tsx` is left untouched — the original PDF still uploads to Supabase storage as the audit copy; only the bytes sent to the OCR provider are the merged JPEG.

### Status messaging

While converting, briefly show "Preparing document…" before the existing "Reading document via configured OCR provider…" alert, so multi-page PDFs (which can take 1–3s to rasterise) don't look frozen.

## Files changed

- **New:** `src/lib/pdfToImage.ts` — the converter utility.
- **Edit:** `src/components/vendor/kyc/OcrUploadAndVerify.tsx` — call `normalizeUploadToImage` in `runPipeline`, add the "Preparing document…" phase.
- **Edit (if needed):** `package.json` — add `pdfjs-dist` if not already installed.

## Out of scope

- No changes to edge functions (`kyc-api-execute`) — it already forwards whatever bytes the client sends.
- No changes to storage upload (original PDF is still archived).
- No UI added for users to control quality / page selection — fully automatic per the requirement.
