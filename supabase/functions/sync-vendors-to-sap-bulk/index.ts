import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuthenticatedUser, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SVC = "sync-vendors-to-sap-bulk";
const WHOLDTAX_FINAL_NORMALIZE_VERSION = "2026-07-07-wholdtax-final-boundary-v1";

function ok(body: any) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
}

function fail(message: string, extra: Record<string, any> = {}) {
  return ok({ success: false, message, ACC_RES: [], ...extra });
}

function normalizeWholdtax(overrides: any, vendorCountry: string) {
  const wt = Array.isArray(overrides?.withholding) ? overrides.withholding : [];
  return wt
    .map((r: any) => {
      const witht = String(r?.witht ?? r?.WITHT ?? "").trim();
      if (!witht) return null;
      const wtWithcd = String(r?.wt_withcd ?? r?.WT_WITHCD ?? "").trim();
      const rawSubject = r?.wt_subjct ?? r?.WT_SUBJCT;
      const subject = rawSubject === true || String(rawSubject || "").trim().toUpperCase() === "X";
      const qsrec = String(r?.qsrec ?? r?.QSREC ?? "").trim();
      const qland = String(r?.qland ?? r?.QLAND ?? vendorCountry ?? "IN").trim().toUpperCase();
      return {
        LIFNR: "",
        WITHT: witht,
        WT_WITHCD: wtWithcd,
        WT_SUBJCT: subject ? "X" : "",
        QSREC: qsrec,
        QLAND: qland || "IN",
      };
    })
    .filter(Boolean);
}

