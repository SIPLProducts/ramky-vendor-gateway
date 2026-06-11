// Converts ANY uploaded declaration file to a single JPEG image, client-side.
// - PDF: renders each page at a controlled, OCR-safe resolution. For a single
//   page we emit that page directly. For multi-page PDFs we stitch pages
//   vertically, but cap the master canvas to a maximum size so the resulting
//   JPEG is not rejected by upstream OCR providers (Surepass returns
//   `invalid_image` for huge / oddly sized images).
// - PNG/JPG/JPEG/WebP/BMP/GIF: re-encoded to a single JPEG via canvas, also
//   capped to a max edge so HD scans don't blow past provider limits.
// - DOCX: rendered to HTML and captured to a single JPEG.
// - TXT/CSV: rendered as text and captured to a single JPEG.
// - Anything else: throws a clear error.

import * as pdfjsLib from "pdfjs-dist";
// Vite bundles pdf.js worker as a proper module worker. This avoids the
// runtime dynamic import() of `pdf.worker.min.mjs` that fails on some
// self-hosted Nginx setups (MIME / module-script handling over plain HTTP).
// @ts-ignore - vite worker import
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker";

try {
  (pdfjsLib as any).GlobalWorkerOptions.workerPort = new PdfWorker();
} catch (e) {
  console.warn("[pdfToImage] failed to instantiate pdf.js worker", e);
}

// OCR-safe limits. Surepass (and most KYC providers) reject very large or
// very tall images. Keep each page <= ~2200px on its longest edge, and the
// final stitched master <= ~4400px tall.
const MAX_PAGE_EDGE = 2200;
const MAX_MASTER_HEIGHT = 4400;
const JPEG_QUALITY = 0.9;

// PDFs get higher fidelity since we're rasterizing from vector source. The
// extra resolution is essential for OCR to read small details like the IFSC
// code on the MICR line of a cheque.
const MAX_PDF_PAGE_EDGE = 3400;
const MAX_PDF_RENDER_SCALE = 4;
const PDF_JPEG_QUALITY = 0.95;
const SUREPASS_MAX_BYTES = 8 * 1024 * 1024;

function baseName(name: string) {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}

function logConversion(stage: string, info: Record<string, any>) {
  try {
    console.log(`[pdfToImage] ${stage}`, info);
  } catch {}
}

/**
 * Scan raw PDF bytes for a single embedded JPEG (DCTDecode stream) and return
 * its exact bytes. Used to short-circuit scanner-produced PDFs (HP Scan,
 * Canon, etc.) that are just a JPEG wrapped in PDF chrome — rasterizing
 * those via pdf.js softens small text and breaks OCR.
 *
 * Returns null if the PDF is not a simple single-image scan (text-based PDFs,
 * PDFs with multiple large images, PDFs using Flate-encoded image streams,
 * etc.) so the caller can fall back to normal rendering.
 */
