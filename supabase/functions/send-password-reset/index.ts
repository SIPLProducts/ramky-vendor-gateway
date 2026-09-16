import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const RequestSchema = z.object({
  email: z.string().trim().email().max(320),
  redirectTo: z.string().url().optional(),
});

const jsonResponse = (body: unknown, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { "Content-Type": "application/json", ...corsHeaders } },
);

const getTrustedResetUrl = (req: Request, redirectTo?: string): URL | null => {
  if (!redirectTo) return null;

  const candidate = new URL(redirectTo);
  if (!['http:', 'https:'].includes(candidate.protocol)) return null;

  // The browser Origin confirms the request came from the same portal URL.
  // GoTrue still enforces its configured redirect allow-list.
  const requestOrigin = req.headers.get('origin');
  if (requestOrigin) {
    const originUrl = new URL(requestOrigin);
    if (candidate.origin.toLowerCase() !== originUrl.origin.toLowerCase()) return null;
  } else {
    const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
    const requestHost = forwardedHost || req.headers.get('host')?.split(',')[0]?.trim();
    if (!requestHost || candidate.host.toLowerCase() !== requestHost.toLowerCase()) return null;
    const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
    if (forwardedProto === 'http' || forwardedProto === 'https') candidate.protocol = `${forwardedProto}:`;
  }
  candidate.pathname = '/reset-password';
  candidate.search = '';
  candidate.hash = '';
  return candidate;
};

const buildPortalRecoveryLink = (
  properties: Record<string, unknown>,
  resetUrl: URL,
): string | null => {
  // password-reset-direct-portal-v2
  // Older self-hosted auth releases expose the recovery hash only inside
  // action_link. Extract it, but never reuse that link's configured hostname.
  let hashedToken = typeof properties.hashed_token === 'string'
    ? properties.hashed_token
    : null;
  if (!hashedToken && typeof properties.action_link === 'string') {
    try {
      const generatedUrl = new URL(properties.action_link);
      hashedToken = generatedUrl.searchParams.get('token_hash')
        || generatedUrl.searchParams.get('token');
    } catch {
      return null;
    }
  }
  if (!hashedToken) return null;

  const portalUrl = new URL(resetUrl.toString());
  portalUrl.searchParams.set('token_hash', hashedToken);
  portalUrl.searchParams.set('type', 'recovery');
  return portalUrl.toString();
};

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const parsed = RequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return jsonResponse({ success: false, error: parsed.error.flatten().fieldErrors }, 400);
    }
    const { email, redirectTo } = parsed.data;
    const trustedResetUrl = getTrustedResetUrl(req, redirectTo);
    if (!trustedResetUrl) {
      return jsonResponse({ success: false, error: "Reset destination does not match this portal" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new Error("Server authentication configuration is unavailable");
    const admin = createClient(supabaseUrl, serviceKey);

    // Generate the recovery link (does NOT auto-send any email)
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: trustedResetUrl.toString() },
    });

    // To avoid email enumeration, treat user-not-found as success (silent no-op).
    if (linkError) {
      const msg = String(linkError.message ?? "");
      if (/not.?found/i.test(msg) || /no user/i.test(msg)) {
        console.log(`[send-password-reset] silent no-op for ${email}: ${msg}`);
        return jsonResponse({ success: true });
      }
      throw linkError;
    }

    const properties = linkData?.properties as Record<string, unknown> | undefined;
    const rawActionLink = typeof properties?.action_link === 'string'
      ? properties.action_link
      : undefined;
    if (!rawActionLink) {
      throw new Error("Failed to generate reset link");
    }
    // Always verify inside the requesting portal. Never expose the auth
    // service's action_link because its configured hostname may be stale.
    const actionLink = buildPortalRecoveryLink(
      properties || {},
      trustedResetUrl,
    );
    if (!actionLink) {
      throw new Error("Authentication service did not return a usable recovery token");
    }
    const safeActionLink = escapeHtml(actionLink);

    const subject = "Reset your Ramky Vyapaar Portal password";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1F2937;">
        <h2 style="color: #195B9B; margin: 0 0 12px;">Reset your password</h2>
        <p>Hi,</p>
        <p>We received a request to reset the password for your Ramky Vyapaar Portal account.</p>
        <p style="margin: 24px 0;">
          <a href="${safeActionLink}"
             style="background:#195B9B;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;display:inline-block;font-weight:600;">
            Reset Password
          </a>
        </p>
        <p style="font-size: 12px; color: #6B7280;">
          If the button doesn't work, copy and paste this link into your browser:<br/>
          <a href="${safeActionLink}" style="color:#195B9B; word-break:break-all;">${safeActionLink}</a>
        </p>
        <p style="font-size: 12px; color: #6B7280;">
          This link will expire shortly. If you did not request this, please ignore this email.
        </p>
        <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;"/>
        <p style="font-size: 11px; color: #9CA3AF;">Ramky Vyapaar Portal · Do not reply to this email.</p>
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

    return jsonResponse({ success: true });
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
