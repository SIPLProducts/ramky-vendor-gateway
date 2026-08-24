import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function randomPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("") + "Aa1!";
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0]}•@${domain}`;
  return `${local[0]}${"•".repeat(Math.min(local.length - 2, 4))}${local[local.length - 1]}@${domain}`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Deprecated for security. This endpoint accepted a client-supplied email and
  // could send a login credential for an invitation token. The supported flow is
  // claim-vendor-invite, which sends verification only to the invitation email
  // stored on the server and then verifies/binds the authenticated user.
  return new Response(
    JSON.stringify({ error: "Deprecated invite sign-in flow", code: "deprecated_invite_flow" }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );

  try {
    const { token, redirectOrigin, confirmed_email } = await req.json();
    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ error: "Missing token", code: "invalid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!confirmed_email || typeof confirmed_email !== "string") {
      return new Response(JSON.stringify({ error: "Missing confirmed_email", code: "email_required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Load invitation
    const { data: invite, error: lookupErr } = await admin
      .from("vendor_invitations")
      .select(
        "id, email, expires_at, used_at, tenant_id, signin_sent_count, last_signin_sent_at"
      )
      .eq("token", token)
      .maybeSingle();

    if (lookupErr) {
      console.error("invitation lookup failed:", lookupErr);
      return new Response(JSON.stringify({ error: "Lookup failed", code: "lookup_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!invite) {
      return new Response(JSON.stringify({ error: "Invalid invitation", code: "invalid" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if ((invite.email || "").trim().toLowerCase() !== confirmed_email.trim().toLowerCase()) {
      return new Response(
        JSON.stringify({ error: "Email does not match invitation", code: "email_mismatch" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Invitation expired", code: "expired" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (invite.used_at) {
      return new Response(
        JSON.stringify({ error: "Invitation already used", code: "already_used" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Rate limit: max 5 sends per hour
    const now = new Date();
    const lastSent = invite.last_signin_sent_at ? new Date(invite.last_signin_sent_at) : null;
    const withinHour = lastSent && (now.getTime() - lastSent.getTime()) < 3600_000;
    if (withinHour && (invite.signin_sent_count ?? 0) >= 5) {
      return new Response(
        JSON.stringify({ error: "Too many attempts, please try again later", code: "rate_limited" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const email = invite.email as string;

    // 3. Ensure auth user exists
    try {
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const exists = !!list?.users?.find(
        (u) => (u.email || "").toLowerCase() === email.toLowerCase()
      );
      if (!exists) {
        const { error: createErr } = await admin.auth.admin.createUser({
          email,
          password: randomPassword(),
          email_confirm: true,
          user_metadata: { invited_via: "vendor_invitation", invitation_id: invite.id },
        });
        if (createErr && !`${createErr.message}`.toLowerCase().includes("already")) {
          console.error("createUser failed:", createErr);
          return new Response(
            JSON.stringify({ error: "Could not provision account", code: "provision_failed" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    } catch (e) {
      console.warn("listUsers failed:", e);
    }

    // 4. Generate magic link
    const origin = (redirectOrigin || "").replace(/\/$/, "");
    const redirectTo = origin
      ? `${origin}/vendor/invite/callback?token=${encodeURIComponent(token)}`
      : undefined;

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: redirectTo ? { redirectTo } : undefined,
    });

    if (linkErr || !linkData?.properties?.action_link) {
      console.error("generateLink failed:", linkErr);
      return new Response(
        JSON.stringify({ error: "Could not create sign-in link", code: "link_failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Normalize action link for self-hosted proxy
    const rawActionLink = linkData.properties.action_link as string;
    let actionLink = rawActionLink;
    try {
      const actionUrl = new URL(rawActionLink);
      const originUrl = redirectOrigin ? new URL(redirectOrigin) : null;
      if (originUrl) {
        actionUrl.protocol = originUrl.protocol;
        actionUrl.host = originUrl.host;
        if (actionUrl.pathname.startsWith("/auth/v1/")) {
          actionUrl.pathname = "/supabase" + actionUrl.pathname;
        }
        const rt = actionUrl.searchParams.get("redirect_to");
        if (rt) {
          try {
            const rtUrl = new URL(rt);
            rtUrl.protocol = originUrl.protocol;
            rtUrl.host = originUrl.host;
            actionUrl.searchParams.set("redirect_to", rtUrl.toString());
          } catch { /* ignore */ }
        }
        actionLink = actionUrl.toString();
      }
    } catch (e) {
      console.warn("action_link normalization failed:", e);
    }

    // 6. Resolve company name for the email
    let companyName = "Vyapaar Portal";
    let supportEmail = "vyapaarsupport@ramky.com";
    try {
      if (invite.tenant_id) {
        const { data: branding } = await admin
          .from("tenant_branding")
          .select("company_name, help_email")
          .eq("tenant_id", invite.tenant_id)
          .maybeSingle();
        if (branding?.company_name) companyName = branding.company_name;
        if (branding?.help_email) supportEmail = branding.help_email;
      }
    } catch { /* ignore */ }

    // 7. Look up an active SMTP config
    const { data: smtpCfg } = await admin
      .from("smtp_email_configs")
      .select("smtp_host, smtp_port, encryption, smtp_username, app_password, user_email, from_name, is_active")
      .eq("is_active", true)
      .not("app_password", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!smtpCfg?.app_password) {
      return new Response(
        JSON.stringify({ error: "No active SMTP configuration found", code: "smtp_missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = `
      <!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#2d3748;">
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
          <tr><td align="center">
            <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
              <tr><td style="background:#1e3a5f;padding:28px 36px;text-align:center;color:#fff;font-family:Georgia,serif;font-size:22px;font-weight:600;letter-spacing:1.5px;">
                ${companyName.split(/\s+/)[0].toUpperCase()}<div style="font-size:11px;color:#d4a574;margin-top:4px;letter-spacing:3px;text-transform:uppercase;">Vyapaar Portal</div>
              </td></tr>
              <tr><td style="padding:36px;">
                <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:22px;color:#1e3a5f;">Sign in to your vendor registration</h1>
                <p style="margin:0 0 20px;font-size:14px;line-height:1.7;">Someone (hopefully you) requested a secure sign-in link to complete your vendor registration for <strong>${companyName}</strong>.</p>
                <p style="margin:0 0 24px;font-size:14px;line-height:1.7;">Click the button below to continue. This link is single-use and expires in 1 hour.</p>
                <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 24px;">
                  <a href="${actionLink}" style="display:inline-block;background:#d4a574;color:#1e3a5f;text-decoration:none;padding:14px 40px;border-radius:4px;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Sign In &amp; Continue</a>
                </td></tr></table>
                <p style="margin:0 0 8px;font-size:11px;color:#718096;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">If the button doesn't work</p>
                <a href="${actionLink}" style="display:block;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:10px 14px;font-family:monospace;font-size:11px;color:#1e3a5f;word-break:break-all;">${actionLink}</a>
                <p style="margin:24px 0 0;font-size:12px;color:#718096;line-height:1.6;">If you didn't request this, you can safely ignore this email. Questions? <a href="mailto:${supportEmail}" style="color:#1e3a5f;">${supportEmail}</a></p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body></html>`;

    const smtpHost = String(smtpCfg.smtp_host ?? "").trim();
    const smtpPort = Number(smtpCfg.smtp_port ?? 587);
    const smtpEncryption = String(smtpCfg.encryption ?? "tls").toLowerCase();
    let smtpUsername = String(smtpCfg.smtp_username ?? "").trim();
    const smtpPassword = String(smtpCfg.app_password ?? "").replace(/\s+/g, "");
    const smtpFromEmail = String(smtpCfg.user_email ?? smtpUsername).trim();
    if (!smtpUsername.includes("@") && smtpFromEmail.includes("@")) smtpUsername = smtpFromEmail;
    const cleanFromName = (smtpCfg.from_name ?? "Vyapaar Portal").toString().replace(/[<>"]/g, "").trim();
    const fromHeader = cleanFromName ? `${cleanFromName} <${smtpFromEmail}>` : smtpFromEmail;

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpEncryption === "ssl",
      auth: { user: smtpUsername, pass: smtpPassword },
    });

    try {
      await transporter.sendMail({
        from: fromHeader,
        to: [email],
        subject: `Sign in to complete your vendor registration - ${companyName}`,
        text: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        html,
      });
    } finally {
      try { transporter.close(); } catch { /* ignore */ }
    }

    // 8. Update send counters
    const nextCount = withinHour ? (invite.signin_sent_count ?? 0) + 1 : 1;
    await admin
      .from("vendor_invitations")
      .update({
        signin_sent_count: nextCount,
        last_signin_sent_at: now.toISOString(),
      })
      .eq("id", invite.id);

    try {
      await admin.from("invitation_email_events").insert({
        invitation_id: invite.id,
        email_id: null,
        event_type: "signin_link_sent",
        event_data: { count: nextCount },
      });
    } catch { /* ignore */ }

    return new Response(
      JSON.stringify({
        ok: true,
        masked_email: maskEmail(email),
        sends_remaining: Math.max(0, 5 - nextCount),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-invite-signin-link error:", err);
    return new Response(JSON.stringify({ error: "Unexpected error", code: "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
