import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuthenticatedUser, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuthenticatedUser(req, ['admin', 'sharvi_admin', 'customer_admin', 'finance', 'SAP Team']);
  if (!auth.ok) return authErrorResponse(auth, corsHeaders);

  try {
    const { vendorId } = await req.json();
    if (!vendorId) {
      return new Response(JSON.stringify({ error: "vendorId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: vendor } = await supabase
      .from("vendors").select("id, sap_vendor_code").eq("id", vendorId).single();

    if (!vendor) {
      return new Response(JSON.stringify({ error: "Vendor not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!vendor.sap_vendor_code) {
      return new Response(JSON.stringify({ error: "Vendor not yet synced to SAP (missing BP_LIFNR)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: docs } = await supabase
      .from("vendor_documents")
      .select("document_type, file_name, file_path, file_size")
      .eq("vendor_id", vendorId);

    const FILE_UPLOAD: any[] = [];
    const skipped: string[] = [];
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
        FILE_UPLOAD.push({ FILE: base64, FILE_PATH: d.file_path });
      } catch (e: any) {
        skipped.push(`${d.file_name} (${e?.message || "error"})`);
      }
    }

    // Exact SAP payload shape — visible in the browser response.
    const payload = {
      BP_LIFNR: vendor.sap_vendor_code,
      FILE_UPLOAD,
    };

    return new Response(JSON.stringify({ payload, skipped }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("prepare-dms-payload error:", error);
    return new Response(JSON.stringify({ error: error.message || "Unexpected error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
