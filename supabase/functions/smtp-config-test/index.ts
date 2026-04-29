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

    const { id, to } = await req.json();
    if (!id) {
      return new Response(JSON.stringify({ error: "Missing id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: cfg, error } = await admin
      .from("smtp_email_configs")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    if (!cfg) throw new Error("Config not found");

    const host = String(cfg.smtp_host).trim();
    const port = Number(cfg.smtp_port);
    const encryption = String(cfg.encryption).toLowerCase();
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
        auth: { username: cfg.smtp_username, password: cfg.app_password },
      },
    });

    const fromName = (cfg.from_name ?? "").toString().replace(/[<>"]/g, "");
    const from = fromName ? `${fromName} <${cfg.user_email}>` : cfg.user_email;
    const recipient = (to && String(to).trim()) || cfg.user_email;

    await client.send({
      from,
      to: [recipient],
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
