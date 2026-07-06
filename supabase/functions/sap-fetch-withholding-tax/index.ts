// Fetches the "Fetch_Withholding_TaxType" SAP API config and returns the
// raw upstream JSON (expected shape: [{ LAND1, TAXTYPE, TEXT40 }, ...]).
// The client filters by vendor country.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
};

const DEFAULT_CONFIG_NAME = "Fetch_Withholding_TaxType";

function normalizeMiddlewareBase(raw: string): string {
  const override = (Deno.env.get("SAP_MIDDLEWARE_URL_OVERRIDE") || "").trim();
  let v = String(override || raw || "").replace(/\s+/g, "").trim();
  v = v.replace(/^(https?);\/\//i, "$1://").replace(/^(https?):\/(?!\/)/i, "$1://");
  if (!/^https?:\/\//i.test(v) && v.length > 0) v = "http://" + v.replace(/^\/+/, "");
  v = v.replace(/\/+$/, "")
       .replace(/\/sap\/bp\/create$/i, "")
       .replace(/\/sap\/dms\/upload$/i, "")
       .replace(/\/api\/sap\/proxy$/i, "")
       .replace(/\/sap\/proxy$/i, "")
       .replace(/\/health$/i, "")
       .replace(/\/+$/, "");
  try {
    const url = new URL(v);
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
      url.hostname = "172.17.0.1";
      return url.toString().replace(/\/+$/, "");
    }
  } catch { /* ignore */ }
  return v;
}

async function callSap(config: any, creds: any): Promise<{ data: any | null; error: string | null }> {
  const base = (config.base_url || "").replace(/\/$/, "");
  const path = config.endpoint_path || "";
  const sapUrl = `${base}${path}`;
  const httpMethod = (config.http_method || "GET").toUpperCase();
  const mode = (config.connection_mode || "direct").toLowerCase();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    if (mode === "proxy") {
      const mwBase = normalizeMiddlewareBase(config.middleware_url || "");
      const mwKey = (config.proxy_secret || "").trim();
      if (!mwBase) return { data: null, error: "Middleware URL not configured" };
      if (!mwKey) return { data: null, error: "Proxy secret not set" };

      const proxyPaths = ["/sap/proxy", "/api/sap/proxy"];
      let res: Response | null = null;
      let text = "";
      for (const p of proxyPaths) {
        const r = await fetch(`${mwBase}${p}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-middleware-key": mwKey },
          body: JSON.stringify({
            url: sapUrl,
            method: httpMethod,
            headers: { Accept: "application/json" },
            useBasicAuth: true,
          }),
          signal: controller.signal,
        });
        const body = await r.text();
        if ((r.status === 404 || /^\s*<(!doctype|html)/i.test(body)) && p !== proxyPaths[proxyPaths.length - 1]) continue;
        res = r; text = body; break;
      }
      if (!res) return { data: null, error: "Middleware not reachable" };
      if (!res.ok) return { data: null, error: `Middleware HTTP ${res.status}: ${text.slice(0, 200)}` };
      let wrapper: any;
      try { wrapper = JSON.parse(text); } catch { return { data: null, error: `Invalid JSON from middleware: ${text.slice(0, 200)}` }; }
      if (wrapper.ok === false) return { data: null, error: `Middleware: ${wrapper.error || "unknown"}` };
      if (typeof wrapper.sapStatus === "number" && wrapper.sapStatus >= 400) {
        return { data: null, error: `SAP HTTP ${wrapper.sapStatus}` };
      }
      const inner = wrapper.sapResponse;
      if (typeof inner === "string") {
        try { return { data: JSON.parse(inner), error: null }; }
        catch { return { data: null, error: `SAP response not JSON: ${inner.slice(0, 200)}` }; }
      }
      return { data: inner, error: null };
    }

    const headers: Record<string, string> = { Accept: "application/json" };
    if (config.auth_type === "Basic" && creds?.username) {
      headers["Authorization"] = `Basic ${btoa(`${creds.username}:${creds.password_encrypted ?? ""}`)}`;
    } else if (config.auth_type === "Bearer" && creds?.password_encrypted) {
      headers["Authorization"] = `Bearer ${creds.password_encrypted}`;
    }
    const res = await fetch(sapUrl, { method: httpMethod, headers, signal: controller.signal });
    const text = await res.text();
    if (!res.ok) return { data: null, error: `SAP HTTP ${res.status}: ${text.slice(0, 200)}` };
    try { return { data: JSON.parse(text), error: null }; }
    catch { return { data: null, error: `Invalid JSON from SAP: ${text.slice(0, 200)}` }; }
  } catch (e: any) {
    return { data: null, error: e?.message || String(e) };
  } finally {
    clearTimeout(timer);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const configName = String(body?.config_name || DEFAULT_CONFIG_NAME);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: configs } = await supabase
      .from("sap_api_configs")
      .select("*")
      .eq("is_active", true);

    const config = (configs || []).find(
      (c: any) => String(c.name || "").trim().toLowerCase() === configName.toLowerCase(),
    );
    if (!config) {
      return new Response(
        JSON.stringify({ success: false, message: `SAP API config "${configName}" not found or inactive. Please create it under Admin → SAP API Settings.` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const { data: creds } = await supabase
      .from("sap_api_credentials")
      .select("*")
      .eq("config_id", config.id)
      .maybeSingle();

    const { data, error } = await callSap(config, creds);
    if (error) {
      return new Response(
        JSON.stringify({ success: false, message: error }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // Normalize to an array. SAP may return an object with a data array.
    let records: any[] = [];
    if (Array.isArray(data)) records = data;
    else if (data && Array.isArray((data as any).WHTAX)) records = (data as any).WHTAX;
    else if (data && Array.isArray((data as any).data)) records = (data as any).data;
    else if (data && Array.isArray((data as any).d?.results)) records = (data as any).d.results;
    else if (data && typeof data === "object") {
      // last resort: first array-valued key
      const arr = Object.values(data).find((v) => Array.isArray(v)) as any[] | undefined;
      if (arr) records = arr;
    }

    return new Response(
      JSON.stringify({ success: true, records, raw: data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ success: false, message: e?.message || String(e) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  }
});
