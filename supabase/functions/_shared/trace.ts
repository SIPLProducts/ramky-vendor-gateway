// Shared structured-tracing helper for all SAP-touching edge functions.
// Every layer (edge function, middleware, SAP) correlates by a single reqId.
//
// Usage:
//   const reqId = makeReqId(req);
//   const t = (stage: string, fields?: Record<string, unknown>) =>
//     trace(reqId, "my-fn", stage, fields);
//   t("req.received", { method: req.method });
//   const res = await traceFetch(reqId, "my-fn", url, init);
//
// Output is one JSON line per event so the full chain can be grepped by reqId.

const SENSITIVE_HEADER_RE =
  /^(authorization|x-middleware-key|apikey|cookie|proxy-authorization|x-api-key)$/i;
const SENSITIVE_BODY_RE =
  /(secret|password|token|api[-_ ]?key|authorization|service[-_ ]?role)/i;

export function makeReqId(req?: Request): string {
  const incoming = req?.headers?.get("x-request-id");
  if (incoming && incoming.trim()) return incoming.trim();
  try {
    return crypto.randomUUID();
  } catch {
    return `r-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function trace(
  reqId: string,
  svc: string,
  stage: string,
  fields: Record<string, unknown> = {},
): void {
  try {
    console.log(JSON.stringify({
      svc,
      reqId,
      stage,
      ts: new Date().toISOString(),
      ...fields,
    }));
  } catch {
    console.log(`[${svc}] reqId=${reqId} stage=${stage} (unserializable fields)`);
  }
}

export function headerKeys(h: HeadersInit | Headers | undefined | null): string[] {
  if (!h) return [];
  if (h instanceof Headers) return Array.from(h.keys());
  if (Array.isArray(h)) return h.map((p) => p[0]);
  return Object.keys(h as Record<string, string>);
}

export function headerPresence(
  h: HeadersInit | Headers | undefined | null,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!h) return out;
  const entries: [string, string][] = h instanceof Headers
    ? Array.from(h.entries())
    : Array.isArray(h)
      ? (h as [string, string][])
      : Object.entries(h as Record<string, string>);
  for (const [k] of entries) {
    out[k] = SENSITIVE_HEADER_RE.test(k) ? "***" : "present";
  }
  return out;
}

export function maskBody(input: unknown, depth = 0): unknown {
  if (depth > 4) return "[depth-cap]";
  if (input == null) return input;
  if (Array.isArray(input)) return input.slice(0, 10).map((v) => maskBody(v, depth + 1));
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = SENSITIVE_BODY_RE.test(k) ? "***" : maskBody(v, depth + 1);
    }
    return out;
  }
  if (typeof input === "string" && input.length > 500) {
    return `${input.slice(0, 500)}…(${input.length}b)`;
  }
  return input;
}

export function safePreview(text: string | null | undefined, n = 500): string {
  if (!text) return "";
  return text.length > n ? `${text.slice(0, n)}…(${text.length}b)` : text;
}

export function summarizeError(e: unknown): Record<string, unknown> {
  const err = e as {
    name?: string;
    message?: string;
    code?: string;
    stack?: string;
    cause?: { code?: string; message?: string };
  } | null;
  return {
    errorName: err?.name ?? null,
    errorMessage: err?.message ?? String(e),
    errorCode: err?.code ?? null,
    causeCode: err?.cause?.code ?? null,
    causeMessage: err?.cause?.message ?? null,
    stack: err?.stack ?? null,
  };
}

/**
 * Wrap a fetch() call with start/end/error tracing. Forwards `x-request-id`
 * to the upstream automatically. Returns the same Response so callers can
 * .text()/.json() normally.
 */
export async function traceFetch(
  reqId: string,
  svc: string,
  url: string,
  init: RequestInit = {},
  opts: { label?: string; previewBody?: boolean } = {},
): Promise<Response> {
  const label = opts.label ?? "upstream";
  const method = (init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers || {});
  if (!headers.has("x-request-id")) headers.set("x-request-id", reqId);
  init.headers = headers;

  const bodyStr = typeof init.body === "string" ? init.body : null;
  trace(reqId, svc, `${label}.prepared`, {
    url,
    method,
    headerKeys: headerKeys(headers),
    headerPresence: headerPresence(headers),
    payloadBytes: bodyStr ? bodyStr.length : (init.body ? -1 : 0),
  });

  const started = Date.now();
  trace(reqId, svc, `${label}.fetch.start`, { startedAt: new Date(started).toISOString() });
  try {
    const res = await fetch(url, init);
    const elapsedMs = Date.now() - started;
    trace(reqId, svc, `${label}.fetch.end`, {
      elapsedMs,
      status: res.status,
      statusText: res.statusText,
      responseHeaderKeys: headerKeys(res.headers),
      contentLength: Number(res.headers.get("content-length") || 0),
    });
    return res;
  } catch (e) {
    const elapsedMs = Date.now() - started;
    const aborted = (e as { name?: string })?.name === "AbortError" ||
      /aborted/i.test(String((e as { message?: string })?.message || ""));
    trace(reqId, svc, `${label}.fetch.error`, {
      elapsedMs,
      aborted,
      ...summarizeError(e),
    });
    throw e;
  }
}
