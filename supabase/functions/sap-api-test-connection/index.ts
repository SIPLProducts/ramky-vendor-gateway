import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeMiddlewareBase(raw: string): string {
  if (!raw) return "";
  let v = String(raw).replace(/\s+/g, "").trim().replace(/\/+$/, "");
  v = v.replace(/\/sap\/bp\/create$/i, "")
       .replace(/\/sap\/proxy$/i, "")
       .replace(/\/health$/i, "")
       .replace(/\/+$/, "");
  return v;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { configId } = await req.json();
    if (!configId) throw new Error("configId is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: config, error } = await supabase
      .from("sap_api_configs")
      .select("*")
      .eq("id", configId)
      .single();
    if (error || !config) throw new Error("Configuration not found");

    const { data: creds } = await supabase
      .from("sap_api_credentials")
      .select("*")
      .eq("config_id", configId)
      .maybeSingle();

    const isProxy = config.connection_mode === "proxy";
    const rawMw = (config.middleware_url || "").toString();
    const mwBase = normalizeMiddlewareBase(rawMw);

    let targetUrl = "";
    if (isProxy) {
      if (!mwBase || !/^https?:\/\//i.test(mwBase)) {
        return new Response(
          JSON.stringify({
            ok: false,
            status: 0,
            latency_ms: 0,
            message: `Invalid Node.js Middleware URL "${rawMw}". Enter just the base URL (e.g. https://abc123.ngrok-free.app), no spaces, no trailing path.`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
        );
      }
      targetUrl = `${mwBase}/health`;
    } else {
      targetUrl = `${(config.base_url || "").replace(/\/$/, "")}${config.endpoint_path || ""}`;
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (!isProxy) {
      if (config.auth_type === "Basic" && creds?.username) {
        headers["Authorization"] = `Basic ${btoa(`${creds.username}:${creds.password_encrypted ?? ""}`)}`;
      } else if (config.auth_type === "Bearer" && creds?.password_encrypted) {
        headers["Authorization"] = `Bearer ${creds.password_encrypted}`;
      }
    }

    const start = Date.now();
    let status = 0;
    let message = "";
    let ok = false;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(config.timeout_ms || 30000, 15000));
      const res = await fetch(targetUrl, { method: "GET", headers, signal: controller.signal });
      clearTimeout(timer);
      status = res.status;
      ok = res.status < 500;
      message = ok
        ? (isProxy ? `Middleware reachable (HTTP ${status})` : `Connection reachable (HTTP ${status})`)
        : `${isProxy ? "Middleware" : "SAP"} returned HTTP ${status}`;
    } catch (e: any) {
      message = isProxy
        ? `Could not reach middleware at ${targetUrl}. Make sure 'node server.js' is running and the URL is publicly reachable. ${e?.message || ""}`
        : (e?.message || "Connection failed");
    }
    const latency_ms = Date.now() - start;

    // In proxy mode, also verify the proxy secret authenticates against /sap/bp/create
    if (isProxy && ok) {
      const secret = ((config as any).proxy_secret || "").toString().trim();
      if (!secret) {
        ok = false;
        message = "Middleware reachable, but 'Proxy Secret / Password' is empty in SAP API Settings. Set it to the same value as MIDDLEWARE_SHARED_SECRET in middleware/.env.";
      } else {
        try {
          const authCtrl = new AbortController();
          const authTimer = setTimeout(() => authCtrl.abort(), 10000);
          const authRes = await fetch(`${mwBase}/sap/bp/create`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-middleware-key": secret },
            body: JSON.stringify([]),
            signal: authCtrl.signal,
          });
          clearTimeout(authTimer);
          if (authRes.status === 401) {
            ok = false;
            message = "Middleware rejected the proxy secret (401). The 'Proxy Secret / Password' in SAP API Settings does not match MIDDLEWARE_SHARED_SECRET in middleware/.env.";
          } else {
            message = `Middleware reachable and proxy secret accepted (HTTP ${authRes.status}).`;
          }
        } catch (e: any) {
          // Don't fail the test on transient auth-check errors
          message = `${message} (auth check skipped: ${e?.message || "network error"})`;
        }
      }
    }

    return new Response(
      JSON.stringify({ ok, status, latency_ms, message, target: targetUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ ok: false, message: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  }
});
