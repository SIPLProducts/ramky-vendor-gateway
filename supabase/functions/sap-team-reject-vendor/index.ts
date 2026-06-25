// Marks a vendor as duplicate-rejected at the SAP Sync stage and notifies the
// inviting buyer via SMTP that the SAP Team has rejected the application
// because the vendor already exists in SAP (manual click or automatic
// PAN-duplicate detection). Email failure does not abort the rejection — it is
// logged and surfaced in the response so the UI can show a warning toast.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuthenticatedUser, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const row = (k: string, v: string) =>
  `<tr><td style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;width:38%">${esc(k)}</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${esc(v)}</td></tr>`;

function getName1(v: any): string {
  const hasGst = !!(v?.gstin && String(v.gstin).trim());
  if (hasGst && v?.trade_name) return v.trade_name;
  return v?.account_holder_name || v?.trade_name || v?.legal_name || 'Vendor';
}

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
    const body = await req.json();
    const vendorId: string | undefined = body.vendorId;
    const remarks: string = (body.remarks || "").toString().trim();
    const autoTriggered: boolean = !!body.autoTriggered;

    if (!vendorId || typeof vendorId !== "string") {
      return new Response(JSON.stringify({ error: "vendorId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!remarks) {
      return new Response(JSON.stringify({ error: "Reject remarks are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const nowIso = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from("vendors")
      .update({
        status: "sap_team_rejected",
        last_rejected_by: auth.userId,
        last_rejected_at: nowIso,
        last_rejection_comments: remarks,
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
      action: "sap_team_duplicate_reject",
      details: { remarks, stage: "SAP_TEAM", auto_triggered: autoTriggered },
    });

    // ---- Notify the inviting buyer via SMTP ----
    let emailSent = false;
    let emailError: string | null = null;
    let buyerEmailUsed: string | null = null;

    try {
      const { data: vendor } = await supabase
        .from("vendors")
        .select("id, legal_name, trade_name, gstin, account_holder_name, reference_number, sap_vendor_code")
        .eq("id", vendorId)
        .maybeSingle();

      const { data: invite } = await supabase
        .from("vendor_invitations")
        .select("created_by, email")
        .eq("vendor_id", vendorId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const invitingBuyerId: string | null = (invite as any)?.created_by ?? null;

      if (!invitingBuyerId && !(invite as any)?.email) {
        emailError = "No inviting buyer recorded for vendor.";
      } else {
        const [{ data: buyerProfile }, { data: rejecterProfile }] = await Promise.all([
          invitingBuyerId
            ? supabase.from("profiles").select("email, full_name").eq("id", invitingBuyerId).maybeSingle()
            : Promise.resolve({ data: null } as any),
          supabase.from("profiles").select("email, full_name").eq("id", auth.userId).maybeSingle(),
        ]);

        const buyerEmail = (buyerProfile as any)?.email ?? (invite as any)?.email ?? null;
        if (!buyerEmail) {
          emailError = "Buyer email not found in profile.";
        } else {
          buyerEmailUsed = buyerEmail;
          const vendorName = getName1(vendor);
          const vendorRef = (vendor as any)?.reference_number
            ?? (vendor as any)?.sap_vendor_code
            ?? String(vendorId).slice(0, 8);
          const rejecterName = (rejecterProfile as any)?.full_name ?? "SAP Team";
          const rejecterEmail = (rejecterProfile as any)?.email ?? "";
          const rejectedAtIst = new Date().toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit", hour12: false,
          }) + " IST";

          const headline = autoTriggered
            ? "Vendor automatically rejected by SAP — Duplicate PAN"
            : "Vendor rejected by SAP Team — Duplicate in SAP";
          const intro = autoTriggered
            ? "The vendor application below was <b>automatically rejected</b> during SAP Sync because SAP reported the PAN number is already registered for an existing vendor."
            : "The vendor application below has been <b>rejected by the SAP Team</b> because the vendor already exists in SAP (duplicate).";

          const html = `
            <div style="font-family:Arial,sans-serif;color:#111;max-width:640px;margin:auto">
              <h2 style="color:#b91c1c;margin:0 0 12px">${esc(headline)}</h2>
              <p>Dear ${esc((buyerProfile as any)?.full_name ?? "Buyer")},</p>
              <p>${intro}</p>
              <table style="border-collapse:collapse;width:100%;margin:12px 0;font-size:14px">
                ${row("Vendor Name", vendorName)}
                ${row("Vendor Reference Number", vendorRef)}
                ${row("Rejected By", `${rejecterName}${rejecterEmail ? ` <${rejecterEmail}>` : ""}`)}
                ${row("Rejection Stage", "SAP Team")}
                ${row("Reason", "Duplicate — vendor already available in SAP")}
                ${row("Remarks", remarks)}
                ${row("Rejection Date & Time", rejectedAtIst)}
              </table>
              <p>This vendor has been moved to the <b>Duplicate Rejected Data</b> tab in the SAP Sync screen. No further action is required for this submission.</p>
              <p style="color:#6b7280;font-size:12px;margin-top:24px">This is an automated notification from the Sharvi Vendor Portal.</p>
            </div>`;

          const { data: emailResp, error: emailInvokeErr } = await supabase.functions.invoke("send-smtp-email", {
            body: { to: buyerEmail, subject: headline, html },
          });
          if (emailInvokeErr) {
            emailError = emailInvokeErr.message ?? "SMTP invoke failed";
          } else if (emailResp && (emailResp as any).success === false) {
            emailError = (emailResp as any).error ?? "SMTP send failed";
          } else {
            emailSent = true;
          }
        }
      }
    } catch (e: any) {
      emailError = e?.message ?? String(e);
    }

    try {
      await supabase.from("audit_logs").insert({
        vendor_id: vendorId,
        user_id: auth.userId,
        action: emailSent ? "buyer_notified_duplicate_rejection_email" : "buyer_duplicate_rejection_email_failed",
        details: { buyer_email: buyerEmailUsed, stage: "SAP_TEAM", email_error: emailError, auto_triggered: autoTriggered },
      });
    } catch (_) { /* ignore */ }

    return new Response(JSON.stringify({
      success: true,
      email_sent: emailSent,
      email_error: emailSent ? null : emailError,
    }), {
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
