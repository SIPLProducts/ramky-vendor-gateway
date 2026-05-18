import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuthenticatedUser, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Indian state -> SAP T005S numeric region code for country IN.
const stateToRegion: Record<string, string> = {
  "andhra pradesh": "01", "arunachal pradesh": "02", "assam": "03", "bihar": "04",
  "goa": "05", "gujarat": "06", "haryana": "07", "himachal pradesh": "08",
  "jammu and kashmir": "09", "jammu & kashmir": "09", "j&k": "09",
  "karnataka": "10", "kerala": "11", "madhya pradesh": "12", "maharashtra": "13",
  "manipur": "14", "meghalaya": "15", "mizoram": "16", "nagaland": "17",
  "odisha": "18", "orissa": "18", "punjab": "19", "rajasthan": "20",
  "sikkim": "21", "tamil nadu": "22", "tripura": "23", "uttar pradesh": "24",
  "west bengal": "25", "andaman and nicobar islands": "26", "andaman & nicobar": "26",
  "chandigarh": "27", "dadra and nagar haveli": "28", "dadra & nagar haveli": "28",
  "dadra and nagar haveli and daman and diu": "28", "daman and diu": "29",
  "daman & diu": "29", "delhi": "30", "nct of delhi": "30", "lakshadweep": "31",
  "puducherry": "32", "pondicherry": "32", "chhattisgarh": "33", "chattisgarh": "33",
  "jharkhand": "34", "uttarakhand": "35", "uttaranchal": "35", "telangana": "36",
  "ladakh": "37",
};

function resolveRegion(state: string | null | undefined): string {
  if (!state) return "";
  const key = String(state).trim().toLowerCase().replace(/\s+/g, " ");
  return stateToRegion[key] || "";
}

// Map internal document_type to SAP-friendly file name label
const DOC_NAME_MAP: Record<string, string> = {
  pan_card: "pan", gst_certificate: "gst", gst_self_declaration: "gst_self_declaration",
  msme_certificate: "msme", cancelled_cheque: "bank_cheque1", cancelled_cheque_2: "bank_cheque2",
  financial_docs: "financials", dealership_certificate: "dealership", iec_certificate: "iec",
  swift_iban_proof: "swift_iban", incorporation_certificate: "incorporation", other: "other",
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)) as any);
  }
  return btoa(binary);
}

async function buildUploadArray(supabase: any, vendorId: string): Promise<{ uploads: any[]; skipped: string[] }> {
  const uploads: any[] = [];
  const skipped: string[] = [];
  const { data: docs, error } = await supabase
    .from("vendor_documents")
    .select("document_type, file_name, file_path, file_size")
    .eq("vendor_id", vendorId);
  if (error) {
    console.error("Failed to load vendor_documents:", error.message);
    return { uploads, skipped };
  }
  for (const d of docs || []) {
    try {
      if (d.file_size && d.file_size > MAX_UPLOAD_BYTES) {
        skipped.push(`${d.file_name} (>10MB)`);
        continue;
      }
      const { data: blob, error: dlErr } = await supabase.storage
        .from("vendor-documents").download(d.file_path);
      if (dlErr || !blob) { skipped.push(`${d.file_name} (download failed)`); continue; }
      const base64 = await blobToBase64(blob);
      uploads.push({
        FILE_NAME: DOC_NAME_MAP[d.document_type] || d.document_type,
        FILE: base64,
        FILE_PATH: d.file_path,
      });
    } catch (e: any) {
      console.error(`Upload build failed for ${d.file_name}:`, e?.message);
      skipped.push(d.file_name);
    }
  }
  return { uploads, skipped };
}

// ---------- Template resolver ----------
type ResolverCtx = {
  vendor: Record<string, any>;
  override: Record<string, any>;
  classify: Record<string, any>;
  uploads: any[];
  isMsme: boolean;
};

