import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuthenticatedUser, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function ok(body: any) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
}

function fail(message: string, extra: Record<string, any> = {}) {
  return ok({ success: false, message, ACC_RES: [], ...extra });
}

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuthenticatedUser(req, ['admin', 'sharvi_admin', 'customer_admin', 'finance', 'SAP Team']);
  if (!auth.ok) return authErrorResponse(auth, corsHeaders);

  try {
    const { vendorIds, sapPayload } = await req.json();
    if (!Array.isArray(vendorIds) || vendorIds.length === 0) {
      return fail("vendorIds (array) is required");
    }
    if (!Array.isArray(sapPayload) || sapPayload.length === 0) {
      return fail("sapPayload (array) is required");
    }

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
    const enriched = sapPayload.map((row: any, i: number) => {
      const vid = vendorIds[i];
      const vendor = (vendors || []).find((v: any) => v.id === vid);
      const refNo = String(vid || "").slice(0, 8).toUpperCase();
      idnumToVendor[refNo] = vendor;
      return {
        ...row,
        UPLOAD: [],
        idtype: "SOLMN1",
        idnum: refNo,
        idtype2: "ZMSMEN",
        idnum2: vendor?.msme_number ? String(vendor.msme_number).slice(0, 20) : "",
      };
    });

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
      const refNo = String(vid || "").slice(0, 8).toUpperCase();
      // Try match by idnum first
      let match = accRes.find((r: any) => String(r?.idnum || "").toUpperCase() === refNo);
      // Fallback: positional
      if (!match && accRes[i]) match = accRes[i];

      const success = match?.MSGTYP === "S" && !!match?.BP_LIFNR;
      const sapVendorCode = match?.BP_LIFNR || null;
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
    return ok({
      success: successCount > 0,
      message: `${successCount}/${vendorIds.length} vendor(s) created in SAP`,
      ACC_RES: accRes,
      results,
    });
  } catch (error: any) {
    console.error("sync-vendors-to-sap-bulk error:", error);
    return ok({ success: false, message: error.message || "Unexpected error", ACC_RES: [] });
  }
});