function applyFinalWholdtax(row: any, overrides: any, vendorCountry: string) {
  if (!row || typeof row !== "object") return [];
  const wholdtax = normalizeWholdtax(overrides, vendorCountry);
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
      console.log(JSON.stringify({ svc: "sync-vendors-to-sap-bulk", stage: "middleware.url.rewritten", from, to: hit.to, finalUrl: url.toString().replace(/\/+$/, ""), source: "host-rewrite-list" }));
      return url.toString().replace(/\/+$/, "");
    }
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
      const from = url.hostname;
      url.hostname = "172.17.0.1";
      console.log(JSON.stringify({ svc: "sync-vendors-to-sap-bulk", stage: "middleware.url.rewritten", from, to: "172.17.0.1", finalUrl: url.toString().replace(/\/+$/, ""), source: "loopback" }));
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuthenticatedUser(req, ['admin', 'sharvi_admin', 'customer_admin', 'finance', 'SAP Team']);
  if (!auth.ok) return authErrorResponse(auth, corsHeaders);

  try {
    const { vendorIds, sapPayload, overrides } = await req.json();
    if (!Array.isArray(vendorIds) || vendorIds.length === 0) {
      return fail("vendorIds (array) is required");
    }
    if (!Array.isArray(sapPayload) || sapPayload.length === 0) {
      return fail("sapPayload (array) is required");
    }
    console.log(JSON.stringify({
      svc: SVC,
      stage: "version",
      version: WHOLDTAX_FINAL_NORMALIZE_VERSION,
      vendorCount: vendorIds.length,
    }));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load vendors for mapping idnum -> vendor
    const { data: vendors, error: vErr } = await supabase
      .from("vendors").select("*").in("id", vendorIds);
    if (vErr) return fail(`Failed to load vendors: ${vErr.message}`);

    // Force idnum/idtype per vendor row in payload so the middleware response can be correlated.
    const idnumToVendor: Record<string, any> = {};
    const toArr = (v: any): string[] =>
      Array.isArray(v) ? v.filter(Boolean).map(String) : (v ? [String(v)] : []);
    const wrap = (arr: string[], key: "MGV" | "CATV" | "LOCV" | "IDS" | "CASH" | "VENCAT") =>
      (arr || [])
        .map((v) => (v == null ? "" : String(v).trim()))
        .filter(Boolean)
        .map((v) => ({ [key]: v }));
    const enriched = sapPayload.map((row: any, i: number) => {
      const vid = vendorIds[i];
      const vendor = (vendors || []).find((v: any) => v.id === vid);
      const refNo = String(vendor?.reference_number || vid || "").toUpperCase();
      idnumToVendor[refNo] = vendor;

      const ovClassify = (row && row.classify) || {};
      const hasClassifyOverride = !!(row && typeof row.classify === 'object' && row.classify !== null);
      const hasOv = (k: string) => hasClassifyOverride && Object.prototype.hasOwnProperty.call(row.classify, k);
      const classifyArrays = {
        MGV: hasOv('MGV') ? toArr(ovClassify.MGV)
          : (toArr(vendor?.material_group_vendors).length ? toArr(vendor?.material_group_vendors)
          : (toArr(vendor?.material_group_vendor).length ? toArr(vendor?.material_group_vendor)
          : toArr(vendor?.product_categories))),
        CATV: hasOv('CATV') ? toArr(ovClassify.CATV)
          : (toArr(vendor?.vendor_categories).length ? toArr(vendor?.vendor_categories)
          : toArr(vendor?.vendor_category || vendor?.organization_type || vendor?.entity_type)),
        LOCV: hasOv('LOCV') ? toArr(ovClassify.LOCV)
          : (toArr(vendor?.vendor_locations).length ? toArr(vendor?.vendor_locations)
          : toArr(vendor?.vendor_location || vendor?.registered_state)),
        IDS: hasOv('IDS') ? toArr(ovClassify.IDS)
          : (toArr(vendor?.identification_sources).length ? toArr(vendor?.identification_sources)
          : toArr(vendor?.identification_source)),
        CASH: hasOv('CASH') ? toArr(ovClassify.CASH)
          : toArr(vendor?.vendor_cashflow),
        TIER: hasOv('TIER') ? toArr(ovClassify.TIER)
          : toArr(vendor?.tier_category),
      };

      const { classify: _drop, wholdtax: _dropWt, ...rest } = row || {};

      const vendorCountry = String((vendor as any)?.country || "IN").toUpperCase();
      const WHOLDTAX = normalizeWholdtax(overrides, vendorCountry);

      return {
        ...rest,
        CLASSIFY: {
          MAT_GRP_VENDOR:        wrap(classifyArrays.MGV,  "MGV"),
          CAT_VENDOR:            wrap(classifyArrays.CATV, "CATV"),
          LOCATION_VENDOR:       wrap(classifyArrays.LOCV, "LOCV"),
          IDENTIFICATION_SOURCE: wrap(classifyArrays.IDS,  "IDS"),
          CASHFLOW:              wrap(classifyArrays.CASH, "CASH"),
          VENCATEGORY:           wrap(classifyArrays.TIER, "VENCAT"),
        },
        WHOLDTAX,
        UPLOAD: [],
        idtype: "SOLMN1",
        idnum: refNo,
        idtype2: "ZMSMEN",
        idnum2: vendor?.msme_number ? String(vendor.msme_number).slice(0, 20) : "",
        IDCATG: vendor?.msme_major_activity ? String(vendor.msme_major_activity) : "",
      };
    });

    // Final WHOLDTAX boundary: overwrite stale/blank client/template rows on
    // every outgoing row immediately before the SAP request is prepared.
    const finalWholdtaxRows = enriched.map((row: any, i: number) => {
      const vendor = (vendors || []).find((v: any) => v.id === vendorIds[i]);
      const vendorCountry = String((vendor as any)?.country || "IN").toUpperCase();
      return applyFinalWholdtax(row, overrides, vendorCountry);
    });
    console.log(JSON.stringify({
      svc: SVC,
      stage: "wholdtax.final",
      version: WHOLDTAX_FINAL_NORMALIZE_VERSION,
      selectedRows: Array.isArray((overrides as any)?.withholding) ? (overrides as any).withholding.length : 0,
      rowsPerVendor: finalWholdtaxRows.map((rows: any[]) => rows.length),
      rows: summarizeWholdtax(finalWholdtaxRows[0] || []),
    }));

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
    const rawMiddlewareUrl = config?.middleware_url || envMiddlewareUrl || "";
    const middlewareUrl = normalizeMiddlewareBase(rawMiddlewareUrl);
    const middlewareKey = (config?.proxy_secret || envMiddlewareKey || "").trim();
    const connectionMode = (config?.connection_mode || "proxy").toLowerCase();

    let targetUrl = "";
    let useMiddleware = false;
    if (connectionMode === "proxy") {
      if (!middlewareUrl) return fail("SAP middleware URL is not configured.");
      if (!middlewareKey) return fail("Proxy Secret / Password is not set.");
      useMiddleware = true;
      targetUrl = `${middlewareUrl}/sap/bp/create`;
    } else {
      const directBase = config?.base_url || "";
      const directPath = config?.endpoint_path || "";
      targetUrl = `${directBase.replace(/\/$/, "")}${directPath}`;
      if (!targetUrl) return fail("SAP direct URL is not configured.");
    }

    let accRes: any[] = [];
    let httpStatus = 0;
    let networkError: string | null = null;

    try {
      const controller = new AbortController();
      const timeoutMs = Math.max(10000, Math.min(config?.timeout_ms || 60000, 120000));
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
        method: "POST",
        headers,
        body: JSON.stringify(enriched),
        signal: controller.signal,
      });
      clearTimeout(timer);
      httpStatus = res.status;
      const text = await res.text();
      console.log("Bulk SAP raw status:", httpStatus, "body:", text.slice(0, 800));

      try {
        const parsed = JSON.parse(text);
        const inner = useMiddleware && parsed && typeof parsed === "object" && "sapResponse" in parsed
          ? parsed.sapResponse : parsed;
        // The SAP response shape can be { ACC_RES: [...] } OR a flat array of items.
        if (inner && typeof inner === "object" && Array.isArray((inner as any).ACC_RES)) {
          accRes = (inner as any).ACC_RES;
        } else if (Array.isArray(inner)) {
          accRes = inner;
        } else if (inner) {
          accRes = [inner];
        }
      } catch {
        networkError = `Invalid JSON from SAP (HTTP ${httpStatus}): ${text.slice(0, 200)}`;
      }
    } catch (e: any) {
      networkError = `Could not reach SAP: ${e?.message || "network error"}`;
    }

    if (networkError) return fail(networkError);

    // Match ACC_RES rows back to vendors. Use idnum if present; otherwise positional fallback.
    const results: Array<{ vendorId: string; refNo: string; sapVendorCode: string | null; success: boolean; message: string; raw: any }> = [];

    for (let i = 0; i < vendorIds.length; i++) {
      const vid = vendorIds[i];
      const vendor = (vendors || []).find((v: any) => v.id === vid);
      const refNo = String(vendor?.reference_number || vid || "").toUpperCase();
      // Try match by idnum first
      let match = accRes.find((r: any) => String(r?.idnum || "").toUpperCase() === refNo);
      // Fallback: positional
      if (!match && accRes[i]) match = accRes[i];

      const sapVendorCode = match?.VENDOR || match?.BP_LIFNR || null;
      const success = match?.MSGTYP === "S" && !!sapVendorCode;
      if (match) {
        // Strictly prefer VENDOR and also stamp BP_LIFNR with the VENDOR value for downstream UI consumers.
        match.BP_LIFNR_ORIG = match.BP_LIFNR_ORIG ?? match.BP_LIFNR ?? "";
        match.VENDOR = sapVendorCode || "";
        match.BP_LIFNR = sapVendorCode || "";
      }
      const message = match?.LONGMSG || match?.MSG || (success ? "Vendor created" : "No response from SAP for this vendor");

      results.push({ vendorId: vid, refNo, sapVendorCode, success, message, raw: match || null });

      if (success && sapVendorCode) {
        await supabase.from("vendors").update({
          sap_vendor_code: sapVendorCode,
          sap_reference_no: refNo,
          sap_synced_at: new Date().toISOString(),
          status: "dms_sync_pending",
        }).eq("id", vid);

        await supabase.from("audit_logs").insert({
          vendor_id: vid,
          user_id: auth.user.id,
          action: "sap_sync_bulk",
          details: { sap_vendor_code: sapVendorCode, ref_no: refNo, message },
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const normalizedAccRes = (accRes || []).map((r: any) => {
      const vendorVal = r?.VENDOR || r?.BP_LIFNR || "";
      return { ...r, VENDOR: vendorVal, BP_LIFNR_ORIG: r?.BP_LIFNR_ORIG ?? r?.BP_LIFNR ?? "", BP_LIFNR: vendorVal };
    });
    return ok({
      success: successCount > 0,
      message: `${successCount}/${vendorIds.length} vendor(s) created in SAP`,
      ACC_RES: normalizedAccRes,
      results,
    });
  } catch (error: any) {
    console.error("sync-vendors-to-sap-bulk error:", error);
    return ok({ success: false, message: error.message || "Unexpected error", ACC_RES: [] });
  }
});
