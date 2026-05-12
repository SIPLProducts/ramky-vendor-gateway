// Converts an uploaded declaration file to a single image (JPEG by default).
// - PDF: renders all pages and stitches them vertically into one image.
// - PNG/JPG/JPEG: returned unchanged.
// - Other types: throws.

import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - vite worker url import
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const IMAGE_MIMES = ["image/png", "image/jpeg", "image/jpg"];

function baseName(name: string) {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}

export async function normalizeUploadToImage(
  file: File,
  mime: "image/jpeg" | "image/png" = "image/jpeg",
  scale = 1.5,
): Promise<File> {
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isImage =
    IMAGE_MIMES.includes(file.type) ||
    /\.(png|jpe?g)$/i.test(file.name);

  if (isImage) return file;
  if (!isPdf) {
    throw new Error("Unsupported file type. Please upload a PDF or image.");
  }

  const buf = await file.arrayBuffer();
  const pdf = await (pdfjsLib as any).getDocument({ data: buf }).promise;

  const pageCanvases: HTMLCanvasElement[] = [];
  let maxWidth = 0;
  let totalHeight = 0;

  for (let p = 1; p <= pdf.numPages; p++) {
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

  const blob: Blob = await new Promise((resolve, reject) =>
    master.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to encode image"))),
      mime,
      0.92,
    ),
  );

  const ext = mime === "image/png" ? "png" : "jpg";
  return new File([blob], `${baseName(file.name)}.${ext}`, { type: mime });
}

export { normalizeUploadToImage as pdfToSingleImage };
