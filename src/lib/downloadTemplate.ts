const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Downloads a static template file reliably, regardless of the MIME type the
 * server sends. Some hosts (and the dev server) serve .docx with an empty
 * Content-Type, which makes the browser render the raw bytes instead of saving.
 */
export async function downloadTemplate(path: string, filename?: string) {
  const name = filename || path.split("/").pop() || "template.docx";
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    const blob = new Blob([buf], { type: DOCX_MIME });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    // Last-resort fallback: let the browser handle it
    window.location.href = path;
  }
}
