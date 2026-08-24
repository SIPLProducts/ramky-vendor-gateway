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

const supportEmail = "vypaarsupport@ramky.com";
const companyName = "Ramky Vypaar Portal";

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
            You can review the application in the Ramky Vypaar Portal. If you have any questions, please contact
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
      .select("id, legal_name, trade_name, primary_contact_name, primary_email, primary_phone, submitted_at, invitation_id, reference_number")
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
    let invite:
      | { id: string; created_by: string | null; tenant_id: string | null; email: string | null; phone_number: string | null; vendor_name: string | null }
      | null = null;

    if (vendor.invitation_id) {
      const { data } = await supabase
        .from("vendor_invitations")
        .select("id, created_by, tenant_id, email, phone_number, vendor_name")
        .eq("id", vendor.invitation_id)
        .maybeSingle();
      invite = (data as any) ?? null;
    }

    if (!invite) {
      const { data } = await supabase
        .from("vendor_invitations")
        .select("id, created_by, tenant_id, email, phone_number, vendor_name")
        .eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      invite = (data as any) ?? null;
    }

    const logFailure = async (reason: string, extra: Record<string, unknown> = {}) => {
      try {
        await supabase.from("audit_logs").insert({
          vendor_id: vendor.id,
          action: "buyer_notification_failed",
          details: { reason, invitation_id: invite?.id ?? null, ...extra },
        });
      } catch (e) {
        console.error("audit_logs insert failed", e);
      }
    };

    if (!invite) {
      console.log("[notify-vendor-submission] No invitation linked to vendor");
      await logFailure("no_invitation");
      return new Response(JSON.stringify({ success: true, skipped: "no_invitation" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve recipient email(s) dynamically:
    // 1) Prefer invitation.created_by (the buyer who sent the invite)
    // 2) Fallback: all customer_admin users in the invitation's tenant
    let recipientEmails: string[] = [];
    let recipientFullName = "";
    let resolutionMode: "inviter" | "tenant_admins" = "inviter";

    if (invite.created_by) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", invite.created_by)
        .maybeSingle();
      if (profile?.email) {
        recipientEmails = [profile.email];
        recipientFullName = (profile.full_name ?? "").trim();
      }
    }

    // Fallback A: if invite has no created_by, resolve the buyer by looking
    // at the audit log for the original invitation email send. The "from"
    // address there is the buyer's SMTP sender; match it back to a profile.
    if (recipientEmails.length === 0) {
      try {
        const { data: inviteEmail } = await supabase
          .from("vendor_invitations")
          .select("email")
          .eq("id", invite.id)
          .maybeSingle();
        const inviteToEmail = (inviteEmail as any)?.email as string | undefined;
        if (inviteToEmail) {
          const { data: logs } = await supabase
            .from("audit_logs")
            .select("details, created_at")
            .eq("action", "smtp_email_sent")
            .order("created_at", { ascending: false })
            .limit(50);
          const senderEmail = (() => {
            for (const row of (logs ?? []) as any[]) {
              const d = row.details ?? {};
              const to = String(d.to ?? "").toLowerCase();
              const subj = String(d.subject ?? "").toLowerCase();
              if (
                to.includes(inviteToEmail.toLowerCase()) &&
                subj.includes("vendor registration invitation")
              ) {
                const from = String(d.from ?? "");
                const m = from.match(/<([^>]+)>/);
                return (m ? m[1] : from).trim().toLowerCase();
              }
            }
            return "";
          })();
          if (senderEmail) {
            const { data: senderProfile } = await supabase
              .from("profiles")
              .select("id, email, full_name")
              .ilike("email", senderEmail)
              .maybeSingle();
            if ((senderProfile as any)?.email) {
              recipientEmails = [(senderProfile as any).email];
              recipientFullName = ((senderProfile as any).full_name ?? "").trim();
              // Best-effort backfill so future runs are fast and the dialog is correct
              try {
                await supabase
                  .from("vendor_invitations")
                  .update({ created_by: (senderProfile as any).id })
                  .eq("id", invite.id);
              } catch (e) {
                console.warn("Backfill invite created_by failed:", e);
              }
            }
          }
        }
      } catch (e) {
        console.warn("Fallback sender resolution failed:", e);
      }
    }

    if (recipientEmails.length === 0 && invite.tenant_id) {
      resolutionMode = "tenant_admins";
      const { data: tenantUsers } = await supabase
        .from("user_tenants")
        .select("user_id")
        .eq("tenant_id", invite.tenant_id);
      const userIds = (tenantUsers ?? []).map((u: any) => u.user_id);
      if (userIds.length > 0) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("user_id", userIds)
          .eq("role", "customer_admin");
        const adminIds = (roles ?? []).map((r: any) => r.user_id);
        if (adminIds.length > 0) {
          const { data: admins } = await supabase
            .from("profiles")
            .select("email, full_name")
            .in("id", adminIds);
          recipientEmails = (admins ?? [])
            .map((a: any) => a.email)
            .filter((e: string | null) => !!e);
          if (admins && admins.length > 0) {
            recipientFullName = (admins[0].full_name ?? "").trim();
          }
        }
      }
    }

    if (recipientEmails.length === 0) {
      console.log("[notify-vendor-submission] No recipient could be resolved");
      await logFailure("no_recipient", { had_created_by: !!invite.created_by, tenant_id: invite.tenant_id });
      return new Response(JSON.stringify({ success: true, skipped: "no_recipient" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profile = { email: recipientEmails[0], full_name: recipientFullName };

    const fullName = (profile.full_name ?? "").trim();
    const inviterFirstName = fullName
      ? fullName.split(/\s+/)[0].replace(/^./, (c) => c.toUpperCase())
      : "there";

    const submittedAt = vendor.submitted_at
      ? new Date(vendor.submitted_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })
      : new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

    const vendorName = (invite?.vendor_name || vendor.legal_name || vendor.trade_name || "Unnamed Vendor").trim();
    const vendorEmail = (invite?.email || vendor.primary_email || "").trim();
    const vendorPhone = (invite?.phone_number || (vendor as any).primary_phone || "").trim();
    const contactPerson = (vendor.primary_contact_name || "").trim();
    const resubmission = !!body.resubmission;
    const action = resubmission ? "resubmitted" : "submitted";
    const subject = `Vendor Submitted Registration Form – ${vendorName}`;

    const vendorRef = (vendor as any).reference_number
      || vendor.id.replace(/-/g, "").slice(0, 8).toUpperCase();

    const vendorIdentity = {
      vendorName,
      vendorEmail,
      vendorPhone,
      contactPerson,
      vendorRef,
    };

    const html = buildHtml({
      inviterFirstName,
      vendorName,
      primaryContact: contactPerson,
      primaryEmail: vendorEmail,
      primaryPhone: vendorPhone,
      submittedAt,
      resubmission,
      vendorId: vendor.id,
      vendorRef,
      action,
    });

    // Reply-To is taken from the No-Reply Email Configuration (portal_config.smtp_reply_to)
    // by send-smtp-email when suppressReplyTo is not set.
    const { data: sendData, error: sendErr } = await supabase.functions.invoke("send-smtp-email", {
      body: {
        to: recipientEmails.join(", "),
        subject,
        html,
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
        details: { to: recipientEmails, resubmission, subject, resolution: resolutionMode, vendorIdentity },
      });
    } catch (e) {
      console.error("audit_logs insert failed", e);
    }

    // Also send a confirmation email to the vendor's registered email.
    if (vendorEmail) {
      try {
        const vendorSubject = `Application Submitted Successfully – Ref ${vendorRef}`;
        const vendorHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#F7F9FC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F7F9FC;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td style="background-color:#1e3a5f;padding:28px 40px;color:#ffffff;">
          <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#d4a574;font-weight:600;margin-bottom:6px;">Confirmation</div>
          <div style="font-size:20px;font-weight:600;">Application Submitted Successfully</div>
        </td></tr>
        <tr><td style="padding:36px 40px;color:#2d3748;">
          <p style="margin:0 0 18px;font-size:15px;line-height:1.6;">Dear ${contactPerson || vendorName},</p>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#4a5568;">
            Thank you for ${resubmission ? "resubmitting" : "submitting"} your vendor registration application. We have received it successfully and it is now under review.
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:0 0 24px;">
            <tr><td style="padding:18px 22px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;color:#2d3748;">
                <tr><td style="padding:6px 0;color:#718096;width:180px;">Vendor Name</td><td style="padding:6px 0;font-weight:600;">${vendorName}</td></tr>
                <tr><td style="padding:6px 0;color:#718096;">Reference Number</td><td style="padding:6px 0;font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-weight:600;letter-spacing:0.5px;">${vendorRef}</td></tr>
                <tr><td style="padding:6px 0;color:#718096;">Submitted At</td><td style="padding:6px 0;">${submittedAt}</td></tr>
              </table>
            </td></tr>
          </table>
          <p style="margin:0 0 20px;font-size:13px;line-height:1.7;color:#4a5568;">
            Please retain the reference number above for future correspondence. Our team will review your application and you will receive further updates over email.
          </p>
          <p style="margin:0 0 20px;font-size:13px;line-height:1.7;color:#4a5568;">
            For any queries, please contact <a href="mailto:${supportEmail}" style="color:#1e3a5f;text-decoration:none;font-weight:600;">${supportEmail}</a>.
          </p>
          <p style="margin:0;font-size:14px;line-height:1.7;color:#2d3748;">Regards,<br><span style="font-weight:600;color:#1e3a5f;">${companyName}</span></p>
        </td></tr>
        <tr><td style="padding:20px 16px;text-align:center;font-size:11px;color:#a0aec0;letter-spacing:0.3px;">
          &copy; ${new Date().getFullYear()} ${companyName}. This is an automated notification.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

        const { error: vendMailErr } = await supabase.functions.invoke("send-smtp-email", {
          body: { to: vendorEmail, subject: vendorSubject, html: vendorHtml },
        });
        if (vendMailErr) {
          console.error("vendor confirmation email failed:", vendMailErr);
        } else {
          try {
            await supabase.from("audit_logs").insert({
              vendor_id: vendor.id,
              action: "vendor_submission_confirmation_sent",
              details: { to: vendorEmail, subject: vendorSubject, vendorRef },
            });
          } catch (_) { /* ignore */ }
        }
      } catch (e) {
        console.error("vendor confirmation email exception:", e);
      }
    }


    return new Response(
      JSON.stringify({
        success: true,
        sentTo: recipientEmails,
        resolution: resolutionMode,
        vendorIdentity,
        inviter: { name: recipientFullName || null, email: recipientEmails[0] || null },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("notify-vendor-submission error:", err);
    return new Response(JSON.stringify({ success: false, error: err?.message ?? String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
