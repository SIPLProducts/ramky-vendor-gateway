import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, redirectTo } = await req.json();
    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ success: false, error: "Email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Generate the recovery link (does NOT auto-send any email)
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: redirectTo || undefined },
    });

    // To avoid email enumeration, treat user-not-found as success (silent no-op).
    if (linkError) {
      const msg = String(linkError.message ?? "");
      if (/not.?found/i.test(msg) || /no user/i.test(msg)) {
        console.log(`[send-password-reset] silent no-op for ${email}: ${msg}`);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      throw linkError;
    }

    const actionLink = (linkData as any)?.properties?.action_link as string | undefined;
    if (!actionLink) {
      throw new Error("Failed to generate reset link");
    }

    const subject = "Reset your Ramky Vypaar Portal password";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1F2937;">
        <h2 style="color: #195B9B; margin: 0 0 12px;">Reset your password</h2>
        <p>Hi,</p>
        <p>We received a request to reset the password for your Ramky Vypaar Portal account.</p>
        <p style="margin: 24px 0;">
          <a href="${actionLink}"
             style="background:#195B9B;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;display:inline-block;font-weight:600;">
            Reset Password
          </a>
        </p>
        <p style="font-size: 12px; color: #6B7280;">
          If the button doesn't work, copy and paste this link into your browser:<br/>
          <a href="${actionLink}" style="color:#195B9B; word-break:break-all;">${actionLink}</a>
        </p>
        <p style="font-size: 12px; color: #6B7280;">
          This link will expire shortly. If you did not request this, please ignore this email.
        </p>
        <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;"/>
        <p style="font-size: 11px; color: #9CA3AF;">Ramky Vypaar Portal · Do not reply to this email.</p>
      </div>
    `;

    // Send via the No-Reply SMTP config stored in portal_config
    const { data: sendData, error: sendError } = await admin.functions.invoke("send-smtp-email", {
      body: { to: email, subject, html, suppressReplyTo: true },
    });
    if (sendError) throw sendError;
    if ((sendData as any)?.success === false) {
      throw new Error((sendData as any)?.error ?? "Failed to send reset email");
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("send-password-reset error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message ?? "Unable to send the reset email due to a mail service issue.",
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});