function extractEmbeddedJpeg(bytes: Uint8Array): Uint8Array | null {
  // ASCII view of the PDF header/dictionaries. Stream bodies may contain
  // binary, but PDF object dictionaries (`<< ... >>`) are ASCII, so we can
  // safely scan for the markers we need this way.
  let ascii = "";
  // Chunked decode avoids "too many arguments" on big files.
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    ascii += String.fromCharCode.apply(
      null,
      bytes.subarray(i, Math.min(bytes.length, i + CHUNK)) as unknown as number[],
    );
  }

  const found: Array<{ start: number; end: number; length: number }> = [];
  let searchFrom = 0;
  while (true) {
    const dctIdx = ascii.indexOf("/DCTDecode", searchFrom);
    if (dctIdx === -1) break;

    // Walk backwards to the enclosing `<<` so we can read the dict for /Length.
    const dictStart = ascii.lastIndexOf("<<", dctIdx);
    const dictEnd = ascii.indexOf(">>", dctIdx);
    if (dictStart === -1 || dictEnd === -1) {
      searchFrom = dctIdx + 10;
      continue;
    }
    const dict = ascii.slice(dictStart, dictEnd);

    // Find the `stream` keyword after the dict — its body is the JPEG.
    const streamKw = ascii.indexOf("stream", dictEnd);
    if (streamKw === -1) {
      searchFrom = dctIdx + 10;
      continue;
    }
    // PDF spec says CRLF or LF, but some scanners (e.g. HP Scan) emit a
    // lone CR. Handle all three, then if we still aren't at a JPEG SOI,
    // scan forward a few bytes to find it.
    let bodyStart = streamKw + "stream".length;
    if (bytes[bodyStart] === 0x0d && bytes[bodyStart + 1] === 0x0a) bodyStart += 2;
    else if (bytes[bodyStart] === 0x0a) bodyStart += 1;
    else if (bytes[bodyStart] === 0x0d) bodyStart += 1;
    if (!(bytes[bodyStart] === 0xff && bytes[bodyStart + 1] === 0xd8 && bytes[bodyStart + 2] === 0xff)) {
      for (let k = 1; k <= 4; k++) {
        if (bytes[bodyStart + k] === 0xff && bytes[bodyStart + k + 1] === 0xd8 && bytes[bodyStart + k + 2] === 0xff) {
          bodyStart += k;
          break;
        }
      }
    }

    // Prefer the dictionary's /Length (handles JPEGs that contain `endstream`-like byte sequences).
    let bodyEnd = -1;
    const lenMatch = /\/Length\s+(\d+)/.exec(dict);
    if (lenMatch) {
      const declared = parseInt(lenMatch[1], 10);
      if (Number.isFinite(declared) && declared > 0 && bodyStart + declared <= bytes.length) {
        bodyEnd = bodyStart + declared;
      }
    }
    if (bodyEnd === -1) {
      const endIdx = ascii.indexOf("endstream", bodyStart);
      if (endIdx === -1) {
        searchFrom = dctIdx + 10;
        continue;
      }
      // Strip the preceding newline that PDF writers add before `endstream`.
      bodyEnd = endIdx;
      if (bytes[bodyEnd - 1] === 0x0a) bodyEnd--;
      if (bytes[bodyEnd - 1] === 0x0d) bodyEnd--;
    }

    // Validate JPEG SOI marker. If it's not a real JPEG (e.g. /Filter chain
    // wraps DCTDecode with something else), bail on this candidate.
    if (bytes[bodyStart] === 0xff && bytes[bodyStart + 1] === 0xd8 && bytes[bodyStart + 2] === 0xff) {
      found.push({ start: bodyStart, end: bodyEnd, length: bodyEnd - bodyStart });
    }
    searchFrom = bodyEnd > 0 ? bodyEnd : dctIdx + 10;
  }

  if (found.length === 0) return null;
  // Only safe for the "single embedded scan" case. Multiple JPEGs means we
  // don't know which one to send — fall back to rendering the page.
  if (found.length > 1) return null;

  const { start, end } = found[0];
  return bytes.subarray(start, end);
}


async function canvasToJpegFile(
  canvas: HTMLCanvasElement,
  baseFileName: string,
  quality: number = JPEG_QUALITY,
): Promise<File> {
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to encode image"))),
      "image/jpeg",
      quality,
    ),
  );
  return new File([blob], `${baseFileName}.jpg`, { type: "image/jpeg" });
}

/** Encode a PDF-rendered canvas to JPEG, falling back to a lower-res/quality
 *  pass if the result is over the upstream provider's multipart cap. */
async function pdfCanvasToJpegFile(
  canvas: HTMLCanvasElement,
  baseFileName: string,
): Promise<{ file: File; canvas: HTMLCanvasElement }> {
  let out = await canvasToJpegFile(canvas, baseFileName, PDF_JPEG_QUALITY);
  if (out.size <= SUREPASS_MAX_BYTES) return { file: out, canvas };
  const downscaled = fitCanvas(canvas, MAX_PAGE_EDGE);
  out = await canvasToJpegFile(downscaled, baseFileName, JPEG_QUALITY);
  return { file: out, canvas: downscaled };
}

