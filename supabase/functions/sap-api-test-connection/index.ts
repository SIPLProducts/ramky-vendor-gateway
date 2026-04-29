import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const baseUrl =
      config.connection_mode === "proxy" && config.middleware_url
        ? config.middleware_url
        : config.base_url;
    const targetUrl = `${(baseUrl || "").replace(/\/$/, "")}${config.endpoint_path || ""}`;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.auth_type === "Basic" && creds?.username) {
      headers["Authorization"] = `Basic ${btoa(`${creds.username}:${creds.password_encrypted ?? ""}`)}`;
    } else if (config.auth_type === "Bearer" && creds?.password_encrypted) {
      headers["Authorization"] = `Bearer ${creds.password_encrypted}`;
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
      message = ok ? `Connection reachable (HTTP ${status})` : `SAP returned HTTP ${status}`;
    } catch (e: any) {
      message = e?.message || "Connection failed";
    }
    const latency_ms = Date.now() - start;

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
