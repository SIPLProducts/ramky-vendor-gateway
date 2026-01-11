import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InvitationEmailRequest {
  email: string;
  token: string;
  expiresAt: string;
  simulationMode?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, token, expiresAt, simulationMode = false }: InvitationEmailRequest = await req.json();

    const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://lovable.app";
    const inviteLink = `${frontendUrl}/vendor/invite?token=${token}`;

    const expiryDate = new Date(expiresAt).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Ramky Infrastructure Limited</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Vendor Management Portal</p>
        </div>
        
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1f2937; margin-top: 0;">You're Invited to Register</h2>
          
          <p>Hello,</p>
          
          <p>You have been invited to register as a vendor with Ramky Infrastructure Limited. Please click the button below to create your account and complete your vendor registration.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteLink}" style="background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
              Start Registration
            </a>
          </div>
          
          <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">
              <strong>⚠️ Important:</strong> This invitation link expires on <strong>${expiryDate}</strong>. Please complete your registration before this date.
            </p>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">If the button above doesn't work, copy and paste this link into your browser:</p>
          <p style="background: #f3f4f6; padding: 12px; border-radius: 6px; word-break: break-all; font-size: 12px; color: #4b5563;">
            ${inviteLink}
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #6b7280; font-size: 12px; margin-bottom: 0;">
            This is an automated message from Ramky Infrastructure Limited. If you did not expect this invitation, please ignore this email or contact our support team.
          </p>
        </div>
      </body>
      </html>
    `;

    // Simulation mode - log instead of sending
    if (simulationMode || !RESEND_API_KEY) {
      console.log("[Invitation Email - SIMULATION MODE]");
      console.log("To:", email);
      console.log("Subject: Vendor Registration Invitation - Ramky Infrastructure");
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

    // Real email sending with Resend
    console.log("Sending invitation email to:", email);
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Ramky Infrastructure <onboarding@resend.dev>",
        to: [email],
        subject: "Vendor Registration Invitation - Ramky Infrastructure",
        html: emailHtml,
      }),
    });
    
    console.log("Resend API response status:", emailResponse.status);

    const result = await emailResponse.json();

    if (!emailResponse.ok) {
      throw new Error(result.message || "Failed to send email");
    }

    console.log("Invitation email sent successfully:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
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
