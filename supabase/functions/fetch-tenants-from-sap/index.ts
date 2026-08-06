import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Structured one-line JSON logger. Every event carries the same reqId so the
// full chain (edge -> middleware -> SAP) can be grepped by request id.
function trace(reqId: string, stage: string, fields: Record<string, unknown> = {}) {
  try {
    console.log(JSON.stringify({
      svc: "fetch-tenants-from-sap",
      reqId,
      stage,
      ts: new Date().toISOString(),
      ...fields,
    }));
  } catch {
    console.log(`[fetch-tenants-from-sap] reqId=${reqId} stage=${stage} (unserializable fields)`);
  }
}

function headerKeys(h: Headers | Record<string, string> | undefined): string[] {
  if (!h) return [];
  if (h instanceof Headers) return Array.from(h.keys());
  return Object.keys(h);
}

function parseHostRewrites(): { from: string; to: string }[] {
  return (Deno.env.get("SAP_MIDDLEWARE_HOST_REWRITES") || "")
    .split(",").map((s) => s.trim()).filter(Boolean)
    .map((pair) => { const [f, t] = pair.split("="); return { from: (f || "").trim(), to: (t || "").trim() }; })
    .filter((p) => p.from && p.to);
}
function rewriteContainerHost(u: string, reqId?: string): string {
  if (!u) return u;
  try {
    const url = new URL(u);
    const hit = parseHostRewrites().find((r) => r.from === url.hostname);
    if (hit) {
      const original = url.hostname;
      url.hostname = hit.to;
      const rewritten = url.toString().replace(/\/+$/, "");
      if (reqId) trace(reqId, "middleware.url.rewritten", { from: original, to: hit.to, finalUrl: rewritten, source: "host-rewrite-list" });
      return rewritten;
    }
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
      const original = url.hostname;
      url.hostname = "172.17.0.1";
      const rewritten = url.toString().replace(/\/+$/, "");
      if (reqId) trace(reqId, "middleware.url.rewritten", { from: original, to: "172.17.0.1", finalUrl: rewritten, source: "loopback" });
      return rewritten;
    }
  } catch { /* ignore */ }
  return u;
}

function normalizeMiddlewareBase(raw: string, reqId?: string): string {
  const override = (Deno.env.get("SAP_MIDDLEWARE_URL_OVERRIDE") || "").trim();
  const source = override || String(raw || "");
  if (override && reqId) trace(reqId, "middleware.url.override", { usingEnvOverride: true });
  let v = source.replace(/\s+/g, "").trim().replace(/\/+$/, "");
  v = v.replace(/\/sap\/bp\/create$/i, "")
       .replace(/\/sap\/proxy$/i, "")
       .replace(/\/health$/i, "")
       .replace(/\/+$/, "");
  return rewriteContainerHost(v, reqId);
}

