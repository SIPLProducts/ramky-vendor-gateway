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
  // Strip data URL prefix and any whitespace/newlines that may have crept in.
  let cleaned = (b64 || "").trim();
  if (cleaned.startsWith("data:") && cleaned.includes(",")) {
    cleaned = cleaned.split(",")[1];
  }
  cleaned = cleaned.replace(/\s+/g, "");
  const bin = atob(cleaned);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/tiff": "tiff",
  "application/pdf": "pdf",
};

function pickFilename(originalName: string | undefined, mime: string | undefined): string {
  const safe = (originalName || "").trim().replace(/[\r\n"\\]/g, "").replace(/\s+/g, "_");
  if (safe && /\.[A-Za-z0-9]{2,5}$/.test(safe)) return safe;
  const ext = MIME_EXT[(mime || "").toLowerCase()] || "bin";
  const base = safe ? safe.replace(/\.+$/, "") : "upload";
  return `${base}.${ext}`;
}

const BANK_SUCCESS_CACHE_TTL_MS = 60_000;
const bankSuccessCache = new Map<string, { expiresAt: number; response: any }>();

function normalizeBankPayload(filled: any, input: Record<string, any> | undefined): { payload: Record<string, any>; cacheKey: string | null } {
  const source = (filled && typeof filled === "object" && !Array.isArray(filled)) ? filled : {};
  const rawAccount = input?.id_number ?? input?.account ?? source.id_number ?? source.account ?? "";
  const rawIfsc = input?.ifsc ?? source.ifsc ?? "";
  const idNumber = String(rawAccount).replace(/\s+/g, "").trim();
  const ifsc = String(rawIfsc).toUpperCase().trim();
  const payload = { id_number: idNumber, ifsc, ifsc_details: true };
  const cacheKey = idNumber && ifsc ? `${idNumber}::${ifsc}` : null;
  return { payload, cacheKey };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { providerName, input, fileBase64, fileMimeType, fileName, healthCheck } = await req.json();
    if (typeof providerName !== "string" || providerName.trim().length === 0 || providerName.length > 100) {
      return new Response(JSON.stringify({ found: false, ok: false, message: "providerName required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const backendUrl = Deno.env.get("SUPABASE_URL")?.trim();
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
    if (!backendUrl || !serviceRoleKey) {
      const missing = [!backendUrl ? "SUPABASE_URL" : null, !serviceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : null]
        .filter(Boolean)
        .join(",");
      console.error(`[kyc-api-execute] configuration_error missing=${missing}`);
      return new Response(JSON.stringify({
        found: false,
        ok: false,
        success: false,
        message: "KYC service configuration is unavailable. Please contact the administrator.",
        message_code: "kyc_service_configuration_error",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supa = createClient(
      backendUrl,
      serviceRoleKey,
    );

    const { data: provider, error: providerError } = await supa
      .from("api_providers")
      .select("*")
      .eq("provider_name", providerName.trim())
      .eq("is_enabled", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (providerError) {
      console.error(
        `[kyc-api-execute] provider_lookup_failed provider=${providerName.trim()} code=${providerError.code || "unknown"} status=${providerError.details ? "details_available" : "no_details"}`,
      );
      return new Response(JSON.stringify({
        found: false,
        ok: false,
        success: false,
        message: "KYC provider settings could not be read. Please contact the administrator.",
        message_code: "provider_lookup_failed",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!provider) {
      console.warn(`[kyc-api-execute] provider_not_configured provider=${providerName.trim()}`);
      return new Response(JSON.stringify({
        found: false,
        ok: false,
        success: false,
        message: "No active provider configured",
        message_code: "provider_not_configured",
      }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: cred, error: credentialError } = await supa
      .from("api_credentials")
      .select("credential_value")
      .eq("api_provider_id", provider.id)
      .eq("credential_name", "API_TOKEN")
      .maybeSingle();

    if (credentialError) {
      console.error(
        `[kyc-api-execute] credential_lookup_failed provider=${provider.provider_name} code=${credentialError.code || "unknown"}`,
      );
      return new Response(JSON.stringify({
        found: true,
        ok: false,
        success: false,
        message: "KYC provider credentials could not be read. Please contact the administrator.",
        message_code: "provider_credential_lookup_failed",
        provider_name: provider.provider_name,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Deployment/readiness probe: prove that this running function can read
    // both provider configuration and its credential row without contacting
    // the external KYC service or exposing any sensitive values.
    if (healthCheck === true) {
      const credentialRequired = provider.auth_type !== "NONE";
      const credentialConfigured = Boolean(cred?.credential_value);
      const ok = !credentialRequired || credentialConfigured;
      console.log(`[kyc-api-execute] healthcheck provider=${provider.provider_name} ok=${ok}`);
      return new Response(JSON.stringify({
        found: true,
        ok,
        success: ok,
        healthcheck: true,
        message: ok ? "KYC provider is ready" : "KYC provider credential is not configured",
        message_code: ok ? "provider_ready" : "provider_credential_missing",
        provider_name: provider.provider_name,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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
    let bankCacheKey: string | null = null;
    if (provider.request_mode === "multipart") {
      if (!fileBase64) {
        return new Response(JSON.stringify({ found: true, ok: false, message: "File required for multipart provider" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const fd = new FormData();
      const blob = new Blob([base64ToUint8(fileBase64)], { type: fileMimeType || "application/octet-stream" });
      const uploadName = pickFilename(fileName, fileMimeType);
      console.log(`[kyc-api-execute] multipart upload field=${provider.file_field_name || "file"} name=${uploadName} mime=${fileMimeType}`);
      fd.append(provider.file_field_name || "file", blob, uploadName);
      // Append any extra request_body_template fields as form fields (e.g. PAN OCR
      // `strict_check_name`). Placeholders like `{{id_number}}` are substituted
      // from `input` using the same logic as JSON mode. Empty/null values are
      // skipped; objects/arrays are JSON-stringified.
      const extraTpl = provider.request_body_template;
      const extraPairs: string[] = [];
      console.log(`[kyc-api-execute] multipart request_body_template=${JSON.stringify(extraTpl ?? null)}`);
      if (extraTpl && typeof extraTpl === "object" && !Array.isArray(extraTpl)) {
        const filledExtras = substitute(extraTpl, input ?? {}) as Record<string, any>;
        for (const [k, v] of Object.entries(filledExtras)) {
          if (v === undefined || v === null || v === "") continue;
          const strVal = (typeof v === "object") ? JSON.stringify(v) : String(v);
          fd.append(k, strVal);
          extraPairs.push(`${k}=${strVal}`);
        }
      }
      if (extraPairs.length > 0) {
        console.log(`[kyc-api-execute] multipart extraFieldsResolved=${extraPairs.join(",")}`);
      } else {
        console.log(`[kyc-api-execute] multipart extraFieldsResolved=<none>`);
      }
      // Auto-inject use_pdf=true when a PDF is uploaded (Surepass Bank/PAN OCR
      // requires this flag for PDF inputs). Skip if the admin's template already
      // provided it, so explicit config always wins.
      const isPdf = (fileMimeType?.toLowerCase() === "application/pdf")
        || (uploadName?.toLowerCase().endsWith(".pdf") ?? false);
      const templateHasUsePdf = !!(extraTpl && typeof extraTpl === "object" && !Array.isArray(extraTpl)
        && Object.keys(extraTpl as Record<string, any>).some((k) => k.toLowerCase() === "use_pdf"));
      if (isPdf && !templateHasUsePdf) {
        fd.append("use_pdf", "true");
        console.log(`[kyc-api-execute] auto-injected use_pdf=true for PDF upload`);
      }
      body = fd;

      // CRITICAL: never force Content-Type for multipart — fetch must set the
      // multipart/form-data boundary itself, otherwise Surepass returns HTTP 400.
      for (const k of Object.keys(headers)) {
        if (k.toLowerCase() === "content-type") delete headers[k];
      }
    } else if ((provider.http_method || "POST") !== "GET") {
      let filled = substitute(provider.request_body_template ?? {}, input ?? {});
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
      if (provider.provider_name === "PAN") {
        // Always derive PAN payload from runtime input — never trust a saved
        // template that may contain a hardcoded sample PAN like "ABDCS6352G".
        const rawPan =
          input?.id_number ?? input?.pan_number ?? input?.pan ??
          (filled && typeof filled === "object" ? (filled as any).id_number : "") ?? "";
        const idNumber = String(rawPan).toUpperCase().replace(/\s+/g, "").trim();
        filled = { id_number: idNumber };
      }
      if (provider.provider_name === "BANK") {
        const normalized = normalizeBankPayload(filled, input);
        filled = normalized.payload;
        bankCacheKey = normalized.cacheKey;
        if (bankCacheKey) {
          const cached = bankSuccessCache.get(bankCacheKey);
          if (cached && cached.expiresAt > Date.now()) {
            console.log(`[kyc-api-execute] provider=BANK cache=hit keys=id_number,ifsc,ifsc_details ifsc_details=true`);
            return new Response(JSON.stringify({ ...cached.response, cache_hit: true }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          if (cached) bankSuccessCache.delete(bankCacheKey);
        }
      }
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
      body = JSON.stringify(filled);
      // Safe diagnostic: provider + which input keys we filled in (no values, no secrets).
      console.log(
        `[kyc-api-execute] provider=${provider.provider_name} mode=json keys=${
          filled && typeof filled === "object" ? Object.keys(filled).join(",") : "-"
        } inputKeys=${input ? Object.keys(input).join(",") : "-"}${provider.provider_name === "BANK" ? " ifsc_details=true" : ""}`,
      );
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

    // A mapping is "valid" only if it contains at least one string JSON-path
    // value. If an admin accidentally pasted a sample response (object/array
    // values) into response_data_mapping, treat it as no mapping and fall
    // through to the auto-flatten path below — otherwise the UI gets nothing.
    const mappingHasStringPaths = hasMapping &&
      Object.values(rawMapping as Record<string, any>).some(
        (v) => typeof v === "string" && v.length > 0,
      );

    if (mappingHasStringPaths) {
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
    }

    // Safety net: if no mapping was usable OR every mapped path resolved to
    // undefined / empty, auto-flatten the upstream `data` object so the UI's
    // flat-key lookups (e.g. d.enterprise_name, d.mobile, d.nic_5_digit) still
    // find values. This prevents misconfigured response_data_mapping from
    // silently blanking the form after a successful API call.
    const dataIsEmpty = Object.values(data).every((v) => v == null || v === "");
    if (dataIsEmpty && parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const upstreamData = (parsed as any).data;
      const flat: Record<string, any> = {};
      if (upstreamData && typeof upstreamData === "object" && !Array.isArray(upstreamData)) {
        // Top-level primitive fields of upstream `data`.
        for (const [k, v] of Object.entries(upstreamData as Record<string, any>)) {
          if (typeof v !== "object" || v === null) flat[k] = v;
        }
        // Promote `main_details` keys onto the flat object (Surepass MSME shape).
        const md = (upstreamData as any).main_details;
        if (md && typeof md === "object" && !Array.isArray(md)) {
          for (const [k, v] of Object.entries(md as Record<string, any>)) {
            if (typeof v !== "object" || v === null) flat[k] = v;
          }
          // Convenience aliases used by the registration UI.
          if (md.name_of_enterprise && !flat.enterprise_name) flat.enterprise_name = md.name_of_enterprise;
          if (md.mobile_number && !flat.mobile) flat.mobile = md.mobile_number;
          if (md.pin && !flat.pin_code) flat.pin_code = md.pin;
          if (md.dic_name && !flat.district) flat.district = md.dic_name;
          if (Array.isArray(md.enterprise_type_list) && md.enterprise_type_list[0]) {
            const et0 = md.enterprise_type_list[0];
            if (et0.enterprise_type && !flat.enterprise_type) flat.enterprise_type = et0.enterprise_type;
            if (et0.classification_year && !flat.classification_year) flat.classification_year = et0.classification_year;
          }
        }
        // Promote first NIC code entry so UI can read nic_5_digit / nic_4_digit / nic_2_digit.
        const nic = (upstreamData as any).nic_code;
        if (Array.isArray(nic) && nic[0] && typeof nic[0] === "object") {
          for (const [k, v] of Object.entries(nic[0] as Record<string, any>)) {
            if (flat[k] == null && (typeof v !== "object" || v === null)) flat[k] = v;
          }
        }
        // Canonical Udyam number.
        if ((upstreamData as any).uan && !flat.udyam_number) flat.udyam_number = (upstreamData as any).uan;
        data = flat;
      } else {
        // No `data` envelope — strip status keys and use the rest.
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

    const responsePayload = {
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
    };

    if (provider.provider_name === "BANK" && ok && bankCacheKey) {
      bankSuccessCache.set(bankCacheKey, {
        expiresAt: Date.now() + BANK_SUCCESS_CACHE_TTL_MS,
        response: responsePayload,
      });
    }

    return new Response(JSON.stringify(responsePayload), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
