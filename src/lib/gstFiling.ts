import { normalizeFilingStatus, type FilingStatusRow } from "@/components/vendor/kyc/GstFilingStatusTable";

/**
 * Choose the GST filing rows to show/save.
 * GST_FILING (fuller history) wins; otherwise fall back to the rows returned
 * by the main GST call. Returns [] when neither has rows — callers must never
 * overwrite saved rows with this empty result.
 */
export function pickFilingRows(filingResp: unknown, gstResp: unknown): { rows: FilingStatusRow[]; source: "GST_FILING" | "GST" | "none" } {
  const primary = normalizeFilingStatus(filingResp);
  if (primary.length) return { rows: primary, source: "GST_FILING" };
  const fallback = normalizeFilingStatus(gstResp);
  if (fallback.length) return { rows: fallback, source: "GST" };
  return { rows: [], source: "none" };
}
