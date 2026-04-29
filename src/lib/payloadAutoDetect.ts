// Utilities to parse uploaded sample payloads and auto-detect fields
// for SAP API Request / Response configuration.

export type DetectedRequestField = {
  field_name: string;
  source?: string;
  default_value?: string;
  required?: boolean;
};

export type DetectedResponseField = {
  field_name: string;
  target_column?: string;
};

/** Parse text into JSON or simple CSV object array. */
export function parsePayload(text: string): any {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Empty payload");

  // Try JSON first
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }

  // Fallback: simple CSV (comma + newline, header row)
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) throw new Error("Unrecognised payload format");
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = cells[i] ?? ""));
    return obj;
  });
  return rows;
}

/** Pick the first sample object out of common SAP / OData wrappers. */
export function extractSample(payload: any): Record<string, any> {
  if (!payload) return {};
  // OData v2: { d: { results: [...] } } or { d: {...} }
  if (payload.d) {
    if (Array.isArray(payload.d.results)) return payload.d.results[0] || payload.d;
    if (typeof payload.d === "object") return payload.d;
  }
  // OData v4: { value: [...] }
  if (Array.isArray(payload.value)) return payload.value[0] || {};
  // Direct array
  if (Array.isArray(payload)) return payload[0] || {};
  // Plain object
  if (typeof payload === "object") return payload;
  return {};
}

/** Flatten nested object into leaf paths. Arrays use [0] notation. */
export function flattenFields(
  obj: any,
  prefix = "",
  out: Array<{ path: string; leaf: string; value: any }> = [],
): Array<{ path: string; leaf: string; value: any }> {
  if (obj === null || obj === undefined) {
    if (prefix) out.push({ path: prefix, leaf: leafName(prefix), value: obj });
    return out;
  }
  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      out.push({ path: `${prefix}[]`, leaf: leafName(prefix), value: [] });
    } else {
      flattenFields(obj[0], `${prefix}[0]`, out);
    }
    return out;
  }
  if (typeof obj === "object") {
    for (const key of Object.keys(obj)) {
      const next = prefix ? `${prefix}.${key}` : key;
      const val = obj[key];
      if (val !== null && typeof val === "object") {
        flattenFields(val, next, out);
      } else {
        out.push({ path: next, leaf: key, value: val });
      }
    }
    return out;
  }
  out.push({ path: prefix, leaf: leafName(prefix), value: obj });
  return out;
}

function leafName(path: string): string {
  const parts = path.split(".");
  return parts[parts.length - 1].replace(/\[\d+\]$/, "");
}

/** Convert "BPartnerID" or "BP_LIFNR" → "bp_lifnr" */
export function snakeCase(s: string): string {
  return s
    .replace(/\[\d+\]/g, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s\-.]+/g, "_")
    .replace(/__+/g, "_")
    .toLowerCase();
}

export function detectRequestFields(payload: any): DetectedRequestField[] {
  const sample = extractSample(payload);
  const fields = flattenFields(sample);
  const seen = new Set<string>();
  const out: DetectedRequestField[] = [];
  for (const f of fields) {
    if (seen.has(f.leaf)) continue;
    seen.add(f.leaf);
    const val = f.value;
    out.push({
      field_name: f.leaf,
      source: f.path,
      default_value:
        val === null || val === undefined || typeof val === "object"
          ? ""
          : String(val),
      required: val !== null && val !== undefined && val !== "",
    });
  }
  return out;
}

export function detectResponseFields(payload: any): DetectedResponseField[] {
  const sample = extractSample(payload);
  const fields = flattenFields(sample);
  const seen = new Set<string>();
  const out: DetectedResponseField[] = [];
  for (const f of fields) {
    if (seen.has(f.leaf)) continue;
    seen.add(f.leaf);
    out.push({
      field_name: f.leaf,
      target_column: snakeCase(f.leaf),
    });
  }
  return out;
}
