import { Badge } from "@/components/ui/badge";

/**
 * Generic renderer for whatever a configured KYC/OCR API returned.
 *
 * Nothing about field names is hardcoded — we walk the `data` object the
 * edge function gave us (or fall back to `raw.data` / `raw`) and render
 * every non-empty value. This is what the vendor and admin see after an
 * upload, so it must reflect the upstream provider exactly.
 */

interface ApiResponseDetailsProps {
  /** The result returned by `useConfiguredKycApi.callProvider` (KycApiResult-shaped). */
  result: {
    ok?: boolean;
    success?: boolean;
    status_code?: number;
    status?: number;
    message?: string;
    message_code?: string | null;
    provider_name?: string;
    endpoint_url?: string;
    data?: Record<string, any>;
    raw?: any;
  } | null | undefined;
  /** Optional title shown above the response body (e.g. "GST OCR response"). */
  title?: string;
}

function prettifyKey(key: string) {
  return key
    .replace(/[_\-\.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderValue(value: any): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value || "—";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function pickPayload(result: ApiResponseDetailsProps["result"]): Record<string, any> {
  if (!result) return {};
  // Prefer the mapped `data` from the edge function.
  if (result.data && typeof result.data === "object" && Object.keys(result.data).length > 0) {
    return result.data;
  }
  // Fall back to upstream raw response payload.
  const raw = result.raw;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const inner = (raw as any).data;
    if (inner && typeof inner === "object" && !Array.isArray(inner)) return inner;
    // Strip envelope keys so we focus on the payload.
    const envelope = new Set(["status_code", "success", "message", "message_code"]);
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(raw as Record<string, any>)) {
      if (!envelope.has(k)) out[k] = v;
    }
    return out;
  }
  return {};
}

export function ApiResponseDetails({ result, title }: ApiResponseDetailsProps) {
  if (!result) return null;
  const payload = pickPayload(result);
  const entries = Object.entries(payload).filter(
    ([, v]) => v !== null && v !== undefined && !(typeof v === "string" && v.trim() === ""),
  );

  const ok = result.ok && result.success !== false;
  const statusCode = result.status_code ?? result.status;

  return (
    <div className="rounded-md border bg-card text-xs">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b">
        <span className="font-medium text-foreground">
          {title || "API response"}
        </span>
        <Badge variant={ok ? "default" : "destructive"} className="capitalize">
          {ok ? "success" : "failed"}
        </Badge>
        {result.provider_name && (
          <Badge variant="outline">{result.provider_name}</Badge>
        )}
        {statusCode != null && (
          <Badge variant="outline">status {statusCode}</Badge>
        )}
        {result.message_code && (
          <Badge variant="outline">code: {result.message_code}</Badge>
        )}
        {result.message && (
          <span className="text-muted-foreground truncate" title={result.message}>
            {result.message}
          </span>
        )}
      </div>

      {entries.length > 0 ? (
        <div className="divide-y">
          {entries.map(([key, value]) => (
            <div
              key={key}
              className="grid grid-cols-[1fr,2fr] gap-3 px-3 py-2 items-start"
            >
              <span className="text-muted-foreground">{prettifyKey(key)}</span>
              <span className="break-words font-mono text-[11px] leading-snug">
                {renderValue(value)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-3 py-3 text-muted-foreground">
          The API did not return any field values.
        </div>
      )}

      {result.raw !== undefined && (
        <details className="border-t px-3 py-2">
          <summary className="cursor-pointer text-muted-foreground select-none">
            View raw response
          </summary>
          <pre className="mt-2 bg-muted p-2 rounded overflow-auto max-h-64 text-[11px]">
            {(() => {
              try {
                return JSON.stringify(result.raw, null, 2);
              } catch {
                return String(result.raw);
              }
            })()}
          </pre>
        </details>
      )}
    </div>
  );
}
