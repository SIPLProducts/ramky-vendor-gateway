// Helpers for building the SAP DMS FILE_UPLOAD payload in the browser.

const DMS_PATH_PREFIX = "C:/Users/ADMIN/OneDrive/Desktop/";

/**
 * Rewrites a Supabase Storage path (e.g. "vendor-documents/<vendor>/<file>")
 * into the Windows filesystem path expected by SAP DMS.
 */
export function toDmsPath(storagePath: string): string {
  const p = storagePath || "";
  if (p.startsWith(DMS_PATH_PREFIX)) return p;
  const parts = p.split("/");
  const rest = parts.length > 1 ? parts.slice(1).join("/") : parts.join("/");
  return DMS_PATH_PREFIX + rest;
}

/**
 * Base64-encodes a Blob in the browser without blowing the call stack on
 * large files. Uses chunked String.fromCharCode over a Uint8Array.
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000; // 32KB
  for (let i = 0; i < buf.length; i += chunk) {
    const slice = buf.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(
      null,
      Array.from(slice) as unknown as number[],
    );
  }
  return btoa(binary);
}
