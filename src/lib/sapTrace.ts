// Frontend tracing helper for SAP-related Supabase function invocations.
// Generates a reqId, forwards it as `x-request-id`, and logs structured
// start/end/error events to the browser console so the full request flow
// (browser → edge function → middleware → SAP) can be correlated by reqId.
//
// Usage:
//   import { supabase } from "@/integrations/supabase/client";
//   import { invokeWithTrace } from "@/lib/sapTrace";
//
//   const { data, error, reqId } = await invokeWithTrace(
//     "fetch-tenants-from-sap",
//     { body: { email } },
//   );
//
// The returned `reqId` is also visible in the browser console — paste it
// into the server-side `grep` recipes in docs/TRACING_FETCH_TENANTS.md.

import { supabase } from "@/integrations/supabase/client";

export function makeReqId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const SENSITIVE_RE = /(secret|password|token|api[-_ ]?key|authorization)/i;

function bodyKeys(body: unknown): string[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) return [];
  return Object.keys(body as Record<string, unknown>).map((k) =>
    SENSITIVE_RE.test(k) ? `${k}(***)` : k,
  );
}

type InvokeOptions = Parameters<typeof supabase.functions.invoke>[1];

export interface TracedInvokeResult<T = unknown> {
  data: T | null;
  error: { message: string; name?: string } | null;
  reqId: string;
  elapsedMs: number;
}

/**
 * Invoke a Supabase Edge Function with end-to-end request tracing.
 * Adds `x-request-id` header and emits console.info/error structured logs.
 */
export async function invokeWithTrace<T = unknown>(
  fn: string,
  options: InvokeOptions = {},
): Promise<TracedInvokeResult<T>> {
  const reqId = makeReqId();
  const started = Date.now();

  const headers = { ...(options?.headers || {}), "x-request-id": reqId };
  const opts: InvokeOptions = { ...options, headers };

  // eslint-disable-next-line no-console
  console.info(
    `[sap-trace] invoke.start fn=${fn} reqId=${reqId}`,
    {
      reqId,
      fn,
      stage: "invoke.start",
      ts: new Date().toISOString(),
      bodyKeys: bodyKeys((options as { body?: unknown })?.body),
    },
  );

  try {
    const { data, error } = await supabase.functions.invoke(fn, opts);
    const elapsedMs = Date.now() - started;

    if (error) {
      // eslint-disable-next-line no-console
      console.error(
        `[sap-trace] invoke.error fn=${fn} reqId=${reqId} elapsedMs=${elapsedMs}`,
        {
          reqId,
          fn,
          stage: "invoke.error",
          elapsedMs,
          message: error.message,
          name: (error as { name?: string }).name ?? null,
        },
      );
    } else {
      // eslint-disable-next-line no-console
      console.info(
        `[sap-trace] invoke.end fn=${fn} reqId=${reqId} elapsedMs=${elapsedMs}`,
        {
          reqId,
          fn,
          stage: "invoke.end",
          elapsedMs,
          ok: true,
          dataKeys:
            data && typeof data === "object" && !Array.isArray(data)
              ? Object.keys(data as Record<string, unknown>)
              : [],
        },
      );
    }

    return {
      data: (data ?? null) as T | null,
      error: error
        ? { message: error.message, name: (error as { name?: string }).name }
        : null,
      reqId,
      elapsedMs,
    };
  } catch (e) {
    const elapsedMs = Date.now() - started;
    const err = e as { message?: string; name?: string; stack?: string };
    // eslint-disable-next-line no-console
    console.error(
      `[sap-trace] invoke.throw fn=${fn} reqId=${reqId} elapsedMs=${elapsedMs}`,
      {
        reqId,
        fn,
        stage: "invoke.throw",
        elapsedMs,
        message: err?.message,
        name: err?.name,
        stack: err?.stack,
      },
    );
    throw e;
  }
}

/**
 * Build a headers object with a fresh reqId pre-populated. Useful when the
 * caller is using `supabase.functions.invoke` directly and only needs the
 * header injected.
 */
export function withReqIdHeaders(
  reqId: string,
  extra: Record<string, string> = {},
): Record<string, string> {
  return { ...extra, "x-request-id": reqId };
}
