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
// @ts-ignore - vite worker url import
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// OCR-safe limits. Surepass (and most KYC providers) reject very large or
// very tall images. Keep each page <= ~2200px on its longest edge, and the
// final stitched master <= ~4400px tall.
const MAX_PAGE_EDGE = 2200;
const MAX_MASTER_HEIGHT = 4400;
const JPEG_QUALITY = 0.9;

function baseName(name: string) {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}

function logConversion(stage: string, info: Record<string, any>) {
  try {
    console.log(`[pdfToImage] ${stage}`, info);
  } catch {}
}

async function canvasToJpegFile(
  canvas: HTMLCanvasElement,
  baseFileName: string,
): Promise<File> {
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to encode image"))),
      "image/jpeg",
      JPEG_QUALITY,
    ),
  );
  return new File([blob], `${baseFileName}.jpg`, { type: "image/jpeg" });
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

  // Load the PDF via pdf.js. We do NOT silently fall back to the raw PDF —
  // OCR providers like Surepass require an image and will return
  // `no_gstin_detected` if they receive `application/pdf`.
  let pdf: any;
  try {
    pdf = await (pdfjsLib as any).getDocument({
      data: buf,
      useSystemFonts: true,
    }).promise;
  } catch (err: any) {
    console.error("[pdfToImage] getDocument failed", err);
    throw new Error(
      `PDF could not be converted to an image in this browser (${err?.message || err}). ` +
      `Please upload a JPG or PNG of the document instead, or contact your administrator ` +
      `to fix the PDF worker on this server.`,
    );
  }


  // Render each page at a controlled, OCR-safe size.
  const pageCanvases: HTMLCanvasElement[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    try {
      const page = await pdf.getPage(p);

      // Pick a scale so the longer edge lands ~MAX_PAGE_EDGE px. This gives
      // OCR enough resolution without producing giant images.
      const baseViewport = page.getViewport({ scale: 1 });
      const longest = Math.max(baseViewport.width, baseViewport.height) || 1;
      const targetScale = Math.min(2.5, Math.max(1, MAX_PAGE_EDGE / longest));
      const viewport = page.getViewport({ scale: targetScale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;

      pageCanvases.push(fitCanvas(canvas, MAX_PAGE_EDGE));
    } catch (pageErr) {
      console.warn(`[pdfToImage] skipping page ${p} due to render error`, pageErr);
    }
  }

  if (pageCanvases.length === 0) {
    throw new Error(
      "Could not render any page of the PDF to an image. Please upload a JPG or PNG instead.",
    );
  }


  try {
    // Single-page PDF → emit that page directly.
    if (pageCanvases.length === 1) {
      const out = await canvasToJpegFile(pageCanvases[0], baseName(file.name));
      logConversion("pdf(1pg)→jpeg", {
        input: { name: file.name, size: file.size, pages: pdf.numPages },
        output: { name: out.name, type: out.type, size: out.size, w: pageCanvases[0].width, h: pageCanvases[0].height },
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
    const out = await canvasToJpegFile(capped, baseName(file.name));
    logConversion(`pdf(${pageCanvases.length}pg)→jpeg`, {
      input: { name: file.name, size: file.size, pages: pdf.numPages },
      output: { name: out.name, type: out.type, size: out.size, w: capped.width, h: capped.height },
    });
    return out;
  } catch (encodeErr) {
    console.warn("[pdfToImage] encode/stitch failed, sending original PDF", encodeErr);
    return file;
  }
}


export { normalizeUploadToImage as pdfToSingleImage };
