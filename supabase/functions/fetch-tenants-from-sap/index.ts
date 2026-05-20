import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeMiddlewareBase(raw: string): string {
  let v = String(raw || "").replace(/\s+/g, "").trim().replace(/\/+$/, "");
  v = v.replace(/\/sap\/bp\/create$/i, "")
       .replace(/\/sap\/proxy$/i, "")
       .replace(/\/health$/i, "")
       .replace(/\/+$/, "");
  return v;
}

// Best-effort extraction of a list of tenants from whatever SAP returns.
function extractTenants(sapJson: any): { code: string; name: string; raw: any }[] {
  if (!sapJson) return [];

  // Candidate arrays
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
    // primitive string entry → use as both
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

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const email: string = String(body?.email || "").trim();
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
      return json({ success: false, message: "SAP API config 'Tenants From SAP' not found or inactive." });
    }

    const base = (config.base_url || "").replace(/\/$/, "");
    const path = config.endpoint_path || "";
    const sapUrl = `${base}${path}`;
    if (!sapUrl) {
      return json({ success: false, message: "Tenants From SAP: base_url + endpoint_path missing." });
    }

    const httpMethod = (config.http_method || "POST").toUpperCase();
    const connectionMode = (config.connection_mode || "direct").toLowerCase();

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
    const requestBody = { email };

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);

      if (connectionMode === "proxy") {
        const middlewareBase = normalizeMiddlewareBase(config.middleware_url || "");
        const middlewareKey = (config.proxy_secret || "").trim();
        if (!middlewareBase) {
          clearTimeout(timer);
          return json({
            success: false,
            message: "SAP middleware URL is not configured for 'Tenants From SAP'.",
            hint: "Open SAP API Settings → Tenants From SAP and set the Node.js Middleware URL and Proxy Secret.",
          });
        }
        if (!middlewareKey) {
          clearTimeout(timer);
          return json({
            success: false,
            message: "Proxy Secret is not set for 'Tenants From SAP'.",
          });
        }
        const proxyUrl = `${middlewareBase}/sap/proxy`;
        const res = await fetch(proxyUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-middleware-key": middlewareKey,
          },
          body: JSON.stringify({
            url: sapUrl,
            method: httpMethod,
            headers: { Accept: "application/json", "Content-Type": "application/json" },
            body: requestBody,
            useBasicAuth: true,
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        const text = await res.text();
        if (!res.ok) {
          networkError = `Middleware HTTP ${res.status}: ${text.slice(0, 300)}`;
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
        const res = await fetch(sapUrl, {
          method: httpMethod,
          headers: directHeaders,
          body: httpMethod === "GET" ? undefined : JSON.stringify(requestBody),
          signal: controller.signal,
        });
        clearTimeout(timer);
        const text = await res.text();
        if (!res.ok) {
          networkError = `SAP HTTP ${res.status}: ${text.slice(0, 200)}`;
        } else {
          try { sapJson = JSON.parse(text); }
          catch { networkError = `Invalid JSON from SAP: ${text.slice(0, 200)}`; }
        }
      }
    } catch (e: any) {
      networkError = `Could not reach SAP: ${e?.message || e}`;
    }

    if (networkError || !sapJson) {
      return json({
        success: false,
        message: networkError || "Empty response from SAP.",
      });
    }

    const tenants = extractTenants(sapJson);

    return json({
      success: true,
      tenants,
      raw_sap_response: sapJson,
    });
  } catch (e: any) {
    console.error("fetch-tenants-from-sap error:", e?.message || e);
    return json({ success: false, message: e?.message || "Unexpected error" }, 500);
  }
});
