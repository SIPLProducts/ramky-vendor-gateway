import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VendorData {
  id: string;
  legal_name: string | null;
  trade_name: string | null;
  registered_address: string | null;
  registered_address_line2: string | null;
  registered_address_line3: string | null;
  registered_city: string | null;
  registered_state: string | null;
  registered_pincode: string | null;
  registered_phone: string | null;
  registered_fax: string | null;
  registered_website: string | null;
  primary_contact_name: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  gstin: string | null;
  pan: string | null;
  bank_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  bank_branch_name: string | null;
  industry_type: string | null;
}

interface SAPPayload {
  BPARTNER: string;
  PARTN_CAT: string;
  PARTN_GRP: string;
  TITLE: string;
  NAME1: string;
  NAME2: string;
  STERM1: string;
  STERM2: string;
  STREET: string;
  HOUSE_NO: string;
  STR_SUPPL1: string;
  LOCATION: string;
  DISTRICT: string;
  POSTL_COD1: string;
  CITY: string;
  COUNTRY: string;
  REGION: string;
  LANGU: string;
  TEL_NUMBER: string;
  MOB_NUMBER: string;
  SMTP_ADDR: string;
  TAXNUMXL: string;
  BUKRS: string;
  WITHT: string;
  TAXKD07: string;
}

interface SAPResponse {
  BP_LIFNR: string;
  MSGTYP: string;
  MSGNR: string;
  ERDAT: string;
  UZEIT: string;
  UNAME: string;
  MSG: string;
  BP_LIFNRX: string;
  BPNAME: string;
  PERNR: number;
  EXCEL_ROW: number;
}

// Map Indian state codes to SAP region codes
const stateToRegionMap: Record<string, string> = {
  "Andhra Pradesh": "AP",
  "Arunachal Pradesh": "AR",
  "Assam": "AS",
  "Bihar": "BR",
  "Chhattisgarh": "CG",
  "Goa": "GA",
  "Gujarat": "GJ",
  "Haryana": "HR",
  "Himachal Pradesh": "HP",
  "Jharkhand": "JH",
  "Karnataka": "KA",
  "Kerala": "KL",
  "Madhya Pradesh": "MP",
  "Maharashtra": "MH",
  "Manipur": "MN",
  "Meghalaya": "ML",
  "Mizoram": "MZ",
  "Nagaland": "NL",
  "Odisha": "OR",
  "Punjab": "PB",
  "Rajasthan": "RJ",
  "Sikkim": "SK",
  "Tamil Nadu": "TN",
  "Telangana": "TG",
  "Tripura": "TR",
  "Uttar Pradesh": "UP",
  "Uttarakhand": "UK",
  "West Bengal": "WB",
  "Delhi": "DL",
};

function mapVendorToSAP(vendor: VendorData): SAPPayload {
  // Extract search terms from legal name (first 2 words or parts)
  const nameParts = (vendor.legal_name || "").split(" ");
  const sterm1 = nameParts[0] || "";
  const sterm2 = nameParts[1] || "";

  // Get region code from state
  const regionCode = vendor.registered_state 
    ? stateToRegionMap[vendor.registered_state] || "AP" 
    : "AP";

  return {
    BPARTNER: "", // Empty - SAP will generate
    PARTN_CAT: "1", // Category 1 for vendors
    PARTN_GRP: "S001", // Standard vendor group
    TITLE: "0002", // Standard title
    NAME1: (vendor.legal_name || "").substring(0, 40), // Max 40 chars
    NAME2: (vendor.trade_name || "").substring(0, 40), // Max 40 chars
    STERM1: sterm1.substring(0, 20), // Search term 1
    STERM2: sterm2.substring(0, 20), // Search term 2
    STREET: (vendor.registered_address || "").substring(0, 60),
    HOUSE_NO: (vendor.registered_address_line2 || "").substring(0, 10),
    STR_SUPPL1: (vendor.registered_address_line3 || vendor.registered_city || "").substring(0, 40),
    LOCATION: (vendor.registered_city || "").substring(0, 40),
    DISTRICT: (vendor.registered_city || "").substring(0, 40),
    POSTL_COD1: (vendor.registered_pincode || "").substring(0, 10),
    CITY: (vendor.registered_city || "").substring(0, 40),
    COUNTRY: "IN", // India
    REGION: regionCode,
    LANGU: "E", // English
    TEL_NUMBER: (vendor.registered_phone || "").substring(0, 16),
    MOB_NUMBER: (vendor.primary_phone || "").substring(0, 16),
    SMTP_ADDR: (vendor.primary_email || "").substring(0, 241),
    TAXNUMXL: (vendor.gstin || "").substring(0, 20), // GST Number
    BUKRS: "1710", // Company code
    WITHT: "1710", // Withholding tax type
    TAXKD07: "X", // Tax indicator
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { vendorId } = await req.json();

    if (!vendorId) {
      throw new Error("vendorId is required");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch vendor data
    const { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("*")
      .eq("id", vendorId)
      .single();

    if (vendorError || !vendor) {
      throw new Error(`Vendor not found: ${vendorError?.message}`);
    }

    // Map vendor data to SAP format
    const sapPayload = mapVendorToSAP(vendor as VendorData);

    // SAP API credentials from environment
    const sapUrl = Deno.env.get("SAP_API_URL") || "https://49.207.9.62:44325/vendor/bp/create?sap-client=100";
    const sapUsername = Deno.env.get("SAP_USERNAME") || "s23hana2";
    const sapPassword = Deno.env.get("SAP_PASSWORD") || "Sh@rv!3220";

    // Create Basic Auth header
    const authHeader = `Basic ${btoa(`${sapUsername}:${sapPassword}`)}`;

    // Call SAP API
    console.log("Calling SAP API with payload:", JSON.stringify([sapPayload], null, 2));

    const sapResponse = await fetch(sapUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify([sapPayload]),
    });

    const sapResponseText = await sapResponse.text();
    console.log("SAP Response:", sapResponseText);

    let sapData: SAPResponse[];
    try {
      sapData = JSON.parse(sapResponseText);
    } catch (e) {
      throw new Error(`Invalid SAP response: ${sapResponseText}`);
    }

    // Check if SAP sync was successful
    const isSuccess = sapData.some(
      (item) => item.MSGTYP === "S" && item.MSG.includes("Business Partner Created")
    );

    const sapVendorCode = sapData[0]?.BP_LIFNR || null;

    if (isSuccess && sapVendorCode) {
      // Update vendor with SAP details
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
          sapResponse: sapData,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    } else {
      // SAP sync failed
      return new Response(
        JSON.stringify({
          success: false,
          message: "SAP sync failed",
          sapResponse: sapData,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }
  } catch (error) {
    console.error("Error syncing to SAP:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