/** Downscale a source canvas in-place so its longest edge <= maxEdge. */
function fitCanvas(src: HTMLCanvasElement, maxEdge: number): HTMLCanvasElement {
  const longest = Math.max(src.width, src.height);
  if (longest <= maxEdge) return src;
  const ratio = maxEdge / longest;
  const dst = document.createElement("canvas");
  dst.width = Math.max(1, Math.floor(src.width * ratio));
  dst.height = Math.max(1, Math.floor(src.height * ratio));
  const ctx = dst.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, dst.width, dst.height);
  ctx.drawImage(src, 0, 0, dst.width, dst.height);
  return dst;
}

async function imageFileToJpeg(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("Could not read the image file."));
      im.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || 1024;
    canvas.height = img.naturalHeight || 1024;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const fitted = fitCanvas(canvas, MAX_PAGE_EDGE);
    const out = await canvasToJpegFile(fitted, baseName(file.name));
    logConversion("image→jpeg", {
      input: { name: file.name, type: file.type, size: file.size },
      output: { name: out.name, type: out.type, size: out.size, w: fitted.width, h: fitted.height },
    });
    return out;
  } catch (err) {
    console.warn("[pdfToImage] image re-encode failed, sending original", err);
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}


async function htmlToImage(html: string, baseFileName: string): Promise<File> {
  const html2canvas = (await import("html2canvas")).default;
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.width = "800px";
  container.style.padding = "32px";
  container.style.background = "#ffffff";
  container.style.color = "#000000";
  container.style.fontFamily = "Arial, sans-serif";
  container.style.fontSize = "14px";
  container.style.lineHeight = "1.5";
  container.style.whiteSpace = "pre-wrap";
  container.innerHTML = html || "<p>(empty document)</p>";
  document.body.appendChild(container);
  try {
    const canvas = await html2canvas(container, {
      backgroundColor: "#ffffff",
      scale: 1.5,
      useCORS: true,
    });
    const fitted = fitCanvas(canvas, MAX_PAGE_EDGE);
    return canvasToJpegFile(fitted, baseFileName);
  } finally {
    document.body.removeChild(container);
  }
}

async function docxToImage(file: File): Promise<File> {
  const mammoth = await import("mammoth/mammoth.browser");
  const arrayBuffer = await file.arrayBuffer();
  const { value: html } = await (mammoth as any).convertToHtml({ arrayBuffer });
  return htmlToImage(html, baseName(file.name));
}

async function textToImage(file: File): Promise<File> {
  const text = await file.text();
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const html = `<pre style="font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px;">${escaped}</pre>`;
  return htmlToImage(html, baseName(file.name));
}

