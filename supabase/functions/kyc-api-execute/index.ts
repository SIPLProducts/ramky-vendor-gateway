import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getPath(obj: any, path?: string | null): any {
  if (!path) return undefined;
  return path.split(".").reduce((a: any, k: string) => {
    if (a == null) return a;
    const idx: any = /^\d+$/.test(k) ? Number(k) : k;
    return a[idx];
  }, obj);
}

function substitute(template: any, vars: Record<string, any>): any {
  if (template == null) return template;
  if (typeof template === "string") {
    return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ""));
  }
  if (Array.isArray(template)) return template.map((v) => substitute(v, vars));
  if (typeof template === "object") {
    const out: any = {};
    for (const k of Object.keys(template)) out[k] = substitute(template[k], vars);
    return out;
  }
  return template;
}

function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { providerName, input, fileBase64, fileMimeType } = await req.json();
    if (!providerName) {
      return new Response(JSON.stringify({ found: false, message: "providerName required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: provider } = await supa
      .from("api_providers")
      .select("*")
      .eq("provider_name", providerName)
      .eq("is_enabled", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!provider) {
      return new Response(JSON.stringify({ found: false, message: "No active provider configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: cred } = await supa
      .from("api_credentials")
      .select("credential_value")
      .eq("api_provider_id", provider.id)
      .eq("credential_name", "API_TOKEN")
      .maybeSingle();

    const url = `${provider.base_url}${provider.endpoint_path}`;
    const headers: Record<string, string> = {};
    if (provider.request_headers && typeof provider.request_headers === "object") {
      for (const [k, v] of Object.entries(provider.request_headers as Record<string, any>)) {
        // Never accept an Authorization header from extras — credential always wins.
        if (k.toLowerCase() === "authorization") continue;
        headers[k] = String(v);
      }
    }
    if (cred?.credential_value && provider.auth_type !== "NONE") {
      const prefix = provider.auth_header_prefix ? `${provider.auth_header_prefix} ` : "";
      headers[provider.auth_header_name || "Authorization"] = `${prefix}${cred.credential_value}`;
    }

    let body: BodyInit | undefined;
    if (provider.request_mode === "multipart") {
      if (!fileBase64) {
        return new Response(JSON.stringify({ found: true, ok: false, message: "File required for multipart provider" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const fd = new FormData();
      const blob = new Blob([base64ToUint8(fileBase64)], { type: fileMimeType || "application/octet-stream" });
      fd.append(provider.file_field_name || "file", blob, "upload");
      body = fd;
    } else if ((provider.http_method || "POST") !== "GET") {
      const filled = substitute(provider.request_body_template ?? {}, input ?? {});
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
      body = JSON.stringify(filled);
    }

    const start = Date.now();
    const resp = await fetch(url, { method: provider.http_method || "POST", headers, body });
    const latency_ms = Date.now() - start;
    const text = await resp.text();
    let parsed: any;
    try { parsed = JSON.parse(text); } catch { parsed = text; }

    let ok = resp.ok;
    if (provider.response_success_path) {
      const v = getPath(parsed, provider.response_success_path);
      ok = ok && String(v) === String(provider.response_success_value ?? "true");
    } else if (parsed && typeof parsed === "object" && "success" in parsed) {
      // Surepass-style default: { success: true, ... }
      ok = ok && parsed.success === true;
    }

    const mapping = (provider.response_data_mapping || {}) as Record<string, string>;
    const data: Record<string, any> = {};
    for (const [outKey, jsonPath] of Object.entries(mapping)) {
      data[outKey] = getPath(parsed, jsonPath);
    }

    const message = provider.response_message_path
      ? String(getPath(parsed, provider.response_message_path) ?? (ok ? "OK" : `HTTP ${resp.status}`))
      : (ok ? "OK" : `HTTP ${resp.status}`);

    return new Response(JSON.stringify({
      found: true, valid: ok, ok, status: resp.status, latency_ms,
      message, data, raw: parsed,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[kyc-api-execute]", e);
    return new Response(JSON.stringify({ found: false, ok: false, message: e?.message || "Execution failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
