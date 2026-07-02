import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { token, email } = await req.json();
    if (!token || typeof token !== 'string' || !email || typeof email !== 'string') {
      return json({ ok: false, code: 'invalid' }, 400);
    }

    const attempted = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(attempted)) {
      return json({ ok: false, code: 'invalid' }, 400);
    }
    const attemptedDomain = attempted.split('@')[1] || '';

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: invite } = await admin
      .from('vendor_invitations')
      .select('id, email, expires_at, used_at')
      .eq('token', token)
      .maybeSingle();

    if (!invite) return json({ ok: false, code: 'invalid' }, 404);

    // Rate limit: >10 attempts in last 15 min for this invite
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const { count } = await admin
      .from('invitation_email_events')
      .select('id', { count: 'exact', head: true })
      .eq('invitation_id', invite.id)
      .eq('event_type', 'email_confirm_attempt')
      .gte('created_at', since);

    if ((count ?? 0) >= 10) {
      return json({ ok: false, code: 'rate_limited' }, 429);
    }

    const matched = (invite.email || '').trim().toLowerCase() === attempted;

    // Log attempt (domain only, never the guessed local-part)
    try {
      await admin.from('invitation_email_events').insert({
        invitation_id: invite.id,
        email_id: null,
        event_type: 'email_confirm_attempt',
        event_data: { matched, attempted_domain: attemptedDomain },
      });
    } catch { /* ignore */ }

    if (!matched) return json({ ok: false, code: 'email_mismatch' }, 200);

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return json({ ok: false, code: 'expired' }, 200);
    }
    if (invite.used_at) return json({ ok: false, code: 'used' }, 200);

    return json({ ok: true });
  } catch (err) {
    console.error('verify-invite-email error:', err);
    return json({ ok: false, code: 'error' }, 500);
  }
});
