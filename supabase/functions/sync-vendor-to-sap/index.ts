import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuthenticatedUser, authErrorResponse } from "../_shared/auth.ts";
import { makeReqId, trace, traceFetch, safePreview, summarizeError } from "../_shared/trace.ts";

const SVC = "sync-vendor-to-sap";
const WHOLDTAX_FINAL_NORMALIZE_VERSION = "2026-07-07-wholdtax-final-boundary-v2";
const WHOLDTAX_BINDING_MODE = "direct-overrides-withholding";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
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

// Built-in fallback SAP payload template. Used when the deployed
// `sap_payload_templates` table has no active row (typical on fresh
// self-hosted servers). All `{{vendor.*}}` / `{{override.*}}` placeholders are
// resolved dynamically per request — no hardcoded vendor data.
const DEFAULT_SAP_PAYLOAD_TEMPLATE: any = {"cdi":"{{override.cdi|default:X}}","city":"{{vendor.registered_city|trunc:40}}","msme":"{{override.msme|msme_flag}}","akont":"{{override.akont|default:155000005}}","bukrs":"{{override.bukrs|default:1000}}","bzirk":"","fdgrv":"{{override.fdgrv|default:A1}}","idnum":"{{vendor.reference_no}}","inco1":"","inco2":"","kalks":"","kalsk":"{{override.kalsk|default:L1}}","kdgrp":"","kkber":"","konda":"","ktgrd":"","kurst":"","kzazu":"","langu":"EN","lebre":"{{override.lebre|default:X}}","lprio":"","name1":"{{vendor.legal_name|trunc:40}}","name2":"{{vendor.relative_name|trunc:40}}","name3":"","pernr":"","pltyp":"","qland":"","qsrec":"","spart":"","title":"{{override.title|default:0003}}","uebto":"","untto":"","versg":"","vkbur":"","vkgrp":"","vkorg":"{{override.vkorg|default:1000}}","vsbed":"","vtweg":"","waers":"{{override.waers|default:INR}}","webre":"{{override.webre|default:X}}","witht":"","xzver":"","zterm":"","zuawa":"{{override.zuawa|default:014}}","UPLOAD":"{{uploads}}","idnum2":"{{override.idnum2|msme_idnum}}","idtype":"SOLMN1","region":"{{region(vendor.registered_state)}}","sterm1":"{{vendor.legal_name|trunc:20}}","sterm2":"{{vendor.trade_name_first_word|trunc:20}}","street":"{{vendor.registered_address|trunc:60}}","zinco1":"","zinco2":"","zvkorg":"","zwaers":"","zzterm":"","bp_type":"","country":"IN","idtype2":"ZMSMEN","taxkd01":"","taxkd02":"","taxkd03":"","taxkd04":"","taxkd05":"","taxkd06":"","taxkd07":"","taxtype":"{{override.taxtype|default:IN3}}","vendors":[{"cdi":"{{override.cdi|default:X}}","city":"{{vendor.registered_city|trunc:40}}","msme":"{{override.msme|msme_flag}}","akont":"{{override.akont|default:155000005}}","bukrs":"{{override.bukrs|default:1000}}","idnum":"","inco1":"","inco2":"","kalsk":"{{override.kalsk|default:L1}}","ktokk":"","langu":"EN","lifnr":"","name2":"{{vendor.relative_name|trunc:40}}","name3":"","nodel":"","pernr":"","qland":"","qsrec":"","vkorg":"{{override.vkorg|default:1000}}","waers":"{{override.waers|default:INR}}","webre":"{{override.webre|default:X}}","witht":"","zterm":"","zuawa":"{{override.zuawa|default:014}}","idtype":"","region":"{{region(vendor.registered_state)}}","sterm1":"{{vendor.legal_name|trunc:20}}","sterm2":"","street":"{{vendor.registered_address|trunc:60}}","bp_type":"","country":"IN","taxtype":"{{override.taxtype|default:IN3}}","district":"","due_digi":"","house_no":"","location":"{{vendor.registered_state|trunc:40}}","taxnumxl":"{{vendor.gstin|trunc:20}}","j_1ipanno":"{{vendor.pan|trunc:10}}","partn_cat":"{{override.partn_cat|default:2}}","pur_block":"","smtp_addr":"{{vendor.primary_email_or_fallback|trunc:241}}","smtp_addr2":"{{vendor.secondary_email_value|trunc:241}}","ven_class":"{{override.ven_class}}","wt_subjct":"","wt_withcd":"","block_func":"","comp_block":"","mob_number":"{{vendor.primary_phone_or_fallback|trunc:30}}","mob_number2":"{{vendor.secondary_phone_value|trunc:30}}","postl_cod1":"{{vendor.registered_pincode|trunc:10}}","str_suppl1":"{{vendor.registered_address_line2|trunc:40}}","str_suppl2":"{{vendor.registered_address_line3|trunc:40}}","str_suppl3":"{{vendor.registered_address_line4|trunc:40}}","tel_number":"{{vendor.registered_phone|trunc:30}}","fax_number":"{{vendor.registered_fax|trunc:30}}","cent_pur_block":"","cent_post_block":""}],"CLASSIFY":{"CAT_VENDOR":[{"CATV":"{{classify.CATV|upper}}"}],"MAT_GRP_VENDOR":[{"MGV":"{{classify.MGV|upper}}"}],"LOCATION_VENDOR":[{"LOCV":"{{classify.LOCV|upper}}"}],"IDENTIFICATION_SOURCE":[{"IDS":"{{classify.IDS|upper}}"}]},"bank_key":"{{vendor.ifsc_code|trunc:15}}","bpartner":"","ctrl_key":"","district":"","due_digi":"","house_no":"","j_1iexcd":"","j_1iexco":"","j_1iexdi":"","j_1iexrg":"","j_1iexrn":"","j_1isern":"","legaenty":"","legaform":"","location":"{{vendor.registered_state|trunc:40}}","taxnumxl":"{{vendor.gstin|trunc:20}}","bank_acct":"{{vendor.account_number|trunc:18}}","bank_ctry":"IN","customers":[{"bukrs":"","idnum":"","kunnr":"","zterm":"","idtype":"","identrydate":"","idinstitute":""}],"j_1icstno":"","j_1ilstno":"","j_1ipanno":"{{vendor.pan|trunc:10}}","partn_cat":"{{override.partn_cat|default:2}}","partn_grp":"{{override.partn_grp|default:ZDOM}}","smtp_addr":"{{vendor.primary_email_or_fallback|trunc:241}}","ven_class":"{{override.ven_class}}","wt_subjct":"","wt_withcd":"","j_1iexcicu":"","mob_number":"{{vendor.primary_phone_or_fallback|trunc:30}}","mob_number2":"{{vendor.secondary_phone_value|trunc:30}}","postl_cod1":"{{vendor.registered_pincode|trunc:10}}","str_suppl1":"{{vendor.registered_address_line2|trunc:40}}","str_suppl2":"{{vendor.registered_address_line3|trunc:40}}","str_suppl3":"{{vendor.registered_address_line4|trunc:40}}","tel_number":"{{vendor.registered_phone|trunc:30}}","bankdetailid":"0001","accountholder":"{{vendor.account_holder_or_legal|trunc:60}}","bankaccountname":"{{vendor.account_holder_or_legal|trunc:60}}"};

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
  // Attach every uploaded vendor document. Each file is capped individually at MAX_UPLOAD_BYTES.
  const uploads: any[] = [];
  const skipped: string[] = [];
  const { data: docs, error } = await supabase
    .from("vendor_documents")
    .select("document_type, file_name, file_path, file_size, uploaded_at")
    .eq("vendor_id", vendorId)
    .order("uploaded_at", { ascending: false });
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
  isIntl: boolean;
  intlCountry: string;
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
    if (fn === "region") {
      if (ctx.isIntl) {
        value = inner == null ? "" : String(inner).trim().toUpperCase();
      } else {
        value = resolveRegion(inner);
      }
    }
    else value = "";
  } else if (head === "uploads") {
    value = ctx.uploads;
  } else if (head === "vendor.trade_name_first_word") {
    const t = ctx.vendor?.trade_name || "";
    value = String(t).split(" ")[0] || "";
  } else if (head === "vendor.reference_no") {
    value = String(ctx.vendor?.reference_number || ctx.vendor?.id || "").toUpperCase();
  } else if (head === "vendor.registered_address_line3_or_2") {
    value = ctx.vendor?.registered_address_line3 || ctx.vendor?.registered_address_line2 || "";
  } else if (head === "vendor.primary_email_or_fallback") {
    const v = ctx.vendor || {};
    value = v.registered_email || v.primary_email || v.registered_email_2 || v.branch_email || v.manufacturing_email || "";
  } else if (head === "vendor.primary_phone_or_fallback") {
    const v = ctx.vendor || {};
    value = v.registered_contact_1 || v.primary_phone || v.registered_phone || v.registered_contact_2 || "";
  } else if (head === "vendor.secondary_email_value") {
    const v = ctx.vendor || {};
    value = v.registered_email_2 || v.secondary_email || "";
  } else if (head === "vendor.secondary_phone_value") {
    const v = ctx.vendor || {};
    value = v.registered_contact_2 || v.secondary_phone || "";
  } else if (head === "vendor.name1_value") {
    const v: any = ctx.vendor || {};
    // Unified precedence: Trade → Legal → PAN/Account Holder.
    value = String(v.trade_name || v.legal_name || v.account_holder_name || "").trim();

  } else if (head === "vendor.ven_class_value") {
    const v: any = ctx.vendor || {};
    value = v.gstin && String(v.gstin).trim() ? "" : "0";
  } else if (head === "vendor.account_holder_or_legal") {
    const v = ctx.vendor || {};
    value = v.account_holder_name || v.legal_name || "";
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
    } else if (name === "default_ven_class") {
      if (value === undefined || value === null || value === "") {
        const v: any = ctx.vendor || {};
        value = v.gstin && String(v.gstin).trim() ? "" : "0";
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

function firstArray(...values: any[]) {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

function normalizeOverridesFromBody(body: any) {
  let base = body?.overrides ?? body?.override ?? body?.overide ?? body?.sapOverrides ?? {};
  if (Array.isArray(base)) base = { withholding: base };
  if (!base || typeof base !== "object") base = {};
  const withholding = firstArray(
    base?.withholding,
    base?.witholding,
    base?.WHOLDTAX,
    base?.wholdtax,
    body?.withholding,
    body?.witholding,
    body?.WHOLDTAX,
    body?.wholdtax,
    body?.overrideWithholding,
  );
  return withholding.length > 0 ? { ...base, withholding } : base;
}

function getWithholdingRows(overrides: any) {
  return firstArray(
    Array.isArray(overrides) ? overrides : null,
    overrides?.withholding,
    overrides?.witholding,
    overrides?.WHOLDTAX,
    overrides?.wholdtax,
  );
}

function normalizeWholdtax(overrides: any, vendorCountry: string, lifnr = "") {
  const wt = getWithholdingRows(overrides);
  const resolvedLifnr = String(lifnr ?? "").trim();
  return wt
    .map((r: any) => {
      const witht = String(r?.witht ?? r?.WITHT ?? "").trim();
      if (!witht) return null;
      const wtWithcd = String(r?.wt_withcd ?? r?.WT_WITHCD ?? "").trim();
      const rawSubject = r?.wt_subjct ?? r?.WT_SUBJCT;
      const subjectText = String(rawSubject || "").trim().toUpperCase();
      const subject = rawSubject === true || rawSubject === 1 || ["X", "Y", "YES", "TRUE", "1"].includes(subjectText);
      const qsrec = String(r?.qsrec ?? r?.QSREC ?? "").trim();
      const qland = String(r?.qland ?? r?.QLAND ?? vendorCountry ?? "IN").trim().toUpperCase();
      return {
        LIFNR: resolvedLifnr,
        WITHT: witht,
        WT_WITHCD: wtWithcd,
        WT_SUBJCT: subject ? "X" : "",
        QSREC: qsrec,
        QLAND: qland || "IN",
      };
    })
    .filter(Boolean);
}

function applyFinalWholdtax(row: any, overrides: any, vendorCountry: string, lifnr = "") {
  if (!row || typeof row !== "object") return [];
  const wholdtax = normalizeWholdtax(overrides, vendorCountry, lifnr);
  row.WHOLDTAX = wholdtax;
  delete row.wholdtax;
  return wholdtax;
}

function summarizeWholdtax(rows: any[]) {
  return (rows || []).map((r: any) => ({
    WITHT: r?.WITHT || "",
    WT_WITHCD: r?.WT_WITHCD || "",
    WT_SUBJCT: r?.WT_SUBJCT || "",
    QSREC: r?.QSREC || "",
    QLAND: r?.QLAND || "",
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const reqId = makeReqId(req);
  const tStart = Date.now();
  trace(reqId, SVC, "req.received", { method: req.method, url: req.url });

  const auth = await requireAuthenticatedUser(req, ['admin', 'sharvi_admin', 'customer_admin', 'finance', 'SAP Team']);
  if (!auth.ok) {
    trace(reqId, SVC, "auth.failed", {});
    return authErrorResponse(auth, corsHeaders);
  }
  trace(reqId, SVC, "auth.ok", { userId: auth.userId });

  try {
    const body = await req.json();
    const { vendorId, sapPayload: clientPayload } = body;
    const overrides = normalizeOverridesFromBody(body);
    if (!vendorId) throw new Error("vendorId is required");
    trace(reqId, SVC, "body.parsed", { vendorId, hasOverrides: Boolean(overrides), hasClientPayload: Array.isArray(clientPayload) });
    console.log(JSON.stringify({
      svc: SVC,
      stage: "version",
      version: WHOLDTAX_FINAL_NORMALIZE_VERSION,
      vendorId,
    }));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: vendor, error: vendorError } = await supabase
      .from("vendors").select("*").eq("id", vendorId).single();
    if (vendorError || !vendor) throw new Error(`Vendor not found: ${vendorError?.message}`);

    const isIntl = String((vendor as any).vendor_type || "").toLowerCase() === "international";
    const intlCountry = String((vendor as any).branch_country || "").trim().toUpperCase();

    if (isIntl) {
      if (!intlCountry) {
        return fail(
          `Cannot sync to SAP: international vendor is missing the SAP Country code. Please set the vendor's Country and retry.`,
        );
      }
      if (!vendor.registered_state) {
        return fail(
          `Cannot sync to SAP: international vendor is missing the SAP Region code. Please set the vendor's Region and retry.`,
        );
      }
    } else if (!vendor.registered_state || !resolveRegion(vendor.registered_state)) {
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

    function parseHostRewrites(): { from: string; to: string }[] {
      return (Deno.env.get("SAP_MIDDLEWARE_HOST_REWRITES") || "")
        .split(",").map((s) => s.trim()).filter(Boolean)
        .map((pair) => { const [f, t] = pair.split("="); return { from: (f || "").trim(), to: (t || "").trim() }; })
        .filter((p) => p.from && p.to);
    }
    function rewriteContainerHost(u: string): string {
      if (!u) return u;
      try {
        const url = new URL(u);
        const hit = parseHostRewrites().find((r) => r.from === url.hostname);
        if (hit) {
          const from = url.hostname;
          url.hostname = hit.to;
          console.log(JSON.stringify({ svc: "sync-vendor-to-sap", stage: "middleware.url.rewritten", from, to: hit.to, finalUrl: url.toString().replace(/\/+$/, ""), source: "host-rewrite-list" }));
          return url.toString().replace(/\/+$/, "");
        }
        if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
          const from = url.hostname;
          url.hostname = "172.17.0.1";
          console.log(JSON.stringify({ svc: "sync-vendor-to-sap", stage: "middleware.url.rewritten", from, to: "172.17.0.1", finalUrl: url.toString().replace(/\/+$/, ""), source: "loopback" }));
          return url.toString().replace(/\/+$/, "");
        }
      } catch { /* ignore */ }
      return u;
    }
    function normalizeMiddlewareBase(raw: string): string {
      const override = (Deno.env.get("SAP_MIDDLEWARE_URL_OVERRIDE") || "").trim();
      const source = override || raw;
      if (!source) return "";
      let v = String(source).replace(/\s+/g, "").trim();
      v = v.replace(/\/+$/, "");
      v = v.replace(/\/sap\/bp\/create$/i, "");
      v = v.replace(/\/sap\/proxy$/i, "");
      v = v.replace(/\/health$/i, "");
      v = v.replace(/\/+$/, "");
      return rewriteContainerHost(v);
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
      // Client supplied a fully-resolved SAP payload — use it but re-normalize CLASSIFY
      // so the on-the-wire shape is always { MAT_GRP_VENDOR: [{MGV: v}], ... }.
      payload = clientPayload;
      row = clientPayload[0];

      const toArr = (v: any): string[] =>
        Array.isArray(v) ? v.filter(Boolean).map(String) : (v ? [String(v)] : []);
      const ovClassify = (overrides && (overrides as any).classify) || {};
      const hasClassifyOverride = !!(overrides && typeof (overrides as any).classify === 'object' && (overrides as any).classify !== null);
      const hasOv = (k: string) => hasClassifyOverride && Object.prototype.hasOwnProperty.call((overrides as any).classify, k);
      const classifyArrays = {
        MGV: hasOv('MGV') ? toArr(ovClassify.MGV)
          : (toArr(vendor.material_group_vendors).length ? toArr(vendor.material_group_vendors)
          : (toArr(vendor.material_group_vendor).length ? toArr(vendor.material_group_vendor)
          : toArr(vendor.product_categories))),
        CATV: hasOv('CATV') ? toArr(ovClassify.CATV)
          : (toArr(vendor.vendor_categories).length ? toArr(vendor.vendor_categories)
          : toArr(vendor.vendor_category || vendor.organization_type || vendor.entity_type)),
        LOCV: hasOv('LOCV') ? toArr(ovClassify.LOCV)
          : (toArr(vendor.vendor_locations).length ? toArr(vendor.vendor_locations)
          : toArr(vendor.vendor_location || vendor.registered_state)),
        IDS: hasOv('IDS') ? toArr(ovClassify.IDS)
          : (toArr(vendor.identification_sources).length ? toArr(vendor.identification_sources)
          : toArr(vendor.identification_source)),
        CASH: hasOv('CASH') ? toArr(ovClassify.CASH)
          : toArr(vendor.vendor_cashflow),
        TIER: hasOv('TIER') ? toArr(ovClassify.TIER)
          : toArr(vendor.tier_category),
      };
      const wrap = (arr: string[], key: "MGV" | "CATV" | "LOCV" | "IDS" | "CASH" | "VENCAT") =>
        (arr || [])
          .map((v) => (v == null ? "" : String(v).trim()))
          .filter(Boolean)
          .map((v) => ({ [key]: v }));
      row.CLASSIFY = {
        MAT_GRP_VENDOR:        wrap(classifyArrays.MGV,  "MGV"),
        CAT_VENDOR:            wrap(classifyArrays.CATV, "CATV"),
        LOCATION_VENDOR:       wrap(classifyArrays.LOCV, "LOCV"),
        IDENTIFICATION_SOURCE: wrap(classifyArrays.IDS,  "IDS"),
        CASHFLOW:              wrap(classifyArrays.CASH, "CASH"),
        VENCATEGORY:           wrap(classifyArrays.TIER, "VENCAT"),
      };
      delete (row as any).classify;

      const ovMsmeNo = (overrides && Object.prototype.hasOwnProperty.call(overrides, 'reg_msme_no'))
        ? (overrides.reg_msme_no ?? '') : vendor.msme_number;
      const ovMsmeAct = (overrides && Object.prototype.hasOwnProperty.call(overrides, 'reg_msme_act'))
        ? (overrides.reg_msme_act ?? '') : vendor.msme_major_activity;
      const msmeOff = overrides && Object.prototype.hasOwnProperty.call(overrides, 'reg_is_msme') && !overrides.reg_is_msme;
      const effMsmeNo = msmeOff ? '' : (ovMsmeNo || '');
      const effMsmeAct = msmeOff ? '' : (ovMsmeAct || '');
      // Files are uploaded separately via sync-vendor-to-dms; never include them here.
      row.UPLOAD = [];
      row.idtype = "SOLMN1";
      row.idnum = String(vendor.reference_number || vendor.id || "").toUpperCase();
      row.idtype2 = "ZMSMEN";
      row.idnum2 = effMsmeNo ? String(effMsmeNo).slice(0, 20) : "";
      row.IDCATG = effMsmeAct ? String(effMsmeAct) : "";

      // WHOLDTAX is applied again at the final outgoing boundary below.
      console.log("Using client-supplied SAP payload, topLevelKeys:", Object.keys(row).length, "WHOLDTAX rows:", Array.isArray(row.WHOLDTAX) ? row.WHOLDTAX.length : 0);
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
      const ovClassify = (overrides && (overrides as any).classify) || {};
      const hasClassifyOverride = !!(overrides && typeof (overrides as any).classify === 'object' && (overrides as any).classify !== null);
      const hasOv = (k: string) => hasClassifyOverride && Object.prototype.hasOwnProperty.call((overrides as any).classify, k);
      const toArr = (v: any): string[] =>
        Array.isArray(v) ? v.filter(Boolean).map(String) : (v ? [String(v)] : []);
      const classifyArrays = {
        MGV: hasOv('MGV') ? toArr(ovClassify.MGV)
          : (toArr(vendor.material_group_vendors).length ? toArr(vendor.material_group_vendors)
          : (toArr(vendor.material_group_vendor).length ? toArr(vendor.material_group_vendor)
          : productCats.map(String))),
        CATV: hasOv('CATV') ? toArr(ovClassify.CATV)
          : (toArr(vendor.vendor_categories).length ? toArr(vendor.vendor_categories)
          : toArr(vendor.vendor_category || vendor.organization_type || vendor.entity_type)),
        LOCV: hasOv('LOCV') ? toArr(ovClassify.LOCV)
          : (toArr(vendor.vendor_locations).length ? toArr(vendor.vendor_locations)
          : toArr(vendor.vendor_location || vendor.registered_state)),
        IDS: hasOv('IDS') ? toArr(ovClassify.IDS)
          : (toArr(vendor.identification_sources).length ? toArr(vendor.identification_sources)
          : toArr(vendor.identification_source)),
        CASH: hasOv('CASH') ? toArr(ovClassify.CASH)
          : toArr(vendor.vendor_cashflow),
        TIER: hasOv('TIER') ? toArr(ovClassify.TIER)
          : toArr(vendor.tier_category),
      };
      const classifyCtx = {
        MGV: classifyArrays.MGV[0] || "",
        CATV: classifyArrays.CATV[0] || "",
        LOCV: classifyArrays.LOCV[0] || "",
        IDS: classifyArrays.IDS[0] || "",
        CASH: classifyArrays.CASH[0] || "",
        TIER: classifyArrays.TIER[0] || "",
      };

      const isMsme = !!vendor.msme_number;

      let template: any = null;
      try {
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
      } catch (e) {
        console.warn("sap_payload_templates lookup failed, using built-in default:", (e as any)?.message);
      }
      if (!template) {
        console.log("Using built-in DEFAULT_SAP_PAYLOAD_TEMPLATE fallback (no DB row found)");
        template = JSON.parse(JSON.stringify(DEFAULT_SAP_PAYLOAD_TEMPLATE));
      }

      // Files are uploaded separately via sync-vendor-to-dms; never include them in the BP-create payload.
      const ovMsmeNo2 = (overrides && Object.prototype.hasOwnProperty.call(overrides, 'reg_msme_no'))
        ? (overrides.reg_msme_no ?? '') : vendor.msme_number;
      const msmeOff2 = overrides && Object.prototype.hasOwnProperty.call(overrides, 'reg_is_msme') && !overrides.reg_is_msme;
      const effMsmeNo2 = msmeOff2 ? '' : (ovMsmeNo2 || '');
      const uploads: any[] = [];

      const ctx: ResolverCtx = {
        vendor,
        override: mergedOverrides,
        classify: classifyCtx,
        uploads,
        isMsme,
        isIntl,
        intlCountry,
      };

      row = resolveTemplate(template, ctx);

      // Post-process CLASSIFY — one wrapper object per value, [] when empty,
      // and strip any lowercase `classify` key from the outgoing row.
      const wrap = (arr: string[], key: "MGV" | "CATV" | "LOCV" | "IDS" | "CASH" | "VENCAT") =>
        (arr || [])
          .map((v) => (v == null ? "" : String(v).trim()))
          .filter(Boolean)
          .map((v) => ({ [key]: v }));
      if (row && typeof row === "object") {
        row.CLASSIFY = {
          MAT_GRP_VENDOR:        wrap(classifyArrays.MGV,  "MGV"),
          CAT_VENDOR:            wrap(classifyArrays.CATV, "CATV"),
          LOCATION_VENDOR:       wrap(classifyArrays.LOCV, "LOCV"),
          IDENTIFICATION_SOURCE: wrap(classifyArrays.IDS,  "IDS"),
          CASHFLOW:              wrap(classifyArrays.CASH, "CASH"),
          VENCATEGORY:           wrap(classifyArrays.TIER, "VENCAT"),
        };
        delete (row as any).classify;
        row.UPLOAD = [];
        row.idtype = "SOLMN1";
        row.idnum = String(vendor.reference_number || vendor.id || "").toUpperCase();
        row.idtype2 = "ZMSMEN";
        row.idnum2 = effMsmeNo2 ? String(effMsmeNo2).slice(0, 20) : "";
        const ovMsmeAct2 = (overrides && Object.prototype.hasOwnProperty.call(overrides, 'reg_msme_act'))
          ? (overrides.reg_msme_act ?? '') : vendor.msme_major_activity;
        const effMsmeAct2 = msmeOff2 ? '' : (ovMsmeAct2 || '');
        row.IDCATG = effMsmeAct2 ? String(effMsmeAct2) : "";

        // WHOLDTAX is applied again at the final outgoing boundary below.

        // For international vendors, replace hardcoded "IN" country codes in
        // the resolved payload with the vendor's actual SAP country code.
        if (isIntl && intlCountry) {
          const overrideCountry = (node: any) => {
            if (!node || typeof node !== "object") return;
            if (Array.isArray(node)) { node.forEach(overrideCountry); return; }
            for (const k of Object.keys(node)) {
              if ((k === "country" || k === "bank_ctry") && (node[k] === "IN" || node[k] === "")) {
                node[k] = intlCountry;
              } else if (node[k] && typeof node[k] === "object") {
                overrideCountry(node[k]);
              }
            }
          };
          overrideCountry(row);
        }
      }

      payload = [row];

      
    }

    // Final WHOLDTAX boundary: always overwrite stale/blank WHOLDTAX rows from
    // the resolved client/template payload with the selected SAP popup rows.
    const finalVendorCountry = isIntl
      ? (intlCountry || "IN")
      : String((vendor as any)?.country || "IN").toUpperCase();
    const finalLifnr = String((vendor as any)?.sap_vendor_code || (row as any)?.LIFNR || (row as any)?.lifnr || "").trim();
    const finalWholdtax = applyFinalWholdtax(row, overrides, finalVendorCountry, finalLifnr);
    if (Array.isArray(payload) && payload[0] && payload[0] !== row) {
      applyFinalWholdtax(payload[0], overrides, finalVendorCountry, finalLifnr);
    }
    console.log(JSON.stringify({
      svc: SVC,
      stage: "wholdtax.final",
      version: WHOLDTAX_FINAL_NORMALIZE_VERSION,
      bindingMode: WHOLDTAX_BINDING_MODE,
      selectedRows: Array.isArray((overrides as any)?.withholding) ? (overrides as any).withholding.length : 0,
      finalRows: finalWholdtax.length,
      rows: summarizeWholdtax(finalWholdtax),
    }));

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

      trace(reqId, SVC, "upstream.prepared", {
        targetUrl,
        useMiddleware,
        timeoutMs,
        payloadBytes: JSON.stringify(payload).length,
        topLevelKeys: Array.isArray(payload) && payload[0] ? Object.keys(payload[0]).length : 0,
      });
      const res = await traceFetch(reqId, SVC, targetUrl, {
        method: "POST", headers, body: JSON.stringify(payload), signal: controller.signal,
      }, { label: useMiddleware ? "middleware" : "sap-direct" });
      clearTimeout(timer);
      httpStatus = res.status;
      const text = await res.text();
      trace(reqId, SVC, "upstream.body", { httpStatus, bytes: text.length, preview: safePreview(text) });
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
      trace(reqId, SVC, "upstream.error", { useMiddleware, targetUrl, ...summarizeError(e) });
      if (useMiddleware) {
        networkError = `Could not reach the middleware at ${targetUrl}. Underlying error: ${raw}`;
      } else {
        networkError = `Could not reach SAP directly at ${targetUrl}. Underlying error: ${raw}`;
      }
      console.error("SAP fetch error:", raw);
    }

    if (networkError) return fail(networkError, { sapResponse: sapResponse ?? [], ACC_RES: [] });

    // SAP wraps the result as [{ ACC_RES: [...], TOT_RES: [...] }].
    // ACC_RES is the authoritative success block (BP creation confirmation).
    let accRes: any[] = [];
    const firstItem = (sapResponse || [])[0];
    if (firstItem && typeof firstItem === "object" && Array.isArray(firstItem.ACC_RES)) {
      accRes = firstItem.ACC_RES;
    } else {
      // Legacy/flat shape fallback — synthesize an ACC_RES-shaped row so the UI still renders.
      const flat = sapResponse || [];
      const s = flat.find((it: any) => it?.MSGTYP === "S" && (it?.VENDOR || it?.BP_LIFNR));
      const e = flat.find((it: any) => it?.MSGTYP === "E");
      if (s) accRes = [{ MSGTYP: "S", VENDOR: s.VENDOR || s.BP_LIFNR, BP_LIFNR: s.VENDOR || s.BP_LIFNR, BP_LIFNR_ORIG: s.BP_LIFNR || "", LONGMSG: s.MSG || "Business Partner created", BPNAME: s.BPNAME }];
      else if (e) accRes = [{ MSGTYP: "E", VENDOR: e.VENDOR || e.BP_LIFNR || "", BP_LIFNR: e.VENDOR || e.BP_LIFNR || "", BP_LIFNR_ORIG: e.BP_LIFNR || "", LONGMSG: e.MSG || "SAP returned an error", BPNAME: e.BPNAME }];
    }

    // Normalize so every row exposes a VENDOR field strictly preferred,
    // and overwrite BP_LIFNR with VENDOR for downstream UI consumers (keep original under BP_LIFNR_ORIG).
    accRes = accRes.map((r: any) => {
      const vendorVal = r?.VENDOR || r?.BP_LIFNR || "";
      return { ...r, VENDOR: vendorVal, BP_LIFNR_ORIG: r?.BP_LIFNR_ORIG ?? r?.BP_LIFNR ?? "", BP_LIFNR: vendorVal };
    });

    const successRow = accRes.find((r: any) => r?.MSGTYP === "S" && r?.VENDOR);
    const sapVendorCode = successRow?.VENDOR || null;

    if (successRow && sapVendorCode) {
      const refNo = String(vendor.reference_number || vendor.id || "").toUpperCase();
      await supabase.from("vendors").update({
        sap_vendor_code: sapVendorCode,
        sap_reference_no: refNo,
        sap_synced_at: new Date().toISOString(),
        status: "dms_sync_pending",
      }).eq("id", vendorId);

      // Best-effort: notify the buyer who invited/created this vendor.
      try {
        const { data: invite } = await supabase
          .from("vendor_invitations")
          .select("created_by")
          .eq("vendor_id", vendorId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const buyerUserId = (invite as any)?.created_by;
        if (buyerUserId) {
          const { data: buyer } = await supabase
            .from("profiles")
            .select("email, full_name")
            .eq("id", buyerUserId)
            .maybeSingle();
          const buyerEmail = (buyer as any)?.email;
          const buyerName = (buyer as any)?.full_name || "Buyer";

          // Buyer company (tenant) lookup for email content.
          let tenantName: string | null = null;
          let tenantCode: string | null = null;
          if ((vendor as any)?.tenant_id) {
            const { data: tenantRow } = await supabase
              .from("tenants")
              .select("name, code")
              .eq("id", (vendor as any).tenant_id)
              .maybeSingle();
            tenantName = (tenantRow as any)?.name ?? null;
            tenantCode = (tenantRow as any)?.code ?? null;
          }
          const buyerCompanyDisplay = tenantName
            ? (tenantCode ? `${tenantName} (${tenantCode})` : tenantName)
            : null;

          // Also send the same SAP-success email to the vendor's registered email.
          let vendorEmail: string | null = null;
          try {
            vendorEmail = ((vendor as any)?.primary_email || "").trim() || null;
            if (!vendorEmail && (vendor as any)?.invitation_id) {
              const { data: inv } = await supabase
                .from("vendor_invitations")
                .select("email")
                .eq("id", (vendor as any).invitation_id)
                .maybeSingle();
              vendorEmail = ((inv as any)?.email || "").trim() || null;
            }
          } catch (_) { /* ignore */ }

          const recipients: string[] = [];
          if (buyerEmail) recipients.push(buyerEmail);
          if (vendorEmail && vendorEmail.toLowerCase() !== (buyerEmail || "").toLowerCase()) {
            recipients.push(vendorEmail);
          }

          if (recipients.length > 0) {
            const legal = vendor.legal_name || vendor.trade_name || "Vendor";
            const trade = vendor.trade_name || "";
            const syncedAt = new Date().toLocaleString('en-IN', {
              timeZone: 'Asia/Kolkata',
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit', second: '2-digit',
              hour12: true,
            }) + ' IST';
            const subject = `Vendor ${legal} successfully created in SAP (${sapVendorCode})`;
            const okRow = (k: string, v: string, mono = false) =>
              `<tr>
                <td style="padding:10px 14px;border-bottom:1px solid #a7f3d0;background:#ecfdf5;color:#065f46;font-weight:600;width:38%">${k}</td>
                <td style="padding:10px 14px;border-bottom:1px solid #a7f3d0;background:#ffffff;color:#064e3b;${mono ? "font-family:'Courier New',monospace;" : ''}">${v}</td>
              </tr>`;
            const html = `
              <div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;font-size:14px;max-width:640px;margin:auto">
                <p>Dear ${buyerName},</p>
                <p>The vendor you onboarded has been <b>successfully created in SAP</b>.</p>
                <div style="border:1px solid #6ee7b7;border-radius:12px;overflow:hidden;margin:16px 0;box-shadow:0 1px 2px rgba(5,150,105,0.08)">
                  <div style="background:linear-gradient(90deg,#d1fae5,#dcfce7);padding:12px 16px;border-bottom:1px solid #6ee7b7">
                    <div style="font-size:15px;font-weight:700;color:#065f46;line-height:1.2">&#10003;&nbsp; Vendor Details</div>
                    <div style="font-size:11px;color:#047857;margin-top:2px">Successfully created in SAP</div>
                  </div>
                  <table style="border-collapse:collapse;width:100%;font-size:14px">
                    ${okRow("SAP Vendor Code", sapVendorCode, true)}
                    ${okRow("Vendor Legal Name", legal)}
                    ${trade ? okRow("Trade Name", trade) : ""}
                    ${buyerCompanyDisplay ? okRow("Buyer Company", buyerCompanyDisplay) : ""}
                    ${okRow("Reference No.", refNo, true)}
                    ${okRow("Synced At", syncedAt)}
                  </table>
                </div>
                <p style="margin-top:16px;">You can review this vendor in the Ramky Vyapaar Portal.</p>
                <p style="margin-top:16px;font-size:13px;color:#374151">For any queries, please contact <a href="mailto:vyapaarsupport@ramky.com" style="color:#1e3a5f;text-decoration:none;font-weight:600">vyapaarsupport@ramky.com</a>.</p>
                <p>Regards,<br/>Ramky Vyapaar Portal</p>
              </div>`;
            const { error: mailErr } = await supabase.functions.invoke("send-smtp-email", {
              body: { to: recipients, subject, html },
            });
            if (mailErr) {
              console.error("SAP-success email failed:", mailErr);
            } else {
              try {
                await supabase.from("audit_logs").insert({
                  action: "sap_sync_buyer_notified",
                  details: {
                    vendor_id: vendorId,
                    buyer_user_id: buyerUserId,
                    buyer_email: buyerEmail,
                    vendor_email: vendorEmail,
                    recipients,
                    sap_vendor_code: sapVendorCode,
                    tenant_id: (vendor as any)?.tenant_id ?? null,
                    tenant_name: tenantName,
                    tenant_code: tenantCode,
                  },
                });
              } catch (_) { /* ignore */ }
            }
          }

        }
      } catch (notifyErr: any) {
        console.error("buyer notification skipped:", notifyErr?.message || notifyErr);
      }

      return ok({
        success: true,
        sapVendorCode,
        sapReferenceNo: refNo,
        message: successRow.LONGMSG || successRow.MSG || "Vendor successfully synced to SAP",
        ACC_RES: accRes,
        sapResponse,
      });
    }


    const errorRow = accRes.find((r: any) => r?.MSGTYP !== "S");
    return ok({
      success: false,
      message: errorRow?.LONGMSG || errorRow?.MSG || (accRes.length === 0 ? "SAP returned no ACC_RES rows" : "SAP did not return a success row"),
      ACC_RES: accRes,
      sapResponse: sapResponse || [],
    });
  } catch (error: any) {
    trace(reqId, SVC, "unhandled.error", { ...summarizeError(error), elapsedTotalMs: Date.now() - tStart });
    console.error("sync-vendor-to-sap error:", error);
    return ok({ success: false, message: error.message || "Unexpected error", sapResponse: [], reqId });
  }
});
