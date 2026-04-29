import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Indian state -> SAP region code (REGION column, length 3)
const stateToRegion: Record<string, string> = {
  "Andhra Pradesh": "AP", "Arunachal Pradesh": "AR", "Assam": "AS", "Bihar": "BR",
  "Chhattisgarh": "CG", "Goa": "GA", "Gujarat": "GJ", "Haryana": "HR",
  "Himachal Pradesh": "HP", "Jharkhand": "JH", "Karnataka": "KA", "Kerala": "KL",
  "Madhya Pradesh": "MP", "Maharashtra": "13", "Manipur": "MN", "Meghalaya": "ML",
  "Mizoram": "MZ", "Nagaland": "NL", "Odisha": "OR", "Punjab": "PB",
  "Rajasthan": "RJ", "Sikkim": "SK", "Tamil Nadu": "TN", "Telangana": "TG",
  "Tripura": "TR", "Uttar Pradesh": "UP", "Uttarakhand": "UK", "West Bengal": "WB",
  "Delhi": "DL",
};

const trunc = (v: any, n: number) => (v == null ? "" : String(v)).slice(0, n);

function buildPayload(vendor: any) {
  const legalName = vendor.legal_name || "";
  const tradeName = vendor.trade_name || "";
  const region = vendor.registered_state ? (stateToRegion[vendor.registered_state] || "") : "";

  const row: Record<string, any> = {
    bpartner: "", partn_cat: "2", partn_grp: "ZDOM", title: "",
    name1: trunc(legalName, 40), name2: trunc(tradeName, 40), name3: "",
    sterm1: trunc(legalName, 20), sterm2: trunc((tradeName.split(" ")[0] || ""), 20),
    street: trunc(vendor.registered_address, 60),
    house_no: trunc(vendor.registered_address_line2, 10),
    str_suppl1: trunc(vendor.registered_address_line3 || vendor.registered_address_line2, 40),
    str_suppl2: "", str_suppl3: "",
    location: trunc(vendor.registered_city, 40),
    district: trunc(vendor.registered_city, 40),
    postl_cod1: trunc(vendor.registered_pincode, 10),
    city: trunc(vendor.registered_city, 40),
    country: "IN", region: trunc(region, 3), langu: "EN",
    tel_number: trunc(vendor.registered_phone, 30),
    mob_number: trunc(vendor.primary_phone, 30),
    smtp_addr: trunc(vendor.primary_email, 241),
    taxtype: "IN3", taxnumxl: trunc(vendor.gstin, 20),
    legaform: "", legaenty: "", bp_type: "", due_digi: "", idtype: "", idnum: "",
    bankdetailid: "0001", bank_ctry: "IN",
    bank_key: trunc(vendor.ifsc_code, 15), bank_acct: trunc(vendor.account_number, 18),
    ctrl_key: "",
    accountholder: trunc(legalName, 60),
    bankaccountname: trunc(vendor.bank_name, 60),
    pernr: "", bukrs: "1000", akont: "155000005", zuawa: "014",
    cdi: "X", fdgrv: "A1", xzver: "",
    msme: vendor.msme_number ? "MIC" : "",
    j_1iexcd: "", j_1iexrn: "", j_1iexrg: "", j_1iexdi: "", j_1iexco: "",
    j_1iexcicu: "", j_1icstno: "", j_1ilstno: "",
    j_1ipanno: trunc(vendor.pan, 10), j_1isern: "",
    witht: "", wt_withcd: "", wt_subjct: "", qsrec: "", qland: "",
    vkorg: "1000", waers: "INR", zterm: "",
    inco1: "", inco2: "", kalsk: "L1", webre: "X", lebre: "X", ven_class: "",
    zvkorg: "", vtweg: "", spart: "", bzirk: "", kdgrp: "", vkbur: "", vkgrp: "",
    zwaers: "", kurst: "", konda: "", kalks: "", pltyp: "", versg: "", lprio: "",
    kzazu: "", vsbed: "", untto: "", uebto: "", zinco1: "", zinco2: "", zzterm: "",
    kkber: "", ktgrd: "",
    taxkd01: "", taxkd02: "", taxkd03: "", taxkd04: "", taxkd05: "", taxkd06: "", taxkd07: "",
  };
  return row;
}

