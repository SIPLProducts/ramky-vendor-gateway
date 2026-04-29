import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Default to the values from RAMKY_VMS_API_Endpoints_For_BP_Creation.pdf.
// Override at runtime by setting the SAP_BP_API_URL / SAP_BP_USERNAME / SAP_BP_PASSWORD secrets.
const DEFAULT_SAP_URL = "http://10.200.1.2:8000/vendor/bp/create?sap-client=300";
const DEFAULT_SAP_USER = "22000208";
const DEFAULT_SAP_PASS = "Nani@1432";

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
    bpartner: "",
    partn_cat: "2",
    partn_grp: "ZDOM",
    title: "",
    name1: trunc(legalName, 40),
    name2: trunc(tradeName, 40),
    name3: "",
    sterm1: trunc(legalName, 20),
    sterm2: trunc((tradeName.split(" ")[0] || ""), 20),
    street: trunc(vendor.registered_address, 60),
    house_no: trunc(vendor.registered_address_line2, 10),
    str_suppl1: trunc(vendor.registered_address_line3 || vendor.registered_address_line2, 40),
    str_suppl2: "",
    str_suppl3: "",
    location: trunc(vendor.registered_city, 40),
    district: trunc(vendor.registered_city, 40),
    postl_cod1: trunc(vendor.registered_pincode, 10),
    city: trunc(vendor.registered_city, 40),
    country: "IN",
    region: trunc(region, 3),
    langu: "EN",
    tel_number: trunc(vendor.registered_phone, 30),
    mob_number: trunc(vendor.primary_phone, 30),
    smtp_addr: trunc(vendor.primary_email, 241),

    taxtype: "IN3",
    taxnumxl: trunc(vendor.gstin, 20),
    legaform: "",
    legaenty: "",
    bp_type: "",
    due_digi: "",
    idtype: "",
    idnum: "",

    bankdetailid: "0001",
    bank_ctry: "IN",
    bank_key: trunc(vendor.ifsc_code, 15),
    bank_acct: trunc(vendor.account_number, 18),
    ctrl_key: "",
    accountholder: trunc(legalName, 60),
    bankaccountname: trunc(vendor.bank_name, 60),
    pernr: "",

    bukrs: "1000",
    akont: "155000005",
    zuawa: "014",
    cdi: "X",
    fdgrv: "A1",
    xzver: "",
    msme: vendor.msme_number ? "MIC" : "",

    j_1iexcd: "",
    j_1iexrn: "",
    j_1iexrg: "",
    j_1iexdi: "",
    j_1iexco: "",
    j_1iexcicu: "",
    j_1icstno: "",
    j_1ilstno: "",
    j_1ipanno: trunc(vendor.pan, 10),
    j_1isern: "",

    witht: "",
    wt_withcd: "",
    wt_subjct: "",
    qsrec: "",
    qland: "",

    vkorg: "1000",
    waers: "INR",
    zterm: "",
    inco1: "",
    inco2: "",
    kalsk: "L1",
    webre: "X",
    lebre: "X",
    ven_class: "",

    zvkorg: "",
    vtweg: "",
    spart: "",
    bzirk: "",
    kdgrp: "",
    vkbur: "",
    vkgrp: "",
    zwaers: "",
    kurst: "",
    konda: "",
    kalks: "",
    pltyp: "",
    versg: "",
    lprio: "",
    kzazu: "",
    vsbed: "",
    untto: "",
    uebto: "",
    zinco1: "",
    zinco2: "",
    zzterm: "",
    kkber: "",
    ktgrd: "",
    taxkd01: "",
    taxkd02: "",
    taxkd03: "",
    taxkd04: "",
    taxkd05: "",
    taxkd06: "",
    taxkd07: "",
  };
  return row;
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

    const { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("*")
      .eq("id", vendorId)
      .single();
    if (vendorError || !vendor) throw new Error(`Vendor not found: ${vendorError?.message}`);

    const sapUrl = Deno.env.get("SAP_BP_API_URL") || DEFAULT_SAP_URL;
    const sapUser = Deno.env.get("SAP_BP_USERNAME") || DEFAULT_SAP_USER;
    const sapPass = Deno.env.get("SAP_BP_PASSWORD") || DEFAULT_SAP_PASS;

    const payload = [buildPayload(vendor)];
    console.log("SAP request URL:", sapUrl);
    console.log("SAP request payload:", JSON.stringify(payload));

    let sapResponse: any[] | null = null;
    let httpStatus = 0;
    let networkError: string | null = null;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(sapUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${btoa(`${sapUser}:${sapPass}`)}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);
      httpStatus = res.status;
      const text = await res.text();
      console.log("SAP raw response:", text);
      try {
        sapResponse = JSON.parse(text);
        if (!Array.isArray(sapResponse)) sapResponse = [sapResponse];
      } catch {
        networkError = `Invalid JSON from SAP (HTTP ${httpStatus}): ${text.slice(0, 300)}`;
      }
    } catch (e: any) {
      networkError = e?.message || "Network error reaching SAP";
      console.error("SAP fetch error:", networkError);
    }

    if (networkError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Could not reach SAP: ${networkError}`,
          sapResponse: sapResponse ?? [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
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

      return new Response(
        JSON.stringify({
          success: true,
          sapVendorCode,
          message: "Vendor successfully synced to SAP",
          sapResponse,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const errorItem = (sapResponse || []).find((it: any) => it?.MSGTYP === "E");
    return new Response(
      JSON.stringify({
        success: false,
        message: errorItem?.MSG || `SAP sync failed (HTTP ${httpStatus})`,
        sapResponse,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error("sync-vendor-to-sap error:", error);
    return new Response(
      JSON.stringify({ success: false, message: error.message || "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  }
});
