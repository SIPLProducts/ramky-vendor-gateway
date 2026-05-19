import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuthenticatedUser, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map SAP master JSON keys -> our master_type + (codeField, descField)
// `codeFn` lets us build composite codes (e.g. REGION = LAND1_BLAND since BLAND repeats across countries).
const MASTER_MAP: Record<string, { type: string; code: string; desc?: string; codeFn?: (item: any) => string | null }> = {
  VENDOR_ACC_GRP:     { type: "vendor_account_group",     code: "KTOKK", desc: "TXT30" },
  COMPANY_CODE:       { type: "company_code",             code: "BUKRS", desc: "BUTXT" },
  PLANNING_GROUP:     { type: "planning_group",           code: "GRUPP" },
  RECON_ACCOUNT:      { type: "recon_account",            code: "SAKNR", desc: "TXT20" },
  PURCHASE_ORG:       { type: "purchase_org",             code: "EKORG", desc: "EKOTX" },
  CURRENCY:           { type: "currency",                 code: "WAERS", desc: "LTEXT" },
  COUNTRY:            { type: "country",                  code: "LAND1", desc: "LANDX" },
  REGION:             {
    type: "region", code: "BLAND", desc: "BEZEI",
    codeFn: (item) => {
      const l = item?.LAND1; const b = item?.BLAND;
      if (l == null || b == null || String(l).trim() === "" || String(b).trim() === "") return null;
      return `${String(l)}_${String(b)}`;
    },
  },
  MAT_GRP_VENDOR:     { type: "material_group_vendor",    code: "ATWRT", desc: "ATWTB" },
  CAT_VENDOR:         { type: "vendor_category",          code: "ATWRT", desc: "ATWTB" },
  LOCATION_VENDOR:    { type: "vendor_location",          code: "ATWRT", desc: "ATWTB" },
  IDENTIFICATION_SOURCE: { type: "identification_source", code: "ATWRT", desc: "ATWTB" },
};

