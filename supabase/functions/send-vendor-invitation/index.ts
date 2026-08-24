import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.14";



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
    let companyName = "Ramky Vypaar Portal";
    let supportEmail = "vypaarsupport@ramky.com";
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
                    <div style="font-size:11px; color:#d4a574; margin-top:6px; letter-spacing:3px; text-transform:uppercase; font-weight:500;">Vypaar Portal</div>
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
                      Dear Business Partner,
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
                                Access Registration Portal Using Below Link
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
                                Verification &amp; Approval Status
                              </td>
                            </tr>
                            <tr>
                              <td style="padding:8px 0; font-size:14px; color:#2d3748; line-height:1.6;">
                                <span style="display:inline-block; width:26px; height:26px; line-height:26px; border-radius:50%; background-color:#1e3a5f; color:#ffffff; text-align:center; font-size:12px; font-weight:600; margin-right:14px; font-family:Georgia,serif;">IV</span>
                                Keep your GST, PAN, MSME (if applicable), and Bank documents ready for upload.
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
                      <a href="${inviteLink}" target="_blank" rel="noopener noreferrer" style="display:block; background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; padding:10px 14px; font-family:'SF Mono',Monaco,Consolas,'Courier New',monospace; font-size:11px; color:#1e3a5f; word-break:break-all; text-decoration:underline;">
                        ${inviteLink}
                      </a>
                    </div>

                    <div style="height:1px; background-color:#e2e8f0; margin:0 0 24px 0; line-height:1px; font-size:0;">&nbsp;</div>

                    <p style="margin:0; font-size:14px; line-height:1.7; color:#2d3748;">
                      <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:15px; font-weight:600; color:#1e3a5f; text-transform:capitalize;">Procurement Team</span><br>
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

    const adminClient = createClient(supabaseUrl, serviceKey);

    // 1) Try to find SMTP config for the logged-in sender.
    let smtpCfg: any = null;
    if (senderEmail) {
      const { data, error: smtpCfgErr } = await adminClient
        .from("smtp_email_configs")
        .select("smtp_host, smtp_port, encryption, smtp_username, app_password, user_email, from_name, is_active")
        .ilike("user_email", senderEmail)
        .eq("is_active", true)
        .maybeSingle();
      if (smtpCfgErr) console.error("smtp_email_configs lookup error", smtpCfgErr);
      smtpCfg = data;
    }

    // 2) Fallback: use any active SMTP config (most recently updated)
    //    so invitations work even when the logged-in admin has no per-user row.
    if (!smtpCfg || !smtpCfg.app_password) {
      const { data: fallback, error: fbErr } = await adminClient
        .from("smtp_email_configs")
        .select("smtp_host, smtp_port, encryption, smtp_username, app_password, user_email, from_name, is_active")
        .eq("is_active", true)
        .not("app_password", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (fbErr) console.error("smtp_email_configs fallback lookup error", fbErr);
      if (fallback?.app_password) {
        console.log(`[send-vendor-invitation] No SMTP for ${senderEmail}, using fallback ${fallback.user_email}`);
        smtpCfg = fallback;
      }
    }

    if (!smtpCfg || !smtpCfg.app_password) {
      return new Response(
        JSON.stringify({ success: false, error: `No active SMTP configuration found. Add one under Email Configuration.` }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }



    // Resolve sender display name — prefer the actual person's name over the SMTP mailbox display name
    let senderName = "";
    try {
      const { data: prof } = await adminClient
        .from("profiles")
        .select("full_name")
        .ilike("email", senderEmail)
        .maybeSingle();
      if (prof?.full_name) senderName = String(prof.full_name).trim();
    } catch (e) {
      console.error("profile lookup failed", e);
    }

    if (!senderName) {
      const local = senderEmail.split("@")[0] || "";
      senderName = local
        .split(/[._-]+/)
        .filter(Boolean)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ");
    }

    if (!senderName) {
      const fromName = (smtpCfg.from_name ?? "").toString().trim();
      const generic = /(portal|team|vendor|support|noreply|no-reply|admin|info)/i;
      if (
        fromName &&
        !generic.test(fromName) &&
        fromName.toLowerCase() !== companyName.toLowerCase()
      ) {
        senderName = fromName;
      }
    }

    if (!senderName) senderName = "Procurement Team";

    const finalHtml = emailHtml.replace("Procurement Team", senderName);

    // Send directly via SMTP (no internal HTTP hop — avoids self-hosted Kong 502s)
    const smtpHost = String(smtpCfg.smtp_host ?? "").trim();
    const smtpPort = Number(smtpCfg.smtp_port ?? 587);
    const smtpEncryption = String(smtpCfg.encryption ?? "tls").toLowerCase();
    let smtpUsername = String(smtpCfg.smtp_username ?? "").trim();
    const smtpPassword = String(smtpCfg.app_password ?? "").replace(/\s+/g, "");
    const smtpFromEmail = String(smtpCfg.user_email ?? smtpUsername).trim();
    if (!smtpUsername.includes("@") && smtpFromEmail.includes("@")) {
      smtpUsername = smtpFromEmail;
    }
    const cleanFromName = (smtpCfg.from_name ?? senderName ?? "").toString().replace(/[<>"]/g, "").trim();
    const fromHeader = cleanFromName ? `${cleanFromName} <${smtpFromEmail}>` : smtpFromEmail;
    const useImplicitTls = smtpEncryption === "ssl";

    console.log(
      `[send-vendor-invitation] SMTP connect host=${smtpHost} port=${smtpPort} encryption=${smtpEncryption} implicitTLS=${useImplicitTls}`,
    );

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: useImplicitTls,
      auth: { user: smtpUsername, pass: smtpPassword },
    });

    const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
      Promise.race([
        p,
        new Promise<T>((_, rej) =>
          setTimeout(
            () => rej(new Error(`${label} timed out after ${ms / 1000}s — check firewall egress on port ${smtpPort} from server to ${smtpHost}`)),
            ms,
          )
        ),
      ]);

    try {
      await withTimeout(
        transporter.sendMail({
          from: fromHeader,
          to: [email],
          subject: `Vendor Registration Invitation - ${companyName}`,
          text: finalHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
          html: finalHtml,
        }),
        25000,
        "SMTP send",
      );
    } finally {
      try { transporter.close(); } catch { /* ignore */ }
    }

    const emailResult = { messageId: `inv-${Date.now()}` };
    console.log("Email sent successfully:", emailResult.messageId);


    // Update the invitation with email tracking
    if (invitationId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          // Best-effort: ensure created_by (the inviting buyer) is set on
          // the invitation. Resolve the caller from the Authorization header
          // and only update when created_by is missing.
          let callerId: string | null = null;
          try {
            const authHeader = req.headers.get("Authorization") ?? "";
            const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
            if (authHeader && anonKey) {
              const userClient = createClient(supabaseUrl, anonKey, {
                global: { headers: { Authorization: authHeader } },
              });
              const { data: u } = await userClient.auth.getUser();
              callerId = u?.user?.id ?? null;
            }
          } catch (e) {
            console.warn("auth.getUser failed in send-vendor-invitation:", e);
          }

          // If no caller identified, try matching senderEmail to a profile
          if (!callerId && senderEmail) {
            const { data: prof } = await supabase
              .from("profiles")
              .select("id")
              .ilike("email", senderEmail)
              .maybeSingle();
            callerId = (prof as any)?.id ?? null;
          }

          const updatePayload: Record<string, unknown> = {
            email_sent_at: new Date().toISOString(),
          };
          if (callerId) {
            // Only set when missing — don't overwrite a real buyer
            const { data: existing } = await supabase
              .from("vendor_invitations")
              .select("created_by")
              .eq("id", invitationId)
              .maybeSingle();
            if (!(existing as any)?.created_by) {
              updatePayload.created_by = callerId;
            }
          }

          await supabase
            .from("vendor_invitations")
            .update(updatePayload)
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
      JSON.stringify({ success: false, error: error?.message || String(error) }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },

      }
    );
  }
};

serve(handler);
