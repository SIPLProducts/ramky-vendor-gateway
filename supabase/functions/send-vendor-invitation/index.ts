import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InvitationEmailRequest {
  email: string;
  token: string;
  expiresAt: string;
  invitationId?: string;
  simulationMode?: boolean;
  frontendUrl?: string;
  senderEmail?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: InvitationEmailRequest = await req.json();
    const { email, token, expiresAt, invitationId, simulationMode = false, senderEmail } = body;

    // Resolve frontend URL dynamically — no hardcoded fallback.
    // Priority: explicit body param > Origin header > Referer header > FRONTEND_URL env.
    const originHeader = req.headers.get("origin") || "";
    const refererHeader = req.headers.get("referer") || "";
    let refererOrigin = "";
    try { if (refererHeader) refererOrigin = new URL(refererHeader).origin; } catch { /* ignore */ }

    const frontendUrl =
      body.frontendUrl?.replace(/\/+$/, "") ||
      originHeader ||
      refererOrigin ||
      Deno.env.get("FRONTEND_URL") ||
      "";

    if (!frontendUrl) {
      return new Response(
        JSON.stringify({ error: "Unable to determine frontend URL. Pass `frontendUrl` in the request body or set FRONTEND_URL env var." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const inviteLink = `${frontendUrl}/vendor/invite?token=${token}`;

    console.log("Generated invite link:", inviteLink);
    console.log("Token:", token);
    console.log("Frontend URL:", frontendUrl);

    const expiryDate = new Date(expiresAt).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // Resolve tenant company name dynamically
    let companyName = "Sharvi Vendor Portal";
    let supportEmail = "support@sharviinfotech.com";
    try {
      const sbUrl = Deno.env.get("SUPABASE_URL");
      const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (sbUrl && sbKey && invitationId) {
        const sb = createClient(sbUrl, sbKey);
        const { data: inv } = await sb
          .from("vendor_invitations")
          .select("tenant_id")
          .eq("id", invitationId)
          .maybeSingle();
        if (inv?.tenant_id) {
          const { data: branding } = await sb
            .from("tenant_branding")
            .select("company_name, help_email")
            .eq("tenant_id", inv.tenant_id)
            .maybeSingle();
          if (branding?.company_name) companyName = branding.company_name;
          if (branding?.help_email) supportEmail = branding.help_email;
          if (!branding?.company_name) {
            const { data: tenant } = await sb
              .from("tenants")
              .select("name")
              .eq("id", inv.tenant_id)
              .maybeSingle();
            if (tenant?.name) companyName = tenant.name;
          }
        }
      }
    } catch (e) {
      console.error("Failed to resolve tenant company name:", e);
    }
    const brandShort = (companyName.split(/\s+/)[0] || "VENDOR").toUpperCase();

    const currentYear = new Date().getFullYear();

    const emailHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Vendor Registration Invitation</title>
      </head>
      <body style="margin:0; padding:0; background-color:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; color:#2d3748;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc; padding:40px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0" style="max-width:620px; width:100%;">

                <!-- Navy header -->
                <tr>
                  <td style="background-color:#1e3a5f; border-radius:12px 12px 0 0; padding:36px 44px; text-align:center;">
                    <div style="font-family:Georgia,'Times New Roman',serif; font-size:24px; font-weight:600; color:#ffffff; letter-spacing:2px;">${brandShort}</div>
                    <div style="font-size:11px; color:#d4a574; margin-top:6px; letter-spacing:3px; text-transform:uppercase; font-weight:500;">Vendor Portal</div>
                  </td>
                </tr>

                <!-- White card body -->
                <tr>
                  <td style="background-color:#ffffff; border:1px solid #e2e8f0; border-top:none; border-radius:0 0 12px 12px; padding:48px 44px;">

                    <h1 style="margin:0 0 8px 0; font-family:Georgia,'Times New Roman',serif; font-size:26px; line-height:1.3; color:#1e3a5f; font-weight:600; letter-spacing:0.3px;">
                      Vendor Registration Invitation
                    </h1>
                    <div style="height:2px; width:48px; background-color:#d4a574; margin:0 0 28px 0; line-height:2px; font-size:0;">&nbsp;</div>

                    <p style="margin:0 0 18px 0; font-size:15px; line-height:1.7; color:#2d3748;">
                      Dear Valued Business Partner,
                    </p>

                    <p style="margin:0 0 18px 0; font-size:15px; line-height:1.7; color:#2d3748;">
                      <strong style="color:#1e3a5f;">${companyName}</strong> cordially invites you to register as an approved supplier in our Vendor Management Portal.
                    </p>

                    <p style="margin:0 0 32px 0; font-size:15px; line-height:1.7; color:#4a5568;">
                      This secure registration process enables streamlined collaboration and ensures compliance with our procurement standards.
                    </p>

                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; margin:0 0 32px 0;">
                      <tr>
                        <td style="padding:24px 28px;">
                          <div style="font-size:11px; font-weight:600; color:#1e3a5f; text-transform:uppercase; letter-spacing:2px; margin-bottom:18px;">Registration Process</div>
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="padding:8px 0; font-size:14px; color:#2d3748; line-height:1.6;">
                                <span style="display:inline-block; width:26px; height:26px; line-height:26px; border-radius:50%; background-color:#1e3a5f; color:#ffffff; text-align:center; font-size:12px; font-weight:600; margin-right:14px; font-family:Georgia,serif;">I</span>
                                Access Registration Portal
                              </td>
                            </tr>
                            <tr>
                              <td style="padding:8px 0; font-size:14px; color:#2d3748; line-height:1.6;">
                                <span style="display:inline-block; width:26px; height:26px; line-height:26px; border-radius:50%; background-color:#1e3a5f; color:#ffffff; text-align:center; font-size:12px; font-weight:600; margin-right:14px; font-family:Georgia,serif;">II</span>
                                Complete Supplier Profile
                              </td>
                            </tr>
                            <tr>
                              <td style="padding:8px 0; font-size:14px; color:#2d3748; line-height:1.6;">
                                <span style="display:inline-block; width:26px; height:26px; line-height:26px; border-radius:50%; background-color:#1e3a5f; color:#ffffff; text-align:center; font-size:12px; font-weight:600; margin-right:14px; font-family:Georgia,serif;">III</span>
                                Verification &amp; Approval
                              </td>
                            </tr>
                          </table>
                          <div style="border-top:1px solid #e2e8f0; margin-top:18px; padding-top:14px; font-size:12px; color:#718096; letter-spacing:0.3px;">
                            Estimated Time: <strong style="color:#2d3748;">10&ndash;15 minutes</strong>
                          </div>
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 32px 0;">
                      <tr>
                        <td align="center">
                          <a href="${inviteLink}" target="_blank" rel="noopener noreferrer" style="display:inline-block; background-color:#d4a574; color:#1e3a5f; text-decoration:none; padding:15px 44px; border-radius:4px; font-size:13px; font-weight:700; letter-spacing:2px; text-transform:uppercase;">
                            Begin Registration
                          </a>
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;">
                      <tr>
                        <td style="border-left:3px solid #d4a574; background-color:#fdfaf5; padding:14px 18px; font-size:13px; color:#2d3748;">
                          <span style="font-weight:600; color:#1e3a5f; letter-spacing:0.5px;">Invitation Expires:</span>
                          <span style="color:#4a5568;"> ${expiryDate}</span>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:0 0 28px 0; font-size:13px; line-height:1.7; color:#4a5568;">
                      Should you encounter any difficulties, please contact our support team at
                      <a href="mailto:${supportEmail}" style="color:#1e3a5f; text-decoration:none; font-weight:600;">${supportEmail}</a>.
                    </p>

                    <div style="margin:0 0 32px 0;">
                      <p style="margin:0 0 8px 0; font-size:11px; color:#718096; letter-spacing:0.3px; text-transform:uppercase; font-weight:600;">Direct Link</p>
                      <div style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; padding:10px 14px; font-family:'SF Mono',Monaco,Consolas,'Courier New',monospace; font-size:11px; color:#4a5568; word-break:break-all;">
                        ${inviteLink}
                      </div>
                    </div>

                    <div style="height:1px; background-color:#e2e8f0; margin:0 0 24px 0; line-height:1px; font-size:0;">&nbsp;</div>

                    <p style="margin:0; font-size:14px; line-height:1.7; color:#2d3748;">
                      Respectfully,<br>
                      <span style="font-family:Georgia,'Times New Roman',serif; font-style:italic; color:#1e3a5f;">Procurement Team</span><br>
                      <span style="color:#718096; font-size:13px;">${companyName}</span>
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:24px 16px; text-align:center; font-size:11px; color:#a0aec0; letter-spacing:0.3px;">
                    &copy; ${currentYear} ${companyName}. All rights reserved.<br>
                    <span style="color:#cbd5e0;">This is an automated message. Please do not reply directly to this email.</span>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // Simulation mode - log instead of sending
    if (simulationMode) {
      console.log("[Invitation Email - SIMULATION MODE]");
      console.log("To:", email);
      console.log("Subject: Vendor Registration Invitation - Sharvi");
      console.log("Invite Link:", inviteLink);
      console.log("Expires:", expiryDate);

      // Log to audit_logs if supabase is available
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          await supabase.from("audit_logs").insert({
            action: "invitation_email_simulated",
            details: {
              to: email,
              subject: "Vendor Registration Invitation",
              invite_link: inviteLink,
              expires_at: expiresAt,
              simulation_mode: true,
            },
          });
        }
      } catch (logError) {
        console.error("Failed to log to audit_logs:", logError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          simulated: true,
          message: `Invitation email simulated for ${email}`,
          inviteLink,
          expiresAt: expiryDate,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Real email sending - look up logged-in user's SMTP config
    console.log("Sending invitation email to:", email, "from:", senderEmail);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!senderEmail) {
      return new Response(
        JSON.stringify({ error: "You are not configured in Email Configuration" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: smtpCfg, error: smtpCfgErr } = await adminClient
      .from("smtp_email_configs")
      .select("smtp_host, smtp_port, encryption, smtp_username, app_password, user_email, from_name, reply_to, is_active")
      .ilike("user_email", senderEmail)
      .eq("is_active", true)
      .maybeSingle();

    if (smtpCfgErr) {
      console.error("smtp_email_configs lookup error", smtpCfgErr);
    }

    if (!smtpCfg || !smtpCfg.app_password) {
      return new Response(
        JSON.stringify({ error: "You are not configured in Email Configuration" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const smtpResp = await fetch(`${supabaseUrl}/functions/v1/send-smtp-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        to: email,
        subject: `Vendor Registration Invitation - ${companyName}`,
        html: emailHtml,
        smtp: {
          host: smtpCfg.smtp_host,
          port: smtpCfg.smtp_port,
          encryption: smtpCfg.encryption,
          username: smtpCfg.smtp_username,
          password: smtpCfg.app_password,
          from_email: smtpCfg.user_email,
          from_name: smtpCfg.from_name ?? undefined,
          reply_to: smtpCfg.reply_to ?? undefined,
        },
      }),
    });

    const smtpData = await smtpResp.json();
    if (!smtpResp.ok || !smtpData.success) {
      throw new Error(smtpData.error || `SMTP send failed (${smtpResp.status})`);
    }

    const emailResult = { messageId: smtpData.messageId || `inv-${Date.now()}` };
    console.log("Email sent successfully:", emailResult.messageId);

    // Update the invitation with email tracking
    if (invitationId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          await supabase
            .from("vendor_invitations")
            .update({ 
              email_sent_at: new Date().toISOString()
            })
            .eq("id", invitationId);
          
          // Log to audit_logs
          await supabase.from("audit_logs").insert({
            action: "invitation_email_sent",
            details: {
              to: email,
              subject: "Vendor Registration Invitation",
              message_id: emailResult.messageId,
              invite_link: inviteLink,
              expires_at: expiresAt,
            },
          });
        }
      } catch (updateError) {
        console.error("Failed to update invitation:", updateError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: emailResult.messageId,
        message: `Invitation email sent successfully to ${email}` 
      }), 
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-vendor-invitation function:", error);
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
