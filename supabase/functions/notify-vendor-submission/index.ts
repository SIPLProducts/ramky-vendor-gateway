import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Body {
  vendorId: string;
  resubmission?: boolean;
}

const supportEmail = "support@sharviinfotech.com";
const companyName = "Sharvi Vendor Portal";

function buildHtml(opts: {
  inviterFirstName: string;
  vendorName: string;
  primaryContact: string;
  primaryEmail: string;
  primaryPhone: string;
  submittedAt: string;
  resubmission: boolean;
  vendorId: string;
  vendorRef: string;
  action: string;
}) {
  const { inviterFirstName, vendorName, primaryContact, primaryEmail, primaryPhone, submittedAt, resubmission, vendorId, vendorRef, action } = opts;
  const heading = resubmission ? "Vendor Application Resubmitted" : "Vendor Application Submitted";
  const intro = `We're pleased to inform you that vendor <strong>${vendorName}</strong> has ${action} their registration form successfully. The complete details are summarised below for your review.`;
  const currentYear = new Date().getFullYear();

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#F7F9FC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F7F9FC;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td style="background-color:#1e3a5f;padding:28px 40px;color:#ffffff;">
          <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#d4a574;font-weight:600;margin-bottom:6px;">Notification</div>
          <div style="font-size:20px;font-weight:600;">${heading}</div>
        </td></tr>
        <tr><td style="padding:36px 40px;color:#2d3748;">
          <p style="margin:0 0 18px;font-size:15px;line-height:1.6;">Dear ${inviterFirstName},</p>
          <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#4a5568;">${intro}</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:0 0 28px;">
            <tr><td style="padding:18px 22px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;color:#2d3748;">
                <tr><td style="padding:6px 0;color:#718096;width:160px;">Vendor Name</td><td style="padding:6px 0;font-weight:600;">${vendorName}</td></tr>
                <tr><td style="padding:6px 0;color:#718096;">Primary Contact</td><td style="padding:6px 0;">${primaryContact || "—"}</td></tr>
                <tr><td style="padding:6px 0;color:#718096;">Vendor Email</td><td style="padding:6px 0;"><a href="mailto:${primaryEmail}" style="color:#1e3a5f;text-decoration:none;">${primaryEmail || "—"}</a></td></tr>
                <tr><td style="padding:6px 0;color:#718096;">Vendor Phone</td><td style="padding:6px 0;">${primaryPhone || "—"}</td></tr>
                <tr><td style="padding:6px 0;color:#718096;">Vendor Reference</td><td style="padding:6px 0;font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-weight:600;letter-spacing:0.5px;">${vendorRef}</td></tr>
                <tr><td style="padding:6px 0;color:#718096;">Vendor Unique ID</td><td style="padding:6px 0;font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-size:12px;color:#4a5568;">${vendorId}</td></tr>
                <tr><td style="padding:6px 0;color:#718096;">Submitted At</td><td style="padding:6px 0;">${submittedAt}</td></tr>
              </table>
            </td></tr>
          </table>

          <p style="margin:0 0 24px;font-size:13px;line-height:1.7;color:#4a5568;">
            You can review the application in the Sharvi Vendor Portal. If you have any questions, please contact
            <a href="mailto:${supportEmail}" style="color:#1e3a5f;text-decoration:none;font-weight:600;">${supportEmail}</a>.
          </p>

          <div style="height:1px;background-color:#e2e8f0;margin:0 0 22px;line-height:1px;font-size:0;">&nbsp;</div>
          <p style="margin:0;font-size:14px;line-height:1.7;color:#2d3748;">
            Regards,<br>
            <span style="font-weight:600;color:#1e3a5f;">${companyName}</span>
          </p>
        </td></tr>
        <tr><td style="padding:20px 16px;text-align:center;font-size:11px;color:#a0aec0;letter-spacing:0.3px;">
          &copy; ${currentYear} ${companyName}. This is an automated notification.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    if (!body?.vendorId) {
      return new Response(JSON.stringify({ error: "vendorId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: vendor, error: vErr } = await supabase
      .from("vendors")
      .select("id, legal_name, trade_name, primary_contact_name, primary_email, submitted_at, invitation_id")
      .eq("id", body.vendorId)
      .maybeSingle();
    if (vErr) throw vErr;
    if (!vendor) {
      return new Response(JSON.stringify({ success: false, error: "Vendor not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve the invitation linked to this vendor. Prefer the explicit
    // invitation_id on the vendor row; fall back to looking up by vendor_id
    // (claim_invitation sets vendor_id on the invitation at submit time).
    let invite: { id: string; created_by: string | null } | null = null;

    if (vendor.invitation_id) {
      const { data } = await supabase
        .from("vendor_invitations")
        .select("id, created_by")
        .eq("id", vendor.invitation_id)
        .maybeSingle();
      invite = (data as any) ?? null;
    }

    if (!invite) {
      const { data } = await supabase
        .from("vendor_invitations")
        .select("id, created_by")
        .eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      invite = (data as any) ?? null;
    }

    if (!invite) {
      console.log("[notify-vendor-submission] No invitation linked to vendor, skipping");
      return new Response(JSON.stringify({ success: true, skipped: "no_invitation" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!invite.created_by) {
      console.log("[notify-vendor-submission] Invitation has no created_by (inviter), skipping");
      return new Response(JSON.stringify({ success: true, skipped: "no_inviter" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", invite.created_by)
      .maybeSingle();

    if (!profile?.email) {
      console.log("[notify-vendor-submission] Inviter profile has no email, skipping");
      return new Response(JSON.stringify({ success: true, skipped: "no_inviter_email" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fullName = (profile.full_name ?? "").trim();
    const inviterFirstName = fullName
      ? fullName.split(/\s+/)[0].replace(/^./, (c) => c.toUpperCase())
      : "there";

    const submittedAt = vendor.submitted_at
      ? new Date(vendor.submitted_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
      : new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

    const vendorName = (vendor.legal_name || vendor.trade_name || "Unnamed Vendor").trim();
    const resubmission = !!body.resubmission;
    const action = resubmission ? "resubmitted" : "submitted";
    const subject = `Vendor Submitted Registration Form – ${vendorName}`;

    const html = buildHtml({
      inviterFirstName,
      vendorName,
      primaryContact: vendor.primary_contact_name || "",
      primaryEmail: vendor.primary_email || "",
      submittedAt,
      resubmission,
      vendorId: vendor.id,
      action,
    });

    const { data: sendData, error: sendErr } = await supabase.functions.invoke("send-smtp-email", {
      body: {
        to: profile.email,
        subject,
        html,
        suppressReplyTo: true,
      },
    });
    if (sendErr) throw sendErr;
    if ((sendData as any)?.success === false) {
      throw new Error((sendData as any)?.error ?? "send-smtp-email failed");
    }

    try {
      await supabase.from("audit_logs").insert({
        vendor_id: vendor.id,
        action: "vendor_submission_notified",
        details: { to: profile.email, resubmission, subject },
      });
    } catch (e) {
      console.error("audit_logs insert failed", e);
    }

    return new Response(JSON.stringify({ success: true, sentTo: profile.email }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("notify-vendor-submission error:", err);
    return new Response(JSON.stringify({ success: false, error: err?.message ?? String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
