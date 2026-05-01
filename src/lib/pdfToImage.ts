/**
 * Normalize an uploaded KYC document into a single image suitable for OCR.
 *
 *  - Image (JPG/JPEG/PNG/WebP) → returned unchanged.
 *  - PDF → every page is rendered with pdf.js, vertically stitched into one
 *    tall canvas, and exported as a single JPEG `File`.
 *  - Anything else → returned unchanged (let the upstream API reject it).
 *
 * pdf.js is loaded dynamically so it doesn't bloat the main bundle.
 */

const MAX_PAGES = 10;
const RENDER_SCALE = 2; // ~200 DPI — readable for OCR without exploding memory
const PAGE_GAP_PX = 16;
const JPEG_QUALITY = 0.92;

function isImage(file: File): boolean {
  if (file.type && file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp)$/i.test(file.name);
}

function isPdf(file: File): boolean {
  if (file.type === "application/pdf") return true;
  return /\.pdf$/i.test(file.name);
}

async function pdfToMergedJpeg(file: File): Promise<File> {
  // Dynamic imports keep pdf.js out of the initial bundle.
  const pdfjs: any = await import("pdfjs-dist/build/pdf.mjs");
  // Vite-friendly worker import
  const worker = await import("pdfjs-dist/build/pdf.worker.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = (worker as any).default;

  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const pageCount = Math.min(pdf.numPages, MAX_PAGES);

  // Render each page to its own offscreen canvas first so we know the final size.
  const pageCanvases: HTMLCanvasElement[] = [];
  let totalHeight = 0;
  let maxWidth = 0;

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    // White background — most KYC docs are dark text on white; keeps JPEG small.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    pageCanvases.push(canvas);
    maxWidth = Math.max(maxWidth, canvas.width);
    totalHeight += canvas.height;
  }

  if (pageCanvases.length === 0) throw new Error("PDF has no pages");

  const gaps = (pageCanvases.length - 1) * PAGE_GAP_PX;
  const combined = document.createElement("canvas");
  combined.width = maxWidth;
  combined.height = totalHeight + gaps;
  const cctx = combined.getContext("2d");
  if (!cctx) throw new Error("Canvas 2D context unavailable");
  cctx.fillStyle = "#ffffff";
  cctx.fillRect(0, 0, combined.width, combined.height);

  let y = 0;
  for (const c of pageCanvases) {
    // Center horizontally if pages have different widths.
    const x = Math.floor((maxWidth - c.width) / 2);
    cctx.drawImage(c, x, y);
    y += c.height + PAGE_GAP_PX;
  }

  const blob: Blob = await new Promise((resolve, reject) => {
    combined.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob returned null"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });

  const baseName = file.name.replace(/\.pdf$/i, "") || "document";
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
}

/**
 * Public entry point — used by OcrUploadAndVerify before calling the OCR provider.
 * Never throws: on any failure it falls back to the original file so the user
 * is not blocked by a converter bug.
 */
export async function normalizeUploadToImage(file: File): Promise<File> {
  try {
    if (isImage(file)) return file;
    if (isPdf(file)) return await pdfToMergedJpeg(file);
    return file;
  } catch (err) {
    console.warn("[pdfToImage] conversion failed, sending original file:", err);
    return file;
  }
}