// Best-effort extraction of a list of tenants from whatever SAP returns.
function extractTenants(sapJson: any): { code: string; name: string; raw: any }[] {
  if (!sapJson) return [];

  const candidates: any[] = [];
  if (Array.isArray(sapJson)) candidates.push(sapJson);
  for (const k of [
    "TENANTS", "tenants", "Tenants",
    "COMPANIES", "companies", "Companies",
    "COMPANY_CODE", "company_codes", "CompanyCodes",
    "BUKRS_LIST", "data", "DATA", "result", "RESULT",
    "items", "ITEMS", "value", "VALUE",
  ]) {
    if (Array.isArray(sapJson?.[k])) candidates.push(sapJson[k]);
  }

  const arr = candidates.find((a) => Array.isArray(a) && a.length > 0) ?? [];

  const codeKeys = ["BUKRS", "TENANT_ID", "TenantId", "tenant_id", "Code", "CODE", "code", "id", "ID"];
  const nameKeys = ["BUTXT", "TENANT_NAME", "TenantName", "tenant_name", "Name", "NAME", "name", "description", "DESCRIPTION"];

  const out: { code: string; name: string; raw: any }[] = [];
  const seen = new Set<string>();
  for (const item of arr) {
    if (item == null) continue;
    if (typeof item === "string") {
      const c = item.trim();
      if (c && !seen.has(c)) { seen.add(c); out.push({ code: c, name: c, raw: item }); }
      continue;
    }
    let code: string | null = null;
    let name: string | null = null;
    for (const k of codeKeys) {
      if (item[k] != null && String(item[k]).trim() !== "") { code = String(item[k]).trim(); break; }
    }
    for (const k of nameKeys) {
      if (item[k] != null && String(item[k]).trim() !== "") { name = String(item[k]).trim(); break; }
    }
    if (!code && name) code = name;
    if (!name && code) name = code;
    if (!code) continue;
    if (seen.has(code)) continue;
    seen.add(code);
    out.push({ code, name: name!, raw: item });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const reqId = req.headers.get("x-request-id") || crypto.randomUUID();
  const tStart = Date.now();

  trace(reqId, "req.received", {
    method: req.method,
    url: req.url,
    userAgent: req.headers.get("user-agent") || null,
    incomingHeaderKeys: headerKeys(req.headers),
  });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      trace(reqId, "auth.missing", {});
      return json({ error: "Unauthorized" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      trace(reqId, "auth.failed", { error: userErr?.message || "no user" });
      return json({ error: "Unauthorized" }, 401);
    }
    trace(reqId, "auth.ok", { userId: userData.user.id, email: userData.user.email });

    const body = await req.json().catch(() => ({}));
    const email: string = String(body?.email || "").trim();
    trace(reqId, "body.parsed", { email });
    if (!email || !/.+@.+\..+/.test(email)) {
      return json({ success: false, message: "Valid email is required." }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: config, error: cfgErr } = await admin
      .from("sap_api_configs")
      .select("*")
      .eq("name", "Tenants From SAP")
      .eq("is_active", true)
      .maybeSingle();

    if (cfgErr) throw cfgErr;
    if (!config) {
      trace(reqId, "config.missing", {});
      return json({ success: false, message: "SAP API config 'Tenants From SAP' not found or inactive." });
    }

    const base = (config.base_url || "").replace(/\/$/, "");
    const path = config.endpoint_path || "";
    const sapUrl = `${base}${path}`;
    const httpMethod = (config.http_method || "POST").toUpperCase();
    const connectionMode = (config.connection_mode || "direct").toLowerCase();
    const normalizedMiddlewareBase = normalizeMiddlewareBase(config.middleware_url || "", reqId);

    trace(reqId, "config.loaded", {
      configId: config.id,
      name: config.name,
      connection_mode: connectionMode,
      base_url: base,
      endpoint_path: path,
      sapUrl,
      httpMethod,
      timeout_ms: config.timeout_ms ?? null,
      middleware_url_normalized: normalizedMiddlewareBase,
      proxySecretPresent: Boolean((config.proxy_secret || "").trim()),
      authType: config.auth_type || null,
    });

    if (!sapUrl) {
      return json({ success: false, message: "Tenants From SAP: base_url + endpoint_path missing." });
    }

    const { data: creds } = await admin
      .from("sap_api_credentials")
      .select("*")
      .eq("config_id", config.id)
      .maybeSingle();

    const directHeaders: Record<string, string> = {
      "Accept": "application/json",
      "Content-Type": "application/json",
    };
    if (config.auth_type === "Basic" && creds?.username) {
      directHeaders["Authorization"] = `Basic ${btoa(`${creds.username}:${creds.password_encrypted ?? ""}`)}`;
    } else if (config.auth_type === "Bearer" && creds?.password_encrypted) {
      directHeaders["Authorization"] = `Bearer ${creds.password_encrypted}`;
    }

    let sapJson: any = null;
    let networkError: string | null = null;
    let errorHint: string | null = null;
    let attemptedUrl: string = sapUrl;
    const requestBody = { UMAIL: email };


    // Honor configured timeout; clamp under Edge runtime wall-clock so failures surface as JSON error.
    const rawTimeout = Number(config.timeout_ms) || 30000;
    const abortMs = Math.min(Math.max(rawTimeout, 5000), 25000);

    const controller = new AbortController();
    let timerFired = false;
    const timer = setTimeout(() => { timerFired = true; controller.abort("in-code-timeout"); }, abortMs);

    const fetchStarted = Date.now();
    try {
      if (connectionMode === "proxy") {
        if (!normalizedMiddlewareBase) {
          clearTimeout(timer);
          trace(reqId, "proxy.config.missing", { reason: "middleware_url empty" });
          return json({
            success: false,
            message: "SAP middleware URL is not configured for 'Tenants From SAP'.",
            hint: "Open SAP API Settings → Tenants From SAP and set the Node.js Middleware URL and Proxy Secret.",
          });
        }
        const middlewareKey = (config.proxy_secret || "").trim();
        if (!middlewareKey) {
          clearTimeout(timer);
          trace(reqId, "proxy.config.missing", { reason: "proxy_secret empty" });
          return json({ success: false, message: "Proxy Secret is not set for 'Tenants From SAP'." });
        }
        const proxyUrl = `${normalizedMiddlewareBase}/sap/proxy`;
        attemptedUrl = proxyUrl;
        const outgoingHeaders: Record<string, string> = {
          "Content-Type": "application/json",
          "x-middleware-key": middlewareKey,
          "x-request-id": reqId,
        };
        const proxyPayload = {
          url: sapUrl,
          method: httpMethod,
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: requestBody,
          useBasicAuth: true,
        };
        trace(reqId, "proxy.prepared", {
          proxyUrl,
          abortMs,
          outgoingHeaderKeys: headerKeys(outgoingHeaders),
          payloadKeys: Object.keys(proxyPayload),
        });
        trace(reqId, "proxy.fetch.start", { startedAt: new Date(fetchStarted).toISOString() });
        const res = await fetch(proxyUrl, {
          method: "POST",
          headers: outgoingHeaders,
          body: JSON.stringify(proxyPayload),
          signal: controller.signal,
        });
        const elapsed = Date.now() - fetchStarted;
        const text = await res.text();
        trace(reqId, "proxy.fetch.end", {
          elapsedMs: elapsed,
          status: res.status,
          statusText: res.statusText,
          responseHeaderKeys: headerKeys(res.headers),
          contentLength: text.length,
          bodyPreview: text.slice(0, 500),
        });
        if (!res.ok) {
          networkError = `Middleware HTTP ${res.status}: ${text.slice(0, 300)}`;
          if (res.status === 401 || res.status === 403) {
            errorHint = `The middleware at ${proxyUrl} rejected the Proxy Secret. Make sure the Proxy Secret in SAP API Settings matches MIDDLEWARE_SHARED_SECRET in this environment's middleware/.env (DEV and PROD use different values).`;
          } else if (res.status === 502 || res.status === 503 || res.status === 504) {
            errorHint = `The middleware at ${proxyUrl} could not reach SAP at ${sapUrl}. Check SAP_BP_API_URL in middleware/.env and that its host matches the Base URL configured here.`;
          } else {
            errorHint = `Called ${proxyUrl}.`;
          }
        }
        } else {
          let wrapper: any = null;
          try { wrapper = JSON.parse(text); }
          catch { networkError = `Invalid JSON from middleware: ${text.slice(0, 200)}`; }
          if (wrapper) {
            if (wrapper.ok === false) {
              networkError = `Middleware error: ${wrapper.error || JSON.stringify(wrapper).slice(0, 200)}`;
            } else if (typeof wrapper.sapStatus === "number" && wrapper.sapStatus >= 400) {
              networkError = `SAP HTTP ${wrapper.sapStatus} via middleware: ${
                typeof wrapper.sapResponse === "string"
                  ? wrapper.sapResponse.slice(0, 200)
                  : JSON.stringify(wrapper.sapResponse).slice(0, 200)
              }`;
            } else {
              const inner = wrapper.sapResponse;
              if (typeof inner === "string") {
                try { sapJson = JSON.parse(inner); }
                catch { networkError = `SAP response not JSON: ${inner.slice(0, 200)}`; }
              } else {
                sapJson = inner;
              }
            }
          }
        }
      } else {
        trace(reqId, "direct.prepared", {
          sapUrl,
          httpMethod,
          headerKeys: headerKeys(directHeaders),
        });
        trace(reqId, "direct.fetch.start", { startedAt: new Date(fetchStarted).toISOString() });
        const res = await fetch(sapUrl, {
          method: httpMethod,
          headers: directHeaders,
          body: httpMethod === "GET" ? undefined : JSON.stringify(requestBody),
          signal: controller.signal,
        });
        const elapsed = Date.now() - fetchStarted;
        const text = await res.text();
        trace(reqId, "direct.fetch.end", {
          elapsedMs: elapsed,
          status: res.status,
          statusText: res.statusText,
          responseHeaderKeys: headerKeys(res.headers),
          contentLength: text.length,
          bodyPreview: text.slice(0, 500),
        });
        if (!res.ok) {
          networkError = `SAP HTTP ${res.status}: ${text.slice(0, 200)}`;
        } else {
          try { sapJson = JSON.parse(text); }
          catch { networkError = `Invalid JSON from SAP: ${text.slice(0, 200)}`; }
        }
      }
      clearTimeout(timer);
    } catch (e: any) {
      clearTimeout(timer);
      const elapsed = Date.now() - fetchStarted;
      const aborted = e?.name === "AbortError" || /aborted/i.test(String(e?.message || ""));
      trace(reqId, "proxy.fetch.error", {
        elapsedMs: elapsed,
        errorName: e?.name || null,
        errorMessage: e?.message || String(e),
        errorCode: e?.cause?.code || e?.code || null,
        causeMessage: e?.cause?.message || null,
        aborted,
        timerFired,
        abortReason: String(controller.signal.reason ?? ""),
        stack: e?.stack || null,
      });
      networkError = aborted
        ? `SAP did not respond within ${Math.round(elapsed / 1000)}s (timeout). Increase the timeout in SAP API Settings → Tenants From SAP, and ensure the edge-runtime wall-clock limit on the server is higher.`
        : `Could not reach SAP: ${e?.message || e}`;
    }

    if (networkError || !sapJson) {
      trace(reqId, "response.sent", {
        success: false,
        elapsedTotalMs: Date.now() - tStart,
        networkError,
      });
      return json({
        success: false,
        message: networkError || "Empty response from SAP.",
      });
    }

    const tenants = extractTenants(sapJson);
    trace(reqId, "sap.parsed", {
      tenantCount: tenants.length,
      rawKeys: sapJson && typeof sapJson === "object" && !Array.isArray(sapJson) ? Object.keys(sapJson) : [],
    });
    trace(reqId, "response.sent", {
      success: true,
      elapsedTotalMs: Date.now() - tStart,
      tenantCount: tenants.length,
    });

    return json({
      success: true,
      tenants,
      raw_sap_response: sapJson,
    });
  } catch (e: any) {
    trace(reqId, "unhandled.error", {
      errorName: e?.name || null,
      errorMessage: e?.message || String(e),
      stack: e?.stack || null,
      elapsedTotalMs: Date.now() - tStart,
    });
    return json({ success: false, message: e?.message || "Unexpected error" }, 500);
  }
});
