import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuthenticatedUser, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuthenticatedUser(req, [
    "admin",
    "sharvi_admin",
    "SAP Team",
    "sap team",
  ]);
  if (!auth.ok) return authErrorResponse(auth, corsHeaders);

  try {
    const { vendorId, remarks } = await req.json();
    if (!vendorId || typeof vendorId !== "string") {
      return new Response(JSON.stringify({ error: "vendorId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const cleanRemarks = (remarks || "").toString().trim();
    if (!cleanRemarks) {
      return new Response(JSON.stringify({ error: "Reject remarks are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error: updateErr } = await supabase
      .from("vendors")
      .update({
        status: "sap_team_rejected",
        last_rejected_by: auth.userId,
        last_rejected_at: new Date().toISOString(),
        last_rejection_comments: cleanRemarks,
        last_rejection_stage: "SAP_TEAM",
      } as any)
      .eq("id", vendorId);

    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("audit_logs").insert({
      vendor_id: vendorId,
      user_id: auth.userId,
      action: "sap_team_reject",
      details: { remarks: cleanRemarks, stage: "SAP_TEAM" },
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