function getPath(obj: any, path: string): any {
  if (!obj) return undefined;
  return path.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

function applyFilter(value: any, filter: string): any {
  const [name, arg] = filter.split(":");
  switch (name) {
    case "trunc": {
      const n = parseInt(arg || "0", 10);
      if (value == null) return "";
      return String(value).slice(0, n);
    }
    case "upper": return value == null ? "" : String(value).toUpperCase();
    case "lower": return value == null ? "" : String(value).toLowerCase();
    case "default":
      return (value === undefined || value === null || value === "") ? (arg ?? "") : value;
    case "msme_flag":
      // If override is empty string, infer from isMsme via ctx (handled in resolveExpr)
      return value;
    case "msme_idtype": return value;
    case "msme_idnum": return value;
    default: return value;
  }
}

function resolveExpr(expr: string, ctx: ResolverCtx): any {
  // expr like: vendor.legal_name|trunc:40  OR  region(vendor.registered_state)  OR  uploads
  // Split filters
  const parts = expr.split("|").map(s => s.trim());
  const head = parts[0];
  const filters = parts.slice(1);

  let value: any;

  // Function-style helpers
  const fnMatch = head.match(/^(\w+)\((.*)\)$/);
  if (fnMatch) {
    const fn = fnMatch[1];
    const innerPath = fnMatch[2].trim();
    const inner = innerPath ? getPath(ctx, innerPath) : undefined;
    if (fn === "region") value = resolveRegion(inner);
    else value = "";
  } else if (head === "uploads") {
    value = ctx.uploads;
  } else if (head === "vendor.trade_name_first_word") {
    const t = ctx.vendor?.trade_name || "";
    value = String(t).split(" ")[0] || "";
  } else if (head === "vendor.registered_address_line3_or_2") {
    value = ctx.vendor?.registered_address_line3 || ctx.vendor?.registered_address_line2 || "";
  } else {
    value = getPath(ctx, head);
  }

  // Apply filters
  for (const f of filters) {
    const [name] = f.split(":");
    if (name === "msme_flag") {
      // value is the override value; if blank, infer
      if (value === undefined || value === null || value === "") {
        value = ctx.isMsme ? "MIC" : "";
      }
    } else if (name === "msme_idtype") {
      if (value === undefined || value === null || value === "") {
        value = ctx.isMsme ? "ZMSMEN" : "";
      }
    } else if (name === "msme_idnum") {
      if (value === undefined || value === null || value === "") {
        value = ctx.isMsme ? String(ctx.vendor?.msme_number || "").slice(0, 20) : "";
      }
    } else {
      value = applyFilter(value, f);
    }
  }

  if (value === undefined || value === null) value = "";
  return value;
}

function resolveTemplate(node: any, ctx: ResolverCtx): any {
  if (node == null) return node;
  if (typeof node === "string") {
    // Whole-string placeholder e.g. "{{uploads}}" -> raw value (could be array)
    const whole = node.match(/^\s*\{\{\s*(.+?)\s*\}\}\s*$/);
    if (whole) return resolveExpr(whole[1], ctx);
    // Inline interpolation
    return node.replace(/\{\{\s*(.+?)\s*\}\}/g, (_m, expr) => {
      const v = resolveExpr(expr, ctx);
      return v == null ? "" : String(v);
    });
  }
  if (Array.isArray(node)) return node.map(n => resolveTemplate(n, ctx));
  if (typeof node === "object") {
    const out: Record<string, any> = {};
    for (const k of Object.keys(node)) out[k] = resolveTemplate(node[k], ctx);
    return out;
  }
  return node;
}

// ---------- response helpers ----------
function ok(body: any) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
  });
}
function fail(message: string, extra: Record<string, any> = {}) {
  return ok({ success: false, message, sapResponse: [], ...extra });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuthenticatedUser(req, ['admin', 'sharvi_admin', 'customer_admin', 'finance', 'SAP Team']);
  if (!auth.ok) return authErrorResponse(auth, corsHeaders);

  try {
    const { vendorId, overrides, sapPayload: clientPayload } = await req.json();
    if (!vendorId) throw new Error("vendorId is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: vendor, error: vendorError } = await supabase
      .from("vendors").select("*").eq("id", vendorId).single();
    if (vendorError || !vendor) throw new Error(`Vendor not found: ${vendorError?.message}`);

    if (!vendor.registered_state || !resolveRegion(vendor.registered_state)) {
      return fail(
        `Cannot sync to SAP: vendor's Registered State "${vendor.registered_state || "(empty)"}" is not mapped to an SAP region code for country IN. Please correct the vendor's Registered State and retry.`,
      );
    }

    // Resolve SAP API config (proxy/middleware)
    const { data: configs } = await supabase
      .from("sap_api_configs").select("*").eq("is_active", true)
      .order("created_at", { ascending: false });

    const config = (configs || []).find((c: any) => {
      const n = (c.name || "").toLowerCase();
      return n.includes("business partner") || n.includes("bp create") || n.includes("vendor/bp") ||
             (c.endpoint_path || "").toLowerCase().includes("/vendor/bp/create");
    }) || (configs || [])[0];

    const envMiddlewareUrl = Deno.env.get("SAP_MIDDLEWARE_URL");
    const envMiddlewareKey = Deno.env.get("SAP_MIDDLEWARE_KEY");

    function normalizeMiddlewareBase(raw: string): string {
      if (!raw) return "";
      let v = String(raw).replace(/\s+/g, "").trim();
      v = v.replace(/\/+$/, "");
      v = v.replace(/\/sap\/bp\/create$/i, "");
      v = v.replace(/\/sap\/proxy$/i, "");
      v = v.replace(/\/health$/i, "");
      v = v.replace(/\/+$/, "");
      return v;
    }

    const rawMiddlewareUrl = config?.middleware_url || envMiddlewareUrl || "";
    const middlewareUrl = normalizeMiddlewareBase(rawMiddlewareUrl);
    const middlewareKey = (config?.proxy_secret || envMiddlewareKey || "").trim();
    const connectionMode = (config?.connection_mode || "proxy").toLowerCase();

    let targetUrl = "";
    let useMiddleware = false;
    if (connectionMode === "proxy") {
      if (!middlewareUrl) return fail("SAP middleware URL is not configured. Open SAP API Settings → Business Partner config and set 'Node.js Middleware URL'.");
      if (!middlewareKey) return fail("Proxy Secret / Password is not set in SAP API Settings.");
      if (!/^https?:\/\//i.test(middlewareUrl)) return fail(`The saved Node.js Middleware URL is invalid: "${rawMiddlewareUrl}".`);
      try { new URL(middlewareUrl); } catch { return fail(`The saved Node.js Middleware URL could not be parsed: "${rawMiddlewareUrl}".`); }
      useMiddleware = true;
      targetUrl = `${middlewareUrl}/sap/bp/create`;
    } else {
      const directBase = config?.base_url || "";
      const directPath = config?.endpoint_path || "";
      targetUrl = `${directBase.replace(/\/$/, "")}${directPath}`;
      if (!targetUrl) return fail("SAP direct URL is not configured (base_url + endpoint_path).");
    }

    let payload: any[];
    let row: any;

    if (Array.isArray(clientPayload) && clientPayload.length > 0 && typeof clientPayload[0] === "object") {
      // Client supplied a fully-resolved SAP payload — use it as-is.
      payload = clientPayload;
      row = clientPayload[0];
      console.log("Using client-supplied SAP payload, topLevelKeys:", Object.keys(row).length);
    } else {
      // Legacy path: resolve template server-side.
      const mergedOverrides: Record<string, any> = { ...(overrides || {}) };
      if (vendor.tenant_id) {
        const { data: defRow } = await supabase
          .from("sap_default_fields").select("*").eq("tenant_id", vendor.tenant_id).maybeSingle();
        if (defRow) {
          for (const k of ["partn_cat","partn_grp","title","taxtype","bukrs","akont","zuawa","fdgrv","vkorg","waers","kalsk","cdi","webre","lebre","ven_class"]) {
            if (mergedOverrides[k] === undefined || mergedOverrides[k] === null || mergedOverrides[k] === "") {
              if (defRow[k] !== undefined && defRow[k] !== null) mergedOverrides[k] = defRow[k];
            }
          }
        }
      }

      const productCats = Array.isArray(vendor.product_categories) ? vendor.product_categories : [];
      const ovClassify = (overrides && overrides.classify) || {};
      const classifyCtx = {
        MGV: ovClassify.MGV || vendor.material_group_vendor || (productCats[0] ? String(productCats[0]) : ""),
        CATV: ovClassify.CATV || vendor.vendor_category || vendor.organization_type || vendor.entity_type || "",
        LOCV: ovClassify.LOCV || vendor.vendor_location || vendor.registered_state || "",
        IDS: ovClassify.IDS || vendor.identification_source || "",
      };

      const isMsme = !!vendor.msme_number;

      let template: any = null;
      if (vendor.tenant_id) {
        const { data: tplRow } = await supabase
          .from("sap_payload_templates").select("template")
          .eq("tenant_id", vendor.tenant_id).eq("is_active", true).maybeSingle();
        if (tplRow?.template) template = tplRow.template;
      }
      if (!template) {
        const { data: tplRow } = await supabase
          .from("sap_payload_templates").select("template")
          .is("tenant_id", null).eq("is_active", true).maybeSingle();
        if (tplRow?.template) template = tplRow.template;
      }
      if (!template) {
        return fail("No SAP payload template configured. Please seed sap_payload_templates with a default row.");
      }

      // Document uploads are temporarily disabled to avoid SAP middleware 413 (PayloadTooLarge).
      // Re-enable by restoring: const { uploads, skipped } = await buildUploadArray(supabase, vendorId);
      const uploads: any[] = [];
      const skipped: string[] = [];

      const ctx: ResolverCtx = {
        vendor,
        override: mergedOverrides,
        classify: classifyCtx,
        uploads,
        isMsme,
      };

      row = resolveTemplate(template, ctx);
      payload = [row];

      if (skipped.length) console.warn("Skipped uploads:", skipped.join(", "));
    }

    console.log("SAP request via:", useMiddleware ? "middleware" : "direct", targetUrl,
      "topLevelKeys:", Object.keys(row).length);

    let sapResponse: any[] | null = null;
    let httpStatus = 0;
    let networkError: string | null = null;
    let upstreamWrapper: any = null;

    try {
      const controller = new AbortController();
      const timeoutMs = Math.max(5000, Math.min(config?.timeout_ms || 30000, 60000));
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const headers: Record<string, string> = { "Content-Type": "application/json" };

      if (useMiddleware) {
        if (middlewareKey) headers["x-middleware-key"] = middlewareKey;
      } else {
        const { data: creds } = await supabase
          .from("sap_api_credentials").select("*").eq("config_id", config?.id).maybeSingle();
        if (config?.auth_type === "Basic" && creds?.username) {
          headers["Authorization"] = `Basic ${btoa(`${creds.username}:${creds.password_encrypted ?? ""}`)}`;
        } else if (config?.auth_type === "Bearer" && creds?.password_encrypted) {
          headers["Authorization"] = `Bearer ${creds.password_encrypted}`;
        }
      }

      const res = await fetch(targetUrl, {
        method: "POST", headers, body: JSON.stringify(payload), signal: controller.signal,
      });
      clearTimeout(timer);
      httpStatus = res.status;
      const text = await res.text();
      console.log("SAP raw response status:", httpStatus, "body:", text.slice(0, 500));

      try {
        const parsed = JSON.parse(text);
        upstreamWrapper = useMiddleware ? parsed : null;
        const raw = useMiddleware && parsed && typeof parsed === "object" && "sapResponse" in parsed
          ? parsed.sapResponse : parsed;
        sapResponse = Array.isArray(raw) ? raw : (raw == null ? [] : [raw]);
      } catch {
        if (httpStatus >= 400) networkError = `Middleware/SAP HTTP ${httpStatus}: ${text.slice(0, 200) || "(empty body)"}`;
        else networkError = `Invalid JSON from SAP (HTTP ${httpStatus}): ${text.slice(0, 200)}`;
      }

      if (useMiddleware && upstreamWrapper && upstreamWrapper.ok === false) {
        const upstreamErr = String(upstreamWrapper.error || "").toLowerCase();
        if (httpStatus === 401 || upstreamErr.includes("unauthorized")) {
          networkError = "Middleware rejected the request (401 Unauthorized). The 'Proxy Secret / Password' in SAP API Settings does not match MIDDLEWARE_SHARED_SECRET in middleware/.env.";
        } else if (upstreamErr.includes("missing sap_bp_api_url") || upstreamErr.includes("sap_bp_username") || upstreamErr.includes("sap_bp_password")) {
          networkError = "Middleware is reachable but its .env is incomplete. Set SAP_BP_API_URL / SAP_BP_USERNAME / SAP_BP_PASSWORD in middleware/.env and restart it.";
        } else if (upstreamErr.includes("timed out") || upstreamErr.includes("timeout")) {
          networkError = "Middleware is reachable, but SAP timed out.";
        } else {
          networkError = `Middleware error: ${upstreamWrapper.error || `HTTP ${httpStatus}`}`;
        }
      } else if (httpStatus === 401 && useMiddleware && !networkError) {
        networkError = "Middleware rejected the request (401).";
      }
    } catch (e: any) {
      const raw = e?.message || "Network error reaching SAP";
      if (useMiddleware) {
        networkError = `Could not reach the middleware at ${targetUrl}. Underlying error: ${raw}`;
      } else {
        networkError = `Could not reach SAP directly at ${targetUrl}. Underlying error: ${raw}`;
      }
      console.error("SAP fetch error:", raw);
    }

    if (networkError) return fail(networkError, { sapResponse: sapResponse ?? [] });

    const successItem = (sapResponse || []).find(
      (it: any) => it?.MSGTYP === "S" && typeof it?.MSG === "string" && it.MSG.toLowerCase().includes("business partner created"),
    );
    const sapVendorCode = successItem?.BP_LIFNR || (sapResponse || []).find((i: any) => i?.BP_LIFNR)?.BP_LIFNR || null;

    if (successItem && sapVendorCode) {
      await supabase.from("vendors").update({
        sap_vendor_code: sapVendorCode,
        sap_synced_at: new Date().toISOString(),
        status: "sap_synced",
      }).eq("id", vendorId);
      return ok({ success: true, sapVendorCode, message: "Vendor successfully synced to SAP", sapResponse });
    }

    const errorItem = (sapResponse || []).find((it: any) => it?.MSGTYP === "E");
    return ok({ success: false, message: errorItem?.MSG || "SAP did not confirm Business Partner creation", sapResponse: sapResponse || [] });
  } catch (error: any) {
    console.error("sync-vendor-to-sap error:", error);
    return ok({ success: false, message: error.message || "Unexpected error", sapResponse: [] });
  }
});
