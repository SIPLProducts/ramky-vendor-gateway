import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Walk a dotted JSON path. Hardened so a non-string `path` (e.g. when an admin
 * pasted a sample response into `response_data_mapping` instead of a path) just
 * returns undefined instead of crashing the whole edge function with
 * "path.split is not a function".
 */
function getPath(obj: any, path?: any): any {
  if (typeof path !== "string" || path.length === 0) return undefined;
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
      return new Response(JSON.stringify({ found: false, ok: false, message: "providerName required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
      return new Response(JSON.stringify({ found: false, ok: false, message: "No active provider configured" }),
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
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const fd = new FormData();
      const blob = new Blob([base64ToUint8(fileBase64)], { type: fileMimeType || "application/octet-stream" });
      fd.append(provider.file_field_name || "file", blob, "upload");
      body = fd;
      // CRITICAL: never force Content-Type for multipart — fetch must set the
      // multipart/form-data boundary itself, otherwise Surepass returns HTTP 400.
      for (const k of Object.keys(headers)) {
        if (k.toLowerCase() === "content-type") delete headers[k];
      }
    } else if ((provider.http_method || "POST") !== "GET") {
      const filled = substitute(provider.request_body_template ?? {}, input ?? {});
      // Defensive guard: if the saved template was misconfigured (e.g. literal
      // `{"id_number": ""}` with no `{{id_number}}` placeholder) but the caller
      // actually provided values in `input`, merge the input keys in for any
      // empty string fields. This prevents the upstream API from receiving an
      // empty identifier and returning a generic "Invalid …" error.
      if (filled && typeof filled === "object" && !Array.isArray(filled) && input && typeof input === "object") {
        for (const [k, v] of Object.entries(filled as Record<string, any>)) {
          if ((v === "" || v == null) && (input as any)[k] != null && (input as any)[k] !== "") {
            (filled as Record<string, any>)[k] = (input as any)[k];
          }
        }
      }
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

    // Map response fields. Wrap each entry so one bad mapping value cannot
    // crash the whole call (the historical "path.split is not a function" bug).
    //
    // When NO mapping is configured (empty object / null), fall through to a
    // generic "show whatever the API returned" mode: we expose the upstream
    // `data` object as-is (or, if the response has no `data` key, the whole
    // response). This lets the UI render every field the provider sent
    // without any hardcoded field list.
    const rawMapping = provider.response_data_mapping;
    let data: Record<string, any> = {};
    const hasMapping =
      rawMapping &&
      typeof rawMapping === "object" &&
      !Array.isArray(rawMapping) &&
      Object.keys(rawMapping).length > 0;

    if (hasMapping) {
      for (const [outKey, jsonPath] of Object.entries(rawMapping as Record<string, any>)) {
        try {
          if (typeof jsonPath === "string") {
            data[outKey] = getPath(parsed, jsonPath);
          } else {
            console.warn(`[kyc-api-execute] mapping entry "${outKey}" is not a string path:`, jsonPath);
          }
        } catch (mapErr) {
          console.warn(`[kyc-api-execute] mapping entry "${outKey}" failed:`, mapErr);
        }
      }
    } else if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      // No mapping — surface upstream payload verbatim so the UI can render
      // exactly what the configured API returned.
      const upstreamData = (parsed as any).data;
      if (upstreamData && typeof upstreamData === "object" && !Array.isArray(upstreamData)) {
        data = { ...upstreamData };
      } else {
        // Strip envelope keys so the rendered card focuses on payload fields.
        const envelopeKeys = new Set(["status_code", "success", "message", "message_code"]);
        for (const [k, v] of Object.entries(parsed as Record<string, any>)) {
          if (!envelopeKeys.has(k)) data[k] = v;
        }
      }
    }

    // Default message resolution:
    //   1) explicit response_message_path mapping
    //   2) upstream `message` field (Surepass-style)
    //   3) upstream `message_code` (e.g. "no_gstin_detected")
    //   4) generic OK / HTTP <status>
    const upstreamMessage = parsed && typeof parsed === "object" ? parsed.message : undefined;
    const upstreamMessageCode = parsed && typeof parsed === "object" ? parsed.message_code : undefined;
    const message = provider.response_message_path
      ? String(getPath(parsed, provider.response_message_path) ?? upstreamMessage ?? upstreamMessageCode ?? (ok ? "OK" : `HTTP ${resp.status}`))
      : (typeof upstreamMessage === "string" && upstreamMessage.length > 0)
        ? upstreamMessage
        : (typeof upstreamMessageCode === "string" && upstreamMessageCode.length > 0)
          ? upstreamMessageCode
          : (ok ? "OK" : `HTTP ${resp.status}`);

    // Surface upstream provider identity + raw status flags so the client can
    // prove the call came through the configured provider (not Gemini OCR).
    const message_code = (provider as any).response_message_code_path
      ? getPath(parsed, (provider as any).response_message_code_path)
      : (parsed && typeof parsed === "object" ? parsed.message_code : undefined);
    const upstream_status_code = parsed && typeof parsed === "object" ? parsed.status_code : undefined;
    const upstream_success = parsed && typeof parsed === "object" ? parsed.success : undefined;

    return new Response(JSON.stringify({
      found: true,
      valid: ok,
      ok,
      status: resp.status,
      status_code: upstream_status_code ?? resp.status,
      success: typeof upstream_success === "boolean" ? upstream_success : ok,
      message_code: message_code ?? null,
      latency_ms,
      message,
      data,
      raw: parsed,
      provider_id: provider.id,
      provider_name: provider.provider_name,
      endpoint_url: url,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[kyc-api-execute]", e);
    // Return 200 so the client can render the real message instead of a
    // generic 500 / "provider not configured" toast.
    return new Response(JSON.stringify({
      found: true,
      ok: false,
      success: false,
      message: e?.message || "Execution failed",
      message_code: "edge_function_error",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
