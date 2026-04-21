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
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, token, expiresAt, invitationId, simulationMode = false }: InvitationEmailRequest = await req.json();

    const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://ramkyvms.netlify.app";
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

    const emailHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Vendor Registration Invitation</title>
      </head>
      <body style="margin:0; padding:0; background-color:#F7F9FC; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; color:#1f2937;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F7F9FC; padding:32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; background-color:#ffffff; border-radius:10px; box-shadow:0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04); overflow:hidden;">
                
                <!-- Top accent bar -->
                <tr>
                  <td style="height:4px; background:linear-gradient(90deg,#2563eb 0%,#1d4ed8 100%); line-height:4px; font-size:0;">&nbsp;</td>
                </tr>
                
                <!-- Brand header -->
                <tr>
                  <td style="padding:28px 36px 8px 36px;">
                    <div style="font-size:18px; font-weight:700; color:#0b3a8c; letter-spacing:0.5px;">${brandShort}</div>
                    <div style="font-size:12px; color:#6b7280; margin-top:2px; letter-spacing:0.3px; text-transform:uppercase;">Vendor Portal</div>
                  </td>
                </tr>

                <!-- Title -->
                <tr>
                  <td style="padding:8px 36px 0 36px;">
                    <h1 style="margin:0; font-size:22px; line-height:1.3; color:#111827; font-weight:600;">You're Invited to Register</h1>
                  </td>
                </tr>

                <!-- Body copy -->
                <tr>
                  <td style="padding:16px 36px 0 36px; font-size:14px; line-height:1.6; color:#374151;">
                    <p style="margin:0 0 12px 0;">Hello,</p>
                    <p style="margin:0 0 16px 0;">You've been invited by <strong>${companyName}</strong> to register as a supplier. Please complete your registration to begin doing business with us.</p>
                  </td>
                </tr>

                <!-- What happens next -->
                <tr>
                  <td style="padding:8px 36px 0 36px;">
                    <div style="background-color:#F7F9FC; border:1px solid #e5e7eb; border-radius:8px; padding:18px 20px;">
                      <div style="font-size:13px; font-weight:600; color:#111827; text-transform:uppercase; letter-spacing:0.4px; margin-bottom:12px;">What happens next</div>
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="padding:6px 0; font-size:14px; color:#374151;">
                            <span style="display:inline-block; width:22px; height:22px; line-height:22px; border-radius:50%; background-color:#2563eb; color:#ffffff; text-align:center; font-size:12px; font-weight:600; margin-right:10px;">1</span>
                            Click the <strong>Start Registration</strong> button below
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0; font-size:14px; color:#374151;">
                            <span style="display:inline-block; width:22px; height:22px; line-height:22px; border-radius:50%; background-color:#2563eb; color:#ffffff; text-align:center; font-size:12px; font-weight:600; margin-right:10px;">2</span>
                            Complete the 7-step vendor registration form
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0; font-size:14px; color:#374151;">
                            <span style="display:inline-block; width:22px; height:22px; line-height:22px; border-radius:50%; background-color:#2563eb; color:#ffffff; text-align:center; font-size:12px; font-weight:600; margin-right:10px;">3</span>
                            Get verified &amp; approved by our team
                          </td>
                        </tr>
                      </table>
                    </div>
                  </td>
                </tr>

                <!-- Time estimate -->
                <tr>
                  <td style="padding:14px 36px 0 36px;">
                    <p style="margin:0; font-size:13px; color:#6b7280;">⏱ Takes about <strong style="color:#374151;">10–15 minutes</strong> to complete.</p>
                  </td>
                </tr>

                <!-- CTA -->
                <tr>
                  <td align="center" style="padding:24px 36px 8px 36px;">
                    <a href="${inviteLink}" target="_blank" rel="noopener noreferrer" style="display:inline-block; background-color:#2563eb; color:#ffffff; text-decoration:none; padding:14px 32px; border-radius:6px; font-size:15px; font-weight:600; letter-spacing:0.2px;">
                      Start Registration
                    </a>
                  </td>
                </tr>

                <!-- Expiry notice -->
                <tr>
                  <td style="padding:16px 36px 0 36px;">
                    <div style="background-color:#fef3c7; border:1px solid #fcd34d; border-radius:8px; padding:12px 16px;">
                      <p style="margin:0; font-size:13px; color:#92400e;">
                        ⚠ <strong>Important:</strong> This invitation expires on <strong>${expiryDate}</strong>.
                      </p>
                    </div>
                  </td>
                </tr>

                <!-- Fallback link -->
                <tr>
                  <td style="padding:20px 36px 0 36px;">
                    <p style="margin:0 0 8px 0; font-size:12px; color:#6b7280;">If the button doesn't work, copy and paste this link into your browser:</p>
                    <div style="background-color:#f3f4f6; border:1px solid #e5e7eb; border-radius:6px; padding:10px 12px; font-family:'SF Mono',Monaco,Consolas,'Courier New',monospace; font-size:11px; color:#374151; word-break:break-all;">
                      ${inviteLink}
                    </div>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding:24px 36px 0 36px;">
                    <div style="height:1px; background-color:#e5e7eb; line-height:1px; font-size:0;">&nbsp;</div>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding:16px 36px 28px 36px;">
                    <p style="margin:0 0 6px 0; font-size:12px; color:#6b7280;">
                      Need help? Contact us at <a href="mailto:${supportEmail}" style="color:#2563eb; text-decoration:none;">${supportEmail}</a>
                    </p>
                    <p style="margin:0; font-size:11px; color:#9ca3af;">
                      This is an automated message from ${companyName}. © ${companyName}.
                    </p>
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

    // Real email sending - delegate to send-smtp-email which has the working SMTP logic
    console.log("Sending invitation email to:", email);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
