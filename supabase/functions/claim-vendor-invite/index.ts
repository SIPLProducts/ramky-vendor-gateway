import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

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
    const { token, attempt } = await req.json().catch(() => ({}));
    if (!token || typeof token !== 'string') {
      return json(400, { status: 'invalid', code: 'missing_token', message: 'Missing token' });
    }

    if (looksLikePrefetch(req, Number(attempt) || 1)) {
      console.log('claim: prefetch suspected, deferring');
      return json(200, { status: 'pending', code: 'prefetch_suspected', message: 'Mail scanner prefetch suspected' });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return json(500, {
        status: 'error',
        code: 'env_missing',
        message: `Missing env: ${[
          !supabaseUrl && 'SUPABASE_URL',
          !serviceRoleKey && 'SUPABASE_SERVICE_ROLE_KEY',
          !anonKey && 'SUPABASE_ANON_KEY',
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
      .select('id, email, expires_at, used_at, user_id, vendor_id')
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
    const invitePassword = `${token}:${invite.id}`;

    if (invite.used_at) {
      if (
        callerUserId &&
        (
          (invite.user_id && callerUserId === invite.user_id) ||
          (callerEmail && callerEmail === invitedEmail)
        )
      ) {
        return json(200, {
          status: 'already_claimed_same_user',
          redirect: `/vendor/registration?token=${encodeURIComponent(token)}`,
          vendor_id: invite.vendor_id,
        });
      }

      // Re-open: sign the originally invited user back in.
      const targetUserId = invite.user_id || await findUserByEmail(admin, invitedEmail);
      if (targetUserId) {
        try {
          await admin.auth.admin.updateUserById(targetUserId, {
            password: invitePassword,
            email_confirm: true,
            user_metadata: { invited_via: 'vendor_invitation', invitation_id: invite.id },
          });
        } catch (e) {
          console.warn('reopen update user failed:', e);
        }

        const { data: signInData, error: signInErr } = await createClient(supabaseUrl, anonKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        }).auth.signInWithPassword({ email: invitedEmail, password: invitePassword });

        if (!signInErr && signInData?.session) {
          try {
            await admin.from('invitation_email_events').insert({
              invitation_id: invite.id,
              email_id: null,
              event_type: 'reopen',
              event_data: { caller_email: callerEmail, caller_user_id: callerUserId },
            });
          } catch { /* ignore */ }

          return json(200, {
            status: 'claimed',
            session: signInData.session,
            redirect: `/vendor/registration?token=${encodeURIComponent(token)}`,
            vendor_id: invite.vendor_id,
          });
        }
        console.warn('reopen sign-in failed:', signInErr);
      }

      try {
        await admin.from('invitation_email_events').insert({
          invitation_id: invite.id,
          email_id: null,
          event_type: 'reuse_attempt',
          event_data: { used_at: invite.used_at, caller_email: callerEmail, caller_user_id: callerUserId },
        });
      } catch { /* ignore */ }
      return json(403, { status: 'denied', code: 'already_used', message: 'Invitation already opened' });
    }

    // First-click claim
    let authUserId = await findUserByEmail(admin, invitedEmail);
    console.log('claim: user resolved (existing?)', !!authUserId);

    if (!authUserId) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: invitedEmail,
        password: invitePassword,
        email_confirm: true,
        user_metadata: { invited_via: 'vendor_invitation', invitation_id: invite.id },
      });
      if (createErr && !`${createErr.message}`.toLowerCase().includes('already')) {
        console.error('createUser failed:', createErr);
        return json(500, { status: 'error', code: 'provision_failed', message: createErr.message });
      }
      if (created?.user) {
        authUserId = created.user.id;
      } else {
        authUserId = await findUserByEmail(admin, invitedEmail);
      }
    }

    if (!authUserId) {
      return json(500, { status: 'error', code: 'provision_failed', message: 'Could not provision auth user' });
    }

    try {
      await admin.auth.admin.updateUserById(authUserId, {
        password: invitePassword,
        email_confirm: true,
        user_metadata: { invited_via: 'vendor_invitation', invitation_id: invite.id },
      });
    } catch (e) {
      console.warn('update invited auth user failed:', e);
    }

    const { data: claimRow, error: claimErr } = await admin
      .from('vendor_invitations')
      .update({ used_at: new Date().toISOString(), user_id: authUserId })
      .eq('id', invite.id)
      .is('used_at', null)
      .select('id')
      .maybeSingle();

    if (claimErr) {
      console.error('claim update failed:', claimErr);
      return json(500, { status: 'error', code: 'claim_failed', message: claimErr.message });
    }
    if (!claimRow) {
      return json(403, { status: 'denied', code: 'already_used', message: 'Invitation was claimed concurrently' });
    }
    console.log('claim: stamped used_at');

    // Sign in (retry once with password reset if it fails)
    const anon = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    let { data: signInData, error: signInErr } = await anon.auth.signInWithPassword({
      email: invitedEmail,
      password: invitePassword,
    });

    if (signInErr || !signInData?.session) {
      console.warn('signin failed, retrying after password reset:', signInErr?.message);
      try {
        await admin.auth.admin.updateUserById(authUserId, {
          password: invitePassword,
          email_confirm: true,
        });
      } catch (e) {
        console.warn('retry password reset failed:', e);
      }
      ({ data: signInData, error: signInErr } = await anon.auth.signInWithPassword({
        email: invitedEmail,
        password: invitePassword,
      }));
    }

    if (signInErr || !signInData?.session) {
      console.error('invite password sign-in failed:', signInErr);
      return json(isAuthError(signInErr) ? 403 : 500, {
        status: 'error',
        code: 'signin_failed',
        message: signInErr?.message || 'Sign-in failed',
      });
    }
    console.log('claim: signin ok');

    try {
      await admin.from('invitation_email_events').insert({
        invitation_id: invite.id,
        email_id: null,
        event_type: 'claimed',
        event_data: { user_id: authUserId },
      });
    } catch { /* ignore */ }

    return json(200, {
      status: 'claimed',
      session: signInData.session,
      redirect: `/vendor/registration?token=${encodeURIComponent(token)}`,
      vendor_id: invite.vendor_id,
    });
  } catch (err) {
    console.error('claim-vendor-invite error:', err);
    return json(500, {
      status: 'error',
      code: 'unknown',
      message: (err as Error)?.message || String(err),
    });
  }
});