function ok(body: any) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
}

function fail(message: string, extra: Record<string, any> = {}) {
  return ok({ success: false, message, sapResponse: [], ...extra });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { vendorId } = await req.json();
    if (!vendorId) throw new Error("vendorId is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Load vendor
    const { data: vendor, error: vendorError } = await supabase
      .from("vendors").select("*").eq("id", vendorId).single();
    if (vendorError || !vendor) throw new Error(`Vendor not found: ${vendorError?.message}`);

    // 2) Resolve SAP API config from app DB (preferred) — Business Partner Create.
    //    Match by api_type='sync' or by name containing 'business partner' / 'bp'.
    const { data: configs } = await supabase
      .from("sap_api_configs")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    const config = (configs || []).find((c: any) => {
      const n = (c.name || "").toLowerCase();
      return n.includes("business partner") || n.includes("bp create") || n.includes("vendor/bp") ||
             (c.endpoint_path || "").toLowerCase().includes("/vendor/bp/create");
    }) || (configs || [])[0];

    // Fallback to legacy runtime secrets if no config exists at all.
    const envMiddlewareUrl = Deno.env.get("SAP_MIDDLEWARE_URL");
    const envMiddlewareKey = Deno.env.get("SAP_MIDDLEWARE_KEY");

    // Normalize the middleware URL: strip whitespace and any trailing endpoint paths
    // so that pasting "https://x.ngrok.dev  /sap/bp/create" still works.
    function normalizeMiddlewareBase(raw: string): string {
      if (!raw) return "";
      let v = String(raw).replace(/\s+/g, "").trim();
      // remove trailing slashes
      v = v.replace(/\/+$/, "");
      // strip known endpoint suffixes if user pasted full URL
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
      if (!middlewareUrl) {
        return fail(
          "SAP middleware URL is not configured. Open SAP API Settings → Business Partner config and set 'Node.js Middleware URL' (e.g. your ngrok https URL) and 'Proxy Secret / Password'.",
        );
      }
      if (!/^https?:\/\//i.test(middlewareUrl)) {
        return fail(
          `The saved Node.js Middleware URL is invalid: "${rawMiddlewareUrl}". It must start with http:// or https:// and contain no spaces. Open SAP API Settings → Business Partner config and re-enter just the base URL (e.g. https://abc123.ngrok-free.app).`,
        );
      }
      try {
        // sanity check
        new URL(middlewareUrl);
      } catch {
        return fail(
          `The saved Node.js Middleware URL could not be parsed: "${rawMiddlewareUrl}". Re-enter just the public base URL (e.g. https://abc123.ngrok-free.app) without any trailing path or spaces.`,
        );
      }
      useMiddleware = true;
      targetUrl = `${middlewareUrl}/sap/bp/create`;
    } else {
      // direct mode — only sensible if Edge Function can actually reach SAP
      const directBase = config?.base_url || "";
      const directPath = config?.endpoint_path || "";
      targetUrl = `${directBase.replace(/\/$/, "")}${directPath}`;
      if (!targetUrl) {
        return fail("SAP direct URL is not configured (base_url + endpoint_path).");
      }
    }

    const payload = [buildPayload(vendor)];
    console.log("SAP request via:", useMiddleware ? "middleware" : "direct", targetUrl);

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
        // direct mode auth from saved credentials
        const { data: creds } = await supabase
          .from("sap_api_credentials")
          .select("*")
          .eq("config_id", config?.id)
          .maybeSingle();
        if (config?.auth_type === "Basic" && creds?.username) {
          headers["Authorization"] = `Basic ${btoa(`${creds.username}:${creds.password_encrypted ?? ""}`)}`;
        } else if (config?.auth_type === "Bearer" && creds?.password_encrypted) {
          headers["Authorization"] = `Bearer ${creds.password_encrypted}`;
        }
      }

      const res = await fetch(targetUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);
      httpStatus = res.status;
      const text = await res.text();
      console.log("SAP raw response status:", httpStatus, "body:", text.slice(0, 500));

      try {
        const parsed = JSON.parse(text);
        upstreamWrapper = useMiddleware ? parsed : null;
        const raw = useMiddleware && parsed && typeof parsed === "object" && "sapResponse" in parsed
          ? parsed.sapResponse
          : parsed;
        sapResponse = Array.isArray(raw) ? raw : (raw == null ? [] : [raw]);
      } catch {
        // Non-JSON body
        if (httpStatus >= 400) {
          networkError = `Middleware/SAP HTTP ${httpStatus}: ${text.slice(0, 200) || "(empty body)"}`;
        } else {
          networkError = `Invalid JSON from SAP (HTTP ${httpStatus}): ${text.slice(0, 200)}`;
        }
      }

      // Friendly mapping for middleware error wrappers
      if (useMiddleware && upstreamWrapper && upstreamWrapper.ok === false) {
        const upstreamErr = String(upstreamWrapper.error || "").toLowerCase();
        if (httpStatus === 401 || upstreamErr.includes("unauthorized")) {
          networkError =
            "Middleware rejected the request (401 Unauthorized). The 'Proxy Secret / Password' in SAP API Settings does not match MIDDLEWARE_SHARED_SECRET in middleware/.env.";
        } else if (upstreamErr.includes("missing sap_bp_api_url") || upstreamErr.includes("sap_bp_username") || upstreamErr.includes("sap_bp_password")) {
          networkError =
            "Middleware is reachable but its .env is incomplete. Set SAP_BP_API_URL / SAP_BP_USERNAME / SAP_BP_PASSWORD in middleware/.env and restart it.";
        } else if (upstreamErr.includes("timed out") || upstreamErr.includes("timeout")) {
          networkError =
            "Middleware is reachable, but SAP timed out. The middleware machine cannot reach SAP at 10.200.1.2 — check VPN / firewall.";
        } else {
          networkError = `Middleware error: ${upstreamWrapper.error || `HTTP ${httpStatus}`}`;
        }
      } else if (httpStatus === 401 && useMiddleware && !networkError) {
        networkError =
          "Middleware rejected the request (401). Set the 'Proxy Secret / Password' in SAP API Settings to the same value as MIDDLEWARE_SHARED_SECRET in middleware/.env.";
      }
    } catch (e: any) {
      const raw = e?.message || "Network error reaching SAP";
      if (useMiddleware) {
        networkError =
          `Could not reach the middleware at ${targetUrl}. Make sure 'node server.js' is running and the URL in SAP API Settings is publicly reachable (e.g. https ngrok URL). Underlying error: ${raw}`;
      } else {
        networkError =
          `Could not reach SAP directly at ${targetUrl}. Lovable Cloud cannot reach private IPs — switch the SAP API config to 'proxy' mode and set the Node.js Middleware URL. Underlying error: ${raw}`;
      }
      console.error("SAP fetch error:", raw);
    }

    if (networkError) {
      return fail(networkError, { sapResponse: sapResponse ?? [] });
    }

    const successItem = (sapResponse || []).find(
      (it: any) => it?.MSGTYP === "S" && typeof it?.MSG === "string" && it.MSG.toLowerCase().includes("business partner created"),
    );
    const sapVendorCode = successItem?.BP_LIFNR || (sapResponse || []).find((i: any) => i?.BP_LIFNR)?.BP_LIFNR || null;

    if (successItem && sapVendorCode) {
      await supabase
        .from("vendors")
        .update({
          sap_vendor_code: sapVendorCode,
          sap_synced_at: new Date().toISOString(),
          status: "sap_synced",
        })
        .eq("id", vendorId);

      return ok({
        success: true,
        sapVendorCode,
        message: "Vendor successfully synced to SAP",
        sapResponse,
      });
    }

    const errorItem = (sapResponse || []).find((it: any) => it?.MSGTYP === "E");
    return ok({
      success: false,
      message: errorItem?.MSG || "SAP did not confirm Business Partner creation",
      sapResponse: sapResponse || [],
    });
  } catch (error: any) {
    console.error("sync-vendor-to-sap error:", error);
    return ok({ success: false, message: error.message || "Unexpected error", sapResponse: [] });
  }
});
