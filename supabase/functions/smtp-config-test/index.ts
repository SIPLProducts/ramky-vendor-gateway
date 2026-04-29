import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const roleCheck = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userRes.user.id);
    const roles = (roleCheck.data ?? []).map((r: any) => r.role);
    const allowed = roles.some((r: string) =>
      ["sharvi_admin", "admin", "customer_admin"].includes(r),
    );
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { id, to } = body ?? {};

    let host: string;
    let port: number;
    let encryption: string;
    let username: string;
    let password: string;
    let fromEmail: string;
    let fromName: string;
    let replyTo: string | null;

    if (id) {
      const { data: cfg, error } = await admin
        .from("smtp_email_configs")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      if (!cfg) throw new Error("Config not found");
      host = String(cfg.smtp_host).trim();
      port = Number(cfg.smtp_port);
      encryption = String(cfg.encryption).toLowerCase();
      username = cfg.smtp_username;
      password = cfg.app_password;
      fromEmail = cfg.user_email;
      fromName = (cfg.from_name ?? "").toString();
      replyTo = (cfg.reply_to ?? null) as string | null;
    } else {
      // Inline test from form values (not yet saved)
      if (!body?.smtp_host || !body?.smtp_port || !body?.smtp_username || !body?.app_password || !body?.from_email) {
        return new Response(
          JSON.stringify({ error: "Missing fields for inline test" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      host = String(body.smtp_host).trim();
      port = Number(body.smtp_port);
      encryption = String(body.encryption ?? "tls").toLowerCase();
      username = String(body.smtp_username).trim();
      password = String(body.app_password);
      fromEmail = String(body.from_email).trim();
      fromName = String(body.from_name ?? "");
      replyTo = body.reply_to ? String(body.reply_to).trim() : null;
    }

    const isGmail = host.toLowerCase().includes("gmail");
    const effectivePort = isGmail && port === 587 ? 465 : port;
    const useImplicitTls =
      encryption === "ssl" ||
      effectivePort === 465 ||
      (isGmail && port === 587);

    const client = new SMTPClient({
      connection: {
        hostname: host,
        port: effectivePort,
        tls: useImplicitTls,
        auth: { username, password },
      },
    });

    const cleanFromName = fromName.replace(/[<>"]/g, "");
    const from = cleanFromName ? `${cleanFromName} <${fromEmail}>` : fromEmail;
    const recipient = (to && String(to).trim()) || fromEmail;

    await client.send({
      from,
      to: [recipient],
      replyTo: replyTo ?? undefined,
      subject: "Sharvi Vendor Portal — SMTP Test Email",
      content:
        "This is a test email confirming your SMTP configuration is working.",
      html:
        "<p>This is a <strong>test email</strong> confirming your SMTP configuration is working.</p>",
    });
    await client.close();

    return new Response(
      JSON.stringify({ success: true, sentTo: recipient }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e: any) {
    console.error("smtp-config-test error", e);
    return new Response(
      JSON.stringify({ success: false, error: e?.message ?? String(e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