export async function normalizeUploadToImage(
  file: File,
  _mime: "image/jpeg" | "image/png" = "image/jpeg",
  _scale = 1.5,
): Promise<File> {
  const lowerName = file.name.toLowerCase();
  const isPdf =
    file.type === "application/pdf" || lowerName.endsWith(".pdf");
  const isImage =
    /^image\//.test(file.type) || /\.(png|jpe?g|webp|bmp|gif)$/i.test(lowerName);
  const isDocx =
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx");
  const isText =
    file.type.startsWith("text/") ||
    /\.(txt|csv|md|log)$/i.test(lowerName);

  if (isImage) return imageFileToJpeg(file);
  if (isDocx) return docxToImage(file);
  if (isText) return textToImage(file);
  if (!isPdf) {
    throw new Error(
      "Unsupported file type. Please upload a PDF, image (JPG/PNG), DOCX, or TXT/CSV.",
    );
  }

  const buf = await file.arrayBuffer();

  // FAST PATH: many "PDFs" from scanners (HP Scan etc.) are just a single
  // embedded JPEG wrapped in PDF chrome. Re-rendering them via pdf.js +
  // canvas + JPEG re-encode visibly softens small text (e.g. the IFSC line
  // on a cheque) and breaks OCR. If we can detect that, hand the original
  // JPEG bytes straight to the OCR provider — byte-for-byte identical to
  // uploading the JPG directly.
  try {
    const embedded = extractEmbeddedJpeg(new Uint8Array(buf));
    if (embedded && embedded.byteLength <= SUREPASS_MAX_BYTES) {
      const out = new File([embedded.slice().buffer], `${baseName(file.name)}.jpg`, { type: "image/jpeg" });
      logConversion("pdf→embedded-jpeg (lossless)", {
        input: { name: file.name, size: file.size },
        output: { name: out.name, type: out.type, size: out.size },
      });
      return out;
    }
  } catch (extractErr) {
    console.warn("[pdfToImage] embedded JPEG extraction failed, falling back to render", extractErr);
  }

  // Run pdf.js inline (no worker). Self-hosted deployments often serve .mjs
  // with the wrong content-type or block workers via CSP, and we don't want
  // a silent worker failure to leak a raw PDF into the OCR provider.
  let pdf: any;
  try {
    pdf = await (pdfjsLib as any).getDocument({
      data: buf,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;
  } catch (err) {
    // Fall back to the original PDF — many OCR providers (e.g. Surepass)
    // accept PDFs directly. Better to let the server respond than to block
    // the user with a generic "couldn't read" error.
    console.warn("[pdfToImage] getDocument failed, sending original PDF", err);
    return file;
  }



  // Single-page PDFs get the high-fidelity ceiling (essential for OCR of
  // small details like the IFSC line on a cheque). Multi-page PDFs stay at
  // the conservative ceiling so the stitched master stays within limits.
  const isSinglePage = pdf.numPages === 1;
  const perPageEdge = isSinglePage ? MAX_PDF_PAGE_EDGE : MAX_PAGE_EDGE;
  const maxScale = isSinglePage ? MAX_PDF_RENDER_SCALE : 2.5;

  // Render each page at a controlled, OCR-safe size.
  const pageCanvases: HTMLCanvasElement[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    try {
      const page = await pdf.getPage(p);

      const baseViewport = page.getViewport({ scale: 1 });
      const longest = Math.max(baseViewport.width, baseViewport.height) || 1;
      const targetScale = Math.min(maxScale, Math.max(1, perPageEdge / longest));
      const viewport = page.getViewport({ scale: targetScale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;

      pageCanvases.push(fitCanvas(canvas, perPageEdge));
    } catch (pageErr) {
      console.warn(`[pdfToImage] skipping page ${p} due to render error`, pageErr);
    }
  }

  if (pageCanvases.length === 0) {
    console.warn("[pdfToImage] no pages rendered, sending original PDF");
    return file;
  }


  try {
    // Single-page PDF → emit that page directly at high fidelity.
    if (pageCanvases.length === 1) {
      const { file: out, canvas: finalCanvas } = await pdfCanvasToJpegFile(
        pageCanvases[0],
        baseName(file.name),
      );
      logConversion("pdf(1pg)→jpeg", {
        input: { name: file.name, size: file.size, pages: pdf.numPages },
        output: { name: out.name, type: out.type, size: out.size, w: finalCanvas.width, h: finalCanvas.height, quality: PDF_JPEG_QUALITY },
      });
      return out;
    }

    // Multi-page → stitch vertically, then cap master height.
    const maxWidth = pageCanvases.reduce((m, c) => Math.max(m, c.width), 0);
    const totalHeight = pageCanvases.reduce((s, c) => s + c.height, 0);

    const master = document.createElement("canvas");
    master.width = maxWidth;
    master.height = totalHeight;
    const mctx = master.getContext("2d")!;
    mctx.fillStyle = "#ffffff";
    mctx.fillRect(0, 0, master.width, master.height);

    let y = 0;
    for (const c of pageCanvases) {
      const x = Math.floor((maxWidth - c.width) / 2);
      mctx.drawImage(c, x, y);
      y += c.height;
    }

    const capped = master.height > MAX_MASTER_HEIGHT ? fitCanvas(master, MAX_MASTER_HEIGHT) : master;
    const { file: out, canvas: finalCanvas } = await pdfCanvasToJpegFile(capped, baseName(file.name));
    logConversion(`pdf(${pageCanvases.length}pg)→jpeg`, {
      input: { name: file.name, size: file.size, pages: pdf.numPages },
      output: { name: out.name, type: out.type, size: out.size, w: finalCanvas.width, h: finalCanvas.height },
    });
    return out;
  } catch (encodeErr) {
    console.warn("[pdfToImage] encode/stitch failed, sending original PDF", encodeErr);
    return file;
  }
}


export { normalizeUploadToImage as pdfToSingleImage };
