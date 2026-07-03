import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import nodemailer from 'npm:nodemailer@6.9.14';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isAuthError(error: unknown): boolean {
  const msg = `${(error as { message?: string })?.message || error || ''}`.toLowerCase();
  return msg.includes('invalid login credentials') || msg.includes('email not confirmed');
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0] || '•'}•@${domain}`;
  return `${local[0]}${'•'.repeat(Math.min(local.length - 2, 5))}${local[local.length - 1]}@${domain}`;
}

async function sendVerificationEmail(
  admin: ReturnType<typeof createClient>,
  invite: any,
  actionLink: string,
) {
  let companyName = 'Vendor Portal';
  let supportEmail = 'vendxsupport@ramky.com';

  try {
    if (invite.tenant_id) {
      const { data: branding } = await admin
        .from('tenant_branding')
        .select('company_name, help_email')
        .eq('tenant_id', invite.tenant_id)
        .maybeSingle();
      if (branding?.company_name) companyName = branding.company_name;
      if (branding?.help_email) supportEmail = branding.help_email;
    }
  } catch (e) {
    console.warn('branding lookup failed:', e);
  }

  const { data: smtpCfg, error: smtpErr } = await admin
    .from('smtp_email_configs')
    .select('smtp_host, smtp_port, encryption, smtp_username, app_password, user_email, from_name, is_active')
    .eq('is_active', true)
    .not('app_password', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (smtpErr) throw new Error(`SMTP lookup failed: ${smtpErr.message}`);
  if (!smtpCfg?.app_password) throw new Error('No active SMTP configuration found');

  const smtpHost = String(smtpCfg.smtp_host ?? '').trim();
  const smtpPort = Number(smtpCfg.smtp_port ?? 587);
  const smtpEncryption = String(smtpCfg.encryption ?? 'tls').toLowerCase();
  let smtpUsername = String(smtpCfg.smtp_username ?? '').trim();
  const smtpPassword = String(smtpCfg.app_password ?? '').replace(/\s+/g, '');
  const smtpFromEmail = String(smtpCfg.user_email ?? smtpUsername).trim();
  if (!smtpUsername.includes('@') && smtpFromEmail.includes('@')) smtpUsername = smtpFromEmail;
  const cleanFromName = String(smtpCfg.from_name ?? 'Vendor Portal').replace(/[<>"]/g, '').trim();
  const fromHeader = cleanFromName ? `${cleanFromName} <${smtpFromEmail}>` : smtpFromEmail;
  const brandShort = (companyName.split(/\s+/)[0] || 'Vendor').toUpperCase();

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#2d3748;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;"><tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#1e3a5f;padding:28px 36px;text-align:center;color:#fff;font-family:Georgia,serif;font-size:22px;font-weight:600;letter-spacing:1.5px;">
          ${brandShort}<div style="font-size:11px;color:#d4a574;margin-top:4px;letter-spacing:3px;text-transform:uppercase;">Vendor Portal</div>
        </td></tr>
        <tr><td style="padding:36px;">
          <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:22px;color:#1e3a5f;">Continue your vendor registration</h1>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.7;">For your security, please confirm this mailbox before opening the vendor registration for <strong>${companyName}</strong>.</p>
          <p style="margin:0 0 24px;font-size:14px;line-height:1.7;">This confirms the invitation is being used by the originally invited vendor. The link expires shortly and can only be used from this mailbox.</p>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 24px;">
            <a href="${actionLink}" style="display:inline-block;background:#d4a574;color:#1e3a5f;text-decoration:none;padding:14px 40px;border-radius:4px;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Open Registration</a>
          </td></tr></table>
          <p style="margin:0 0 8px;font-size:11px;color:#718096;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">If the button doesn't work</p>
          <a href="${actionLink}" style="display:block;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:10px 14px;font-family:monospace;font-size:11px;color:#1e3a5f;word-break:break-all;">${actionLink}</a>
          <p style="margin:24px 0 0;font-size:12px;color:#718096;line-height:1.6;">If you did not request this, ignore this email. Questions? <a href="mailto:${supportEmail}" style="color:#1e3a5f;">${supportEmail}</a></p>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpEncryption === 'ssl',
    auth: { user: smtpUsername, pass: smtpPassword },
  });

  try {
    await transporter.sendMail({
      from: fromHeader,
      to: [invite.email],
      subject: `Confirm access to vendor registration - ${companyName}`,
      text: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      html,
    });
  } finally {
    try { transporter.close(); } catch { /* ignore */ }
  }
}

const PREFETCH_UA_RE =
  /(bot|crawler|spider|preview|scanner|linkcheck|fetch|slurp|mimecast|proofpoint|barracuda|forcepoint|symantec|urldefense|safelinks|outlook|microsoft-safelinks)/i;

function looksLikePrefetch(req: Request, attempt: number): boolean {
  if (attempt > 1) return false;
  const ua = req.headers.get('user-agent') || '';
  if (PREFETCH_UA_RE.test(ua)) return true;
  for (const h of req.headers.keys()) {
    const lower = h.toLowerCase();
    if (
      lower.startsWith('x-ms-exchange-') ||
      lower.startsWith('x-barracuda-') ||
      lower.startsWith('x-proofpoint-') ||
      lower.startsWith('x-mimecast-')
    ) {
      return true;
    }
  }
  const purpose = (req.headers.get('purpose') || req.headers.get('sec-purpose') || '').toLowerCase();
  if (purpose.includes('prefetch')) return true;
  return false;
}

async function findUserByEmail(admin: ReturnType<typeof createClient>, email: string): Promise<string | null> {
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    try {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) {
        console.warn('listUsers error page', page, error);
        return null;
      }
      const users = data?.users || [];
      const found = users.find((u: any) => (u.email || '').toLowerCase() === target);
      if (found) return found.id;
      if (users.length < 200) return null;
    } catch (e) {
      console.warn('listUsers threw page', page, e);
      return null;
    }
  }
  return null;
}

class StepError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function provisionUser(
  admin: ReturnType<typeof createClient>,
  invitedEmail: string,
  inviteId: string,
): Promise<void> {
  try {
    const existingUserId = await findUserByEmail(admin, invitedEmail);
    if (existingUserId) return;
    const { error: createErr } = await admin.auth.admin.createUser({
      email: invitedEmail,
      password: crypto.randomUUID() + 'Aa1!',
      email_confirm: true,
      user_metadata: { invited_via: 'vendor_invitation', invitation_id: inviteId },
    });
    if (createErr && !`${createErr.message}`.toLowerCase().includes('already')) {
      throw new StepError('provision_failed', createErr.message);
    }
  } catch (e) {
    if (e instanceof StepError) throw e;
    throw new StepError('provision_failed', (e as Error)?.message || String(e));
  }
}

async function generateVerificationLink(
  admin: ReturnType<typeof createClient>,
  supabaseUrl: string,
  invitedEmail: string,
  token: string,
  redirectOrigin: string,
): Promise<string> {
  const origin = String(redirectOrigin || '').replace(/\/+$/, '');
  if (!origin) throw new StepError('invalid_origin', 'Missing redirect origin');

  const redirectTo = `${origin}/vendor/invite/callback?token=${encodeURIComponent(token)}`;
  let linkData: any;
  try {
    const result = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: invitedEmail,
      options: { redirectTo },
    });
    if (result.error || !result.data?.properties?.action_link) {
      throw new StepError('generate_link_failed', result.error?.message || 'No action_link returned');
    }
    linkData = result.data;
  } catch (e) {
    if (e instanceof StepError) throw e;
    throw new StepError('generate_link_failed', (e as Error)?.message || String(e));
  }

  let actionLink = linkData.properties.action_link as string;
  // Only rewrite the action link's host to the app origin when Supabase auth is
  // served under the same host as the app (managed Cloud / same-origin proxy).
  // On self-hosted deployments where GoTrue lives at a different public host,
  // leaving the original action_link ensures the magic link actually resolves.
  try {
    const actionUrl = new URL(actionLink);
    const originUrl = new URL(origin);
    let supabaseHost = '';
    try { supabaseHost = new URL(supabaseUrl).host; } catch { /* ignore */ }

    const sameOrigin = supabaseHost && originUrl.host === supabaseHost;
    if (sameOrigin) {
      actionUrl.protocol = originUrl.protocol;
      actionUrl.host = originUrl.host;
      if (actionUrl.pathname.startsWith('/auth/v1/')) {
        actionUrl.pathname = '/supabase' + actionUrl.pathname;
      }
      const rt = actionUrl.searchParams.get('redirect_to');
      if (rt) {
        try {
          const rtUrl = new URL(rt);
          rtUrl.protocol = originUrl.protocol;
          rtUrl.host = originUrl.host;
          actionUrl.searchParams.set('redirect_to', rtUrl.toString());
        } catch { /* ignore */ }
      }
      actionLink = actionUrl.toString();
    }
  } catch (e) {
    console.warn('verification action link normalization failed:', e);
  }
  return actionLink;
}

async function sendInviteAccessVerification(
  admin: ReturnType<typeof createClient>,
  supabaseUrl: string,
  invite: any,
  token: string,
  redirectOrigin: string,
) {
  const invitedEmail = String(invite.email || '').toLowerCase();
  await provisionUser(admin, invitedEmail, invite.id);
  const actionLink = await generateVerificationLink(admin, supabaseUrl, invitedEmail, token, redirectOrigin);
  try {
    await sendVerificationEmail(admin, invite, actionLink);
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    const code = /no active smtp/i.test(msg) ? 'smtp_not_configured' : 'smtp_send_failed';
    throw new StepError(code, msg);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Diagnostics: GET returns env-presence so we can confirm deployment on self-hosted.
  if (req.method === 'GET') {
    return json(200, {
      ok: true,
      env_ok: {
        SUPABASE_URL: !!Deno.env.get('SUPABASE_URL'),
        SUPABASE_SERVICE_ROLE_KEY: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
        SUPABASE_ANON_KEY: !!Deno.env.get('SUPABASE_ANON_KEY'),
      },
      time: new Date().toISOString(),
    });
  }

  if (req.method !== 'POST') {
    return json(405, { status: 'pending', code: 'method_not_allowed', message: `Method ${req.method} not allowed` });
  }

  try {
    const { token, attempt, redirectOrigin } = await req.json().catch(() => ({}));
    if (!token || typeof token !== 'string') {
      return json(400, { status: 'invalid', code: 'missing_token', message: 'Missing token' });
    }

    if (looksLikePrefetch(req, Number(attempt) || 1)) {
      console.log('claim: prefetch suspected, deferring');
      return json(200, { status: 'pending', code: 'prefetch_suspected', message: 'Mail scanner prefetch suspected' });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return json(500, {
        status: 'error',
        code: 'env_missing',
        message: `Missing env: ${[
          !supabaseUrl && 'SUPABASE_URL',
          !serviceRoleKey && 'SUPABASE_SERVICE_ROLE_KEY',
        ].filter(Boolean).join(', ')}`,
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    let callerUserId: string | null = null;
    let callerEmail: string | null = null;
    if (jwt) {
      try {
        const { data: userData } = await admin.auth.getUser(jwt);
        if (userData?.user) {
          callerUserId = userData.user.id;
          callerEmail = (userData.user.email || '').toLowerCase();
        }
      } catch { /* ignore */ }
    }

    const { data: invite, error: lookupErr } = await admin
      .from('vendor_invitations')
      .select('id, email, expires_at, used_at, user_id, vendor_id, tenant_id, signin_sent_count, last_signin_sent_at')
      .eq('token', token)
      .maybeSingle();

    if (lookupErr) {
      console.error('lookup failed:', lookupErr);
      return json(500, { status: 'error', code: 'lookup_failed', message: lookupErr.message });
    }
    if (!invite) {
      return json(404, { status: 'invalid', code: 'invalid', message: 'Invitation not found for token' });
    }
    console.log('claim: lookup ok', { invite_id: invite.id, used: !!invite.used_at });

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return json(410, { status: 'expired', code: 'expired', message: 'Invitation expired' });
    }

    const invitedEmail = String(invite.email || '').toLowerCase();
    if (callerUserId || callerEmail) {
      if (callerEmail !== invitedEmail) {
        try {
          await admin.from('invitation_email_events').insert({
            invitation_id: invite.id,
            email_id: null,
            event_type: 'access_denied',
            event_data: { reason: 'email_mismatch', caller_email: callerEmail, caller_user_id: callerUserId },
          });
        } catch { /* ignore */ }
        return json(403, { status: 'denied', code: 'email_mismatch', message: 'This invitation belongs to a different email address' });
      }

      if (invite.user_id && callerUserId && invite.user_id !== callerUserId) {
        try {
          await admin.from('invitation_email_events').insert({
            invitation_id: invite.id,
            email_id: null,
            event_type: 'access_denied',
            event_data: { reason: 'user_mismatch', caller_email: callerEmail, caller_user_id: callerUserId, bound_user_id: invite.user_id },
          });
        } catch { /* ignore */ }
        return json(403, { status: 'denied', code: 'already_claimed', message: 'This invitation is already bound to another user' });
      }

      if (!invite.user_id && callerUserId) {
        const { data: boundInvite, error: bindErr } = await admin
          .from('vendor_invitations')
          .update({ user_id: callerUserId })
          .eq('id', invite.id)
          .is('user_id', null)
          .select('user_id')
          .maybeSingle();
        if (bindErr) {
          console.error('invite bind failed:', bindErr);
          return json(500, { status: 'error', code: 'bind_failed', message: bindErr.message });
        }
        if (!boundInvite?.user_id) {
          const { data: latestInvite } = await admin
            .from('vendor_invitations')
            .select('user_id')
            .eq('id', invite.id)
            .maybeSingle();
          if (latestInvite?.user_id && latestInvite.user_id !== callerUserId) {
            return json(403, { status: 'denied', code: 'already_claimed', message: 'This invitation is already bound to another user' });
          }
        }
      }

      try {
        await admin.from('invitation_email_events').insert({
          invitation_id: invite.id,
          email_id: null,
          event_type: invite.used_at ? 'reopen_authorized' : 'verified_claim',
          event_data: { user_id: callerUserId, email: callerEmail },
        });
      } catch { /* ignore */ }

      return json(200, {
        status: invite.used_at ? 'already_claimed_same_user' : 'verified',
        redirect: `/vendor/registration?token=${encodeURIComponent(token)}`,
        vendor_id: invite.vendor_id,
      });
    }

    if (invite.used_at && invite.user_id) {
      // Signed-out original vendors can still recover access, but the login link
      // is sent only to the originally invited mailbox. A forwarded recipient
      // cannot complete this step unless they control that mailbox.
      try {
        const now = new Date();
        const lastSent = invite.last_signin_sent_at ? new Date(invite.last_signin_sent_at) : null;
        const withinHour = !!lastSent && (now.getTime() - lastSent.getTime()) < 3600_000;
        if (withinHour && (invite.signin_sent_count ?? 0) >= 5) {
          return json(429, { status: 'error', code: 'rate_limited', message: 'Too many verification emails. Please try again later.' });
        }
        await sendInviteAccessVerification(admin, supabaseUrl, invite, token, redirectOrigin);
        const nextCount = withinHour ? (invite.signin_sent_count ?? 0) + 1 : 1;
        await admin.from('vendor_invitations').update({ signin_sent_count: nextCount, last_signin_sent_at: now.toISOString() }).eq('id', invite.id);
        await admin.from('invitation_email_events').insert({
          invitation_id: invite.id,
          email_id: null,
          event_type: 'access_verification_sent',
          event_data: { count: nextCount, reopen: true },
        });
        return json(200, {
          status: 'verification_sent',
          masked_email: maskEmail(invitedEmail),
          sends_remaining: Math.max(0, 5 - nextCount),
        });
      } catch (e) {
        console.error('reopen verification send failed:', e);
        return json(500, { status: 'error', code: 'verification_send_failed', message: (e as Error)?.message || String(e) });
      }
    }

    try {
      const now = new Date();
      const lastSent = invite.last_signin_sent_at ? new Date(invite.last_signin_sent_at) : null;
      const withinHour = !!lastSent && (now.getTime() - lastSent.getTime()) < 3600_000;
      if (withinHour && (invite.signin_sent_count ?? 0) >= 5) {
        return json(429, { status: 'error', code: 'rate_limited', message: 'Too many verification emails. Please try again later.' });
      }
      await sendInviteAccessVerification(admin, supabaseUrl, invite, token, redirectOrigin);
      const nextCount = withinHour ? (invite.signin_sent_count ?? 0) + 1 : 1;
      await admin.from('vendor_invitations').update({ signin_sent_count: nextCount, last_signin_sent_at: now.toISOString() }).eq('id', invite.id);
      await admin.from('invitation_email_events').insert({
        invitation_id: invite.id,
        email_id: null,
        event_type: 'access_verification_sent',
        event_data: { count: nextCount, reopen: false },
      });
      return json(200, {
        status: 'verification_sent',
        masked_email: maskEmail(invitedEmail),
        sends_remaining: Math.max(0, 5 - nextCount),
      });
    } catch (e) {
      console.error('verification send failed:', e);
      return json(500, { status: 'error', code: 'verification_send_failed', message: (e as Error)?.message || String(e) });
    }
  } catch (err) {
    console.error('claim-vendor-invite error:', err);
    return json(500, {
      status: 'error',
      code: 'unknown',
      message: (err as Error)?.message || String(err),
    });
  }
});
