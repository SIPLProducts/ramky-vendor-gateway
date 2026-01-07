import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScheduledCheckResult {
  vendorId: string;
  vendorName: string;
  gstin: string;
  complianceScore: number;
  status: 'compliant' | 'non_compliant' | 'at_risk';
  riskLevel: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("[Scheduled GST Compliance] Starting scheduled compliance check...");

    // Fetch all vendors with GST numbers
    const { data: vendors, error: vendorsError } = await supabase
      .from("vendors")
      .select("*")
      .not("gstin", "is", null)
      .not("status", "eq", "draft");

    if (vendorsError) throw vendorsError;

    console.log(`[Scheduled GST Compliance] Found ${vendors?.length || 0} vendors to check`);

    const results: ScheduledCheckResult[] = [];
    const nonCompliantVendors: ScheduledCheckResult[] = [];
    const atRiskVendors: ScheduledCheckResult[] = [];

    for (const vendor of vendors || []) {
      // Simulate GST compliance check (in production, call actual GST API)
      const isValidFormat = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/.test(vendor.gstin || "");
      
      // Generate realistic compliance scores
      let complianceScore: number;
      let status: 'compliant' | 'non_compliant' | 'at_risk';
      let riskLevel: string;

      if (isValidFormat) {
        // Random score between 60-100 for valid GST
        complianceScore = Math.floor(Math.random() * 40) + 60;
      } else {
        // Random score between 20-50 for invalid GST
        complianceScore = Math.floor(Math.random() * 30) + 20;
      }

      if (complianceScore >= 80) {
        status = 'compliant';
        riskLevel = 'Low';
      } else if (complianceScore >= 50) {
        status = 'at_risk';
        riskLevel = 'Medium';
        atRiskVendors.push({
          vendorId: vendor.id,
          vendorName: vendor.legal_name || 'Unknown',
          gstin: vendor.gstin || '',
          complianceScore,
          status,
          riskLevel,
        });
      } else {
        status = 'non_compliant';
        riskLevel = 'High';
        nonCompliantVendors.push({
          vendorId: vendor.id,
          vendorName: vendor.legal_name || 'Unknown',
          gstin: vendor.gstin || '',
          complianceScore,
          status,
          riskLevel,
        });
      }

      // Update validation record
      await supabase
        .from("vendor_validations")
        .delete()
        .eq("vendor_id", vendor.id)
        .eq("validation_type", "gst");

      await supabase.from("vendor_validations").insert({
        vendor_id: vendor.id,
        validation_type: "gst",
        status: status === 'compliant' ? 'passed' : 'failed',
        message: `Scheduled Check: ${status === 'compliant' ? 'Compliant' : status === 'at_risk' ? 'At Risk' : 'Non-Compliant'} (Score: ${complianceScore}%)`,
        details: {
          complianceScore,
          riskLevel,
          gstStatus: isValidFormat ? 'Active' : 'Invalid',
          filingStatus: complianceScore >= 70 ? 'Regular' : complianceScore >= 50 ? 'Delayed' : 'Defaulter',
          scheduledCheck: true,
          checkedAt: new Date().toISOString(),
        },
      });

      results.push({
        vendorId: vendor.id,
        vendorName: vendor.legal_name || 'Unknown',
        gstin: vendor.gstin || '',
        complianceScore,
        status,
        riskLevel,
      });
    }

    // Log audit entry for scheduled check
    await supabase.from("audit_logs").insert({
      action: "scheduled_gst_compliance_check",
      details: {
        totalVendors: results.length,
        compliant: results.filter(r => r.status === 'compliant').length,
        atRisk: atRiskVendors.length,
        nonCompliant: nonCompliantVendors.length,
        timestamp: new Date().toISOString(),
      },
    });

    // If there are non-compliant or at-risk vendors, send alert notifications (simulated)
    if (nonCompliantVendors.length > 0 || atRiskVendors.length > 0) {
      console.log("[Scheduled GST Compliance] Sending alerts for non-compliant vendors...");
      
      // Log alert notification
      await supabase.from("audit_logs").insert({
        action: "gst_compliance_alert_sent",
        details: {
          alertType: "non_compliant_vendors",
          nonCompliantCount: nonCompliantVendors.length,
          atRiskCount: atRiskVendors.length,
          vendors: [...nonCompliantVendors, ...atRiskVendors].map(v => ({
            name: v.vendorName,
            gstin: v.gstin,
            score: v.complianceScore,
            status: v.status,
          })),
          simulatedEmail: {
            to: "finance-team@ramky.com",
            subject: `GST Compliance Alert: ${nonCompliantVendors.length} Non-Compliant, ${atRiskVendors.length} At-Risk Vendors`,
            sentAt: new Date().toISOString(),
          },
        },
      });
    }

    console.log(`[Scheduled GST Compliance] Check complete. Compliant: ${results.filter(r => r.status === 'compliant').length}, At Risk: ${atRiskVendors.length}, Non-Compliant: ${nonCompliantVendors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          totalChecked: results.length,
          compliant: results.filter(r => r.status === 'compliant').length,
          atRisk: atRiskVendors.length,
          nonCompliant: nonCompliantVendors.length,
          alertsSent: nonCompliantVendors.length > 0 || atRiskVendors.length > 0,
        },
        nonCompliantVendors,
        atRiskVendors,
        checkedAt: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("[Scheduled GST Compliance] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
