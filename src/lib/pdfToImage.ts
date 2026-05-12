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

async function docxToImage(
  file: File,
  mime: "image/jpeg" | "image/png",
): Promise<File> {
  const mammoth = await import("mammoth/mammoth.browser");
  const html2canvas = (await import("html2canvas")).default;

  const arrayBuffer = await file.arrayBuffer();
  const { value: html } = await (mammoth as any).convertToHtml({ arrayBuffer });

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
  container.innerHTML = html || "<p>(empty document)</p>";
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      backgroundColor: "#ffffff",
      scale: 1.5,
      useCORS: true,
    });
    return await canvasToImageFile(canvas, baseName(file.name), mime);
  } finally {
    document.body.removeChild(container);
  }
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
    IMAGE_MIMES.includes(file.type) || /\.(png|jpe?g)$/i.test(file.name);
  const isDocx =
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx");

  if (isImage) return file;
  if (isDocx) return docxToImage(file, mime);
  if (!isPdf) {
    throw new Error(
      "Unsupported file type. Please upload PDF, DOCX, or an image.",
    );
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