function ok(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

function findConfig(configs: any[]): any | null {
  if (!configs?.length) return null;
  // Prefer one named like "F4" or "Master"
  const byName = configs.find((c) => /f4|master/i.test(c.name || ""));
  if (byName) return byName;
  return configs[0];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuthenticatedUser(req);
  if (!auth.ok) return authErrorResponse(auth, corsHeaders);

  try {
    const body = await req.json().catch(() => ({}));
    const requestedTypes: string[] | undefined = Array.isArray(body?.master_types)
      ? body.master_types
      : (body?.master_type ? [body.master_type] : undefined);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: configs } = await supabase
      .from("sap_api_configs").select("*").eq("is_active", true);
    const config = findConfig(configs || []);
    if (!config) return ok({ success: false, message: "No active SAP API config found." }, 200);

    // Build SAP target URL (the actual SAP endpoint, regardless of proxy)
    const base = (config.base_url || "").replace(/\/$/, "");
    const path = config.endpoint_path || "";
    const sapUrl = `${base}${path}`;
    if (!sapUrl) {
      return ok({ success: false, message: "SAP config base_url + endpoint_path missing." }, 200);
    }

    // Get credentials (Basic / Bearer) for direct calls (middleware adds its own SAP creds)
    const { data: creds } = await supabase
      .from("sap_api_credentials").select("*").eq("config_id", config.id).maybeSingle();
    const sapHeaders: Record<string, string> = { "Accept": "application/json" };
    if (config.auth_type === "Basic" && creds?.username) {
      sapHeaders["Authorization"] = `Basic ${btoa(`${creds.username}:${creds.password_encrypted ?? ""}`)}`;
    } else if (config.auth_type === "Bearer" && creds?.password_encrypted) {
      sapHeaders["Authorization"] = `Bearer ${creds.password_encrypted}`;
    }

    const httpMethod = (config.http_method || "GET").toUpperCase();
    const connectionMode = (config.connection_mode || "direct").toLowerCase();

    function normalizeMiddlewareBase(raw: string): string {
      let v = String(raw || "").replace(/\s+/g, "").trim().replace(/\/+$/, "");
      v = v.replace(/\/sap\/bp\/create$/i, "")
           .replace(/\/sap\/proxy$/i, "")
           .replace(/\/health$/i, "")
           .replace(/\/+$/, "");
      return v;
    }

    let sapJson: any = null;
    let networkError: string | null = null;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);

      if (connectionMode === "proxy") {
        const middlewareBase = normalizeMiddlewareBase(config.middleware_url || "");
        const middlewareKey = (config.proxy_secret || "").trim();
        if (!middlewareBase) {
          clearTimeout(timer);
          return ok({
            success: false,
            message: "SAP middleware URL is not configured for the 'SAP Fields F4' API.",
            hint: "Open SAP API Settings → SAP Fields F4 and set the Node.js Middleware URL and Proxy Secret.",
          }, 200);
        }
        if (!middlewareKey) {
          clearTimeout(timer);
          return ok({
            success: false,
            message: "Proxy Secret is not set for the 'SAP Fields F4' API.",
            hint: "Open SAP API Settings → SAP Fields F4 and set the Proxy Secret.",
          }, 200);
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
            headers: { Accept: "application/json" },
            useBasicAuth: true,
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        const text = await res.text();
        if (!res.ok) {
          let detail = text.slice(0, 400);
          try {
            const j = JSON.parse(text);
            detail = `${j.error || "upstream error"}${j.code ? ` [${j.code}]` : ""}${j.target ? ` -> ${j.target}` : ""}`;
          } catch { /* keep raw text */ }
          if (res.status === 401) {
            networkError = `Middleware rejected the request (HTTP 401 Unauthorized). The Node middleware running at ${middlewareBase} needs the env var MIDDLEWARE_SHARED_SECRET set to the same value as the Proxy Secret saved in SAP API Settings → SAP Fields F4. Restart the middleware after setting it.`;
          } else {
            networkError = `Middleware HTTP ${res.status}: ${detail}`;
          }
        } else {
          let wrapper: any = null;
          try { wrapper = JSON.parse(text); } catch {
            networkError = `Invalid JSON from middleware: ${text.slice(0, 200)}`;
          }
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
          headers: sapHeaders,
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
      networkError = `Could not reach SAP${connectionMode === "proxy" ? " via middleware" : ""}: ${e?.message || e}`;
    }

    if (networkError || !sapJson) {
      return ok({
        success: false,
        message: networkError || "Empty response from SAP.",
        hint: connectionMode === "proxy"
          ? "Check the middleware is running and the Proxy Secret matches. The middleware must allow the SAP host."
          : "Check the 'SAP Fields F4' config base_url, endpoint_path, and credentials. If SAP sits on an internal network, switch the config Connection to 'proxy' and set the middleware URL.",
      }, 200);
    }

    // Process each known master block
    const summary: Record<string, { upserted: number; skipped: number }> = {};
    const now = new Date().toISOString();

    for (const [sapKey, mapping] of Object.entries(MASTER_MAP)) {
      if (requestedTypes && !requestedTypes.includes(mapping.type)) continue;
      const arr: any[] = Array.isArray(sapJson?.[sapKey]) ? sapJson[sapKey] : [];
      let skipped = 0;
      const rows: any[] = [];
      for (const item of arr) {
        const codeRaw = mapping.codeFn ? mapping.codeFn(item) : item?.[mapping.code];
        if (codeRaw === undefined || codeRaw === null || String(codeRaw).trim() === "") {
          skipped++;
          continue;
        }
        const desc = mapping.desc ? (item?.[mapping.desc] ?? null) : null;
        rows.push({
          master_type: mapping.type,
          code: String(codeRaw),
          description: desc == null ? null : String(desc),
          extra: item,
          source: "sap",
          last_synced_at: now,
        });
      }
      let upserted = 0;
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await supabase
          .from("sap_master_data")
          .upsert(chunk, { onConflict: "master_type,code" });
        if (error) {
          console.error("bulk upsert error", mapping.type, error.message);
          skipped += chunk.length;
        } else {
          upserted += chunk.length;
        }
      }
      summary[mapping.type] = { upserted, skipped };
    }

    // Also return the raw SAP F4 response so the UI can show it 1:1
    const sapResponse: Record<string, any[]> = {};
    for (const sapKey of Object.keys(MASTER_MAP)) {
      sapResponse[sapKey] = Array.isArray(sapJson?.[sapKey]) ? sapJson[sapKey] : [];
    }

    return ok({ success: true, summary, fetched_at: now, sap_response: sapResponse });
  } catch (e: any) {
    console.error("sap-master-fetch error:", e?.message || e);
    return ok({ success: false, message: e?.message || "Unexpected error" }, 200);
  }
});
