import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SmtpRequest {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  // Optional inline overrides (otherwise loaded from portal_config)
  smtp?: {
    host?: string;
    port?: number;
    encryption?: "none" | "ssl" | "tls" | "starttls";
    username?: string;
    password?: string;
    from_email?: string;
    from_name?: string;
    reply_to?: string;
  };
}

async function loadSmtpConfig(supabase: ReturnType<typeof createClient>) {
  const keys = [
    "smtp_host",
    "smtp_port",
    "smtp_username",
    "smtp_password",
    "smtp_encryption",
    "smtp_from_email",
    "smtp_from_name",
    "smtp_reply_to",
    "smtp_enabled",
  ];
  const { data, error } = await supabase
    .from("portal_config")
    .select("config_key, config_value")
    .in("config_key", keys);
  if (error) throw error;
  const cfg: Record<string, unknown> = {};
  for (const row of data ?? []) {
    cfg[(row as any).config_key] = (row as any).config_value;
  }
  return cfg;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: SmtpRequest = await req.json();
    if (!body.to || !body.subject || (!body.html && !body.text)) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, html|text" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const stored = await loadSmtpConfig(supabase);
    const smtp = body.smtp ?? {};

    const host = String(smtp.host ?? stored.smtp_host ?? "").trim();
    const port = Number(smtp.port ?? stored.smtp_port ?? 587);
    const encryption = String(
      smtp.encryption ?? stored.smtp_encryption ?? "tls"
    ).toLowerCase() as "none" | "ssl" | "tls" | "starttls";
    const username = String(smtp.username ?? stored.smtp_username ?? "").trim();
    const password = String(smtp.password ?? stored.smtp_password ?? "");
    const fromEmail = String(smtp.from_email ?? stored.smtp_from_email ?? username).trim();
    const fromName = String(smtp.from_name ?? stored.smtp_from_name ?? "").trim();
    const replyTo = String(smtp.reply_to ?? body.replyTo ?? stored.smtp_reply_to ?? "").trim();

    if (!host || !username || !password || !fromEmail) {
      return new Response(
        JSON.stringify({
          error: "SMTP is not fully configured. Please set host, username, password, and From email in Admin → Email (SMTP).",
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Deno's edge runtime has issues with STARTTLS upgrade on port 587.
    // Force implicit TLS on port 465 for Gmail/most providers for reliability.
    const isGmail = host.toLowerCase().includes("gmail");
    const effectivePort = isGmail && port === 587 ? 465 : port;
    const useImplicitTls =
      encryption === "ssl" ||
      effectivePort === 465 ||
      (isGmail && port === 587);

    console.log(
      `[send-smtp-email] Connecting host=${host} port=${effectivePort} implicitTLS=${useImplicitTls}`
    );

    const client = new SMTPClient({
      connection: {
        hostname: host,
        port: effectivePort,
        tls: useImplicitTls,
        auth: { username, password },
      },
      debug: { log: true },
    });

    const from = fromName
      ? `${fromName.replace(/[<>"]/g, "")} <${fromEmail}>`
      : fromEmail;

    const toArr = Array.isArray(body.to) ? body.to : [body.to];
    const ccArr = body.cc ? (Array.isArray(body.cc) ? body.cc : [body.cc]) : undefined;
    const bccArr = body.bcc ? (Array.isArray(body.bcc) ? body.bcc : [body.bcc]) : undefined;

    console.log(`[send-smtp-email] from="${from}" to=${JSON.stringify(toArr)}`);

    // Build plain-text fallback from HTML if not explicitly provided
    const plainText = body.text ?? (body.html
      ? body.html
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<\/(p|div|h[1-6]|li|tr|br)>/gi, "\n")
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<[^>]+>/g, "")
          .replace(/&nbsp;/gi, " ")
          .replace(/&amp;/gi, "&")
          .replace(/&lt;/gi, "<")
          .replace(/&gt;/gi, ">")
          .replace(/&quot;/gi, '"')
          .replace(/\n\s*\n\s*\n/g, "\n\n")
          .trim()
      : "");

    await client.send({
      from,
      to: toArr,
      cc: ccArr,
      bcc: bccArr,
      replyTo: replyTo || undefined,
      subject: body.subject,
      content: plainText,
      html: body.html,
    });

    await client.close();

    // Audit log (best-effort)
    try {
      await supabase.from("audit_logs").insert({
        action: "smtp_email_sent",
        details: {
          to: body.to,
          subject: body.subject,
          host,
          port,
          encryption,
          from,
        },
      });
    } catch (e) {
      console.error("audit_logs insert failed", e);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("send-smtp-email error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message ?? String(error) }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
