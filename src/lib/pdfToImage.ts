// Converts ANY uploaded declaration file to a single JPEG image, client-side.
// - PDF: renders all pages and stitches them vertically into one JPEG.
// - PNG/JPG/JPEG/WebP/BMP/GIF: re-encoded to a single JPEG via canvas.
// - DOCX: rendered to HTML and captured to a single JPEG.
// - TXT/CSV: rendered as text and captured to a single JPEG.
// - Anything else: throws a clear error.

import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - vite worker url import
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function baseName(name: string) {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}

async function canvasToImageFile(
  canvas: HTMLCanvasElement,
  baseFileName: string,
  mime: "image/jpeg" | "image/png",
): Promise<File> {
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to encode image"))),
      mime,
      0.92,
    ),
  );
  const ext = mime === "image/png" ? "png" : "jpg";
  return new File([blob], `${baseFileName}.${ext}`, { type: mime });
}

async function imageFileToJpeg(file: File, mime: "image/jpeg" | "image/png"): Promise<File> {
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
    return await canvasToImageFile(canvas, baseName(file.name), mime);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function htmlToImage(
  html: string,
  baseFileName: string,
  mime: "image/jpeg" | "image/png",
): Promise<File> {
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
    return await canvasToImageFile(canvas, baseFileName, mime);
  } finally {
    document.body.removeChild(container);
  }
}

async function docxToImage(file: File, mime: "image/jpeg" | "image/png"): Promise<File> {
  const mammoth = await import("mammoth/mammoth.browser");
  const arrayBuffer = await file.arrayBuffer();
  const { value: html } = await (mammoth as any).convertToHtml({ arrayBuffer });
  return htmlToImage(html, baseName(file.name), mime);
}

async function textToImage(file: File, mime: "image/jpeg" | "image/png"): Promise<File> {
  const text = await file.text();
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const html = `<pre style="font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px;">${escaped}</pre>`;
  return htmlToImage(html, baseName(file.name), mime);
}

export async function normalizeUploadToImage(
  file: File,
  mime: "image/jpeg" | "image/png" = "image/jpeg",
  scale = 1.5,
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

  if (isImage) return imageFileToJpeg(file, mime);
  if (isDocx) return docxToImage(file, mime);
  if (isText) return textToImage(file, mime);
  if (!isPdf) {
    throw new Error(
      "This file type can't be converted in the browser. Please upload a PDF, DOCX, image (JPG/PNG/WebP/BMP/GIF), or TXT/CSV.",
    );
  }

  const buf = await file.arrayBuffer();

  // Try to load the PDF with the worker; if the worker fails (common when
  // nginx serves .mjs with the wrong content-type or CSP blocks it), retry
  // once with the worker disabled before giving up.
  let pdf: any;
  try {
    pdf = await (pdfjsLib as any).getDocument({ data: buf }).promise;
  } catch (err) {
    console.warn("[pdfToImage] worker getDocument failed, retrying without worker", err);
    try {
      pdf = await (pdfjsLib as any).getDocument({ data: buf, disableWorker: true }).promise;
    } catch (err2) {
      throw new Error(
        `PDF_CONVERSION_FAILED: getDocument: ${(err2 as Error)?.message || err2}`,
      );
    }
  }

  const pageCanvases: HTMLCanvasElement[] = [];
  let maxWidth = 0;
  let totalHeight = 0;

  for (let p = 1; p <= pdf.numPages; p++) {
    try {
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      pageCanvases.push(canvas);
      maxWidth = Math.max(maxWidth, canvas.width);
      totalHeight += canvas.height;
    } catch (pageErr) {
      // Don't abort the whole document just because one page failed.
      console.warn(`[pdfToImage] skipping page ${p} due to render error`, pageErr);
    }
  }

  if (pageCanvases.length === 0) {
    throw new Error("PDF_CONVERSION_FAILED: no pages could be rendered");
  }

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

  return canvasToImageFile(master, baseName(file.name), mime);
}

export { normalizeUploadToImage as pdfToSingleImage };
