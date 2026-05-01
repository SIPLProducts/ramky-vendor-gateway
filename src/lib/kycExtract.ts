/**
 * Helpers for normalising KYC OCR responses.
 *
 * Background: the kyc-api-execute edge function applies an admin-configured
 * `response_data_mapping` to the upstream provider payload to produce a clean
 * `data` object. When that mapping is incomplete or misconfigured (entries
 * stored as objects instead of string paths), `data` ends up missing the
 * actual extracted fields — even though the values are still present in
 * `raw.data` from the provider.
 *
 * `mergeOcrExtracted` merges `raw.data` into `data` (data wins) so downstream
 * consumers always see the extracted fields when the upstream call succeeded.
 * It also unwraps `{ value, confidence }` shells (Surepass OCR) at the top
 * level so consumers can read plain strings.
 */

function unwrapValue(v: any): any {
  if (v && typeof v === 'object' && !Array.isArray(v) && 'value' in v) {
    return (v as any).value;
  }
  return v;
}

/**
 * Returns a single flat object combining the mapped `data` with any
 * additional fields present in `raw.data`. Mapped data takes precedence;
 * raw fields fill in the gaps. Top-level `{value, confidence}` objects are
 * unwrapped to their `value`.
 */
export function mergeOcrExtracted(
  data: Record<string, any> | undefined,
  raw: any,
): Record<string, any> {
  const out: Record<string, any> = {};
  const rawData =
    raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object'
      ? raw.data
      : null;

  if (rawData) {
    for (const [k, v] of Object.entries(rawData)) {
      out[k] = unwrapValue(v);
    }
  }
  if (data) {
    for (const [k, v] of Object.entries(data)) {
      const unwrapped = unwrapValue(v);
      // Prefer mapped data only if it actually carries a usable value —
      // generic flags like `message: true` shouldn't overwrite the real
      // extracted string from raw.data.
      if (
        unwrapped !== undefined &&
        unwrapped !== null &&
        unwrapped !== '' &&
        typeof unwrapped !== 'boolean'
      ) {
        out[k] = unwrapped;
      } else if (!(k in out)) {
        out[k] = unwrapped;
      }
    }
  }

  return out;
}
