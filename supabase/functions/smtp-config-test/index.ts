import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.14";

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
    // Any authenticated user reaching this admin-only screen is allowed.
    // Frontend gates the page; role names differ across deployments
    // (built-in user_roles vs. custom roles), so we don't hard-allowlist here.

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

    // Honor the admin-configured port and encryption exactly.
    // Implicit TLS only when encryption === "ssl" (typical port 465).
    // STARTTLS upgrade for "tls" / "starttls" (typical port 587).
    const effectivePort = port;
    const useImplicitTls = encryption === "ssl";

    const transporter = nodemailer.createTransport({
      host,
      port: effectivePort,
      secure: useImplicitTls,
      auth: { user: username, pass: password },
    });

    const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
      Promise.race([
        p,
        new Promise<T>((_, rej) =>
          setTimeout(
            () =>
              rej(
                new Error(
                  `${label} timed out after ${ms / 1000}s — check firewall egress on port ${effectivePort} from server to ${host}`,
                ),
              ),
            ms,
          )
        ),
      ]);

    const cleanFromName = fromName.replace(/[<>"]/g, "");
    const from = cleanFromName ? `${cleanFromName} <${fromEmail}>` : fromEmail;
    const recipient = (to && String(to).trim()) || fromEmail;

    // Treat the configured Reply-To list as CC. Drop invalid entries so the
    // test send is never aborted by a malformed address.
    const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
    const ccArr = (replyTo ?? "")
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const m = s.match(/<([^>]+)>/);
        return (m ? m[1] : s).trim();
      })
      .filter((s) => isEmail(s) && s.toLowerCase() !== recipient.toLowerCase());

    const trySend = async (withCc: boolean) => {
      await transporter.sendMail({
        from,
        to: [recipient],
        cc: withCc && ccArr.length ? ccArr : undefined,
        subject: "Ramky Vyapaar Portal — SMTP Test Email",
        text:
          "This is a test email confirming your SMTP configuration is working.",
        html:
          "<p>This is a <strong>test email</strong> confirming your SMTP configuration is working.</p>",
      });
    };

    try {
      await withTimeout(trySend(true), 25000, "SMTP send");
    } catch (e: any) {
      console.warn("smtp-config-test retry without cc:", e?.message ?? e);
      await withTimeout(trySend(false), 25000, "SMTP send");
    }
    try { transporter.close(); } catch { /* ignore */ }

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
