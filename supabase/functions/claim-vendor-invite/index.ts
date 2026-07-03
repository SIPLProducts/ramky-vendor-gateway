import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function randomPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('') + 'Aa1!';
}

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

function normalizeActionLink(rawActionLink: string, redirectOrigin?: string): string {
  if (!redirectOrigin) return rawActionLink;
  try {
    const actionUrl = new URL(rawActionLink);
    const originUrl = new URL(redirectOrigin);
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
      } catch { /* keep as-is */ }
    }
    return actionUrl.toString();
  } catch {
    return rawActionLink;
  }
}

const PREFETCH_UA_RE =
  /(bot|crawler|spider|preview|scanner|linkcheck|fetch|slurp|mimecast|proofpoint|barracuda|forcepoint|symantec|urldefense|safelinks|outlook|microsoft-safelinks)/i;

function looksLikePrefetch(req: Request, attempt: number): boolean {
  // Real browser retries from VendorInviteAccept bump `attempt` past 1, so we
  // only block the very first "scanner-style" hit and let the actual click through.
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
  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Never claim on non-POST requests (GET/HEAD prefetches from mail scanners).
  if (req.method !== 'POST') {
    return json(405, { status: 'pending', code: 'method_not_allowed' });
  }

  try {
    const { token, redirectOrigin, attempt } = await req.json();
    if (!token || typeof token !== 'string') {
      return json(400, { status: 'invalid', error: 'Missing token' });
    }

    if (looksLikePrefetch(req, Number(attempt) || 1)) {
      return json(200, { status: 'pending', code: 'prefetch_suspected' });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Optional: caller may already be signed in (return-to-vendor re-open scenario)
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

    // 1. Look up invitation
    const { data: invite, error: lookupErr } = await admin
      .from('vendor_invitations')
      .select('id, email, expires_at, used_at, user_id, vendor_id')
      .eq('token', token)
      .maybeSingle();

    if (lookupErr) {
      console.error('invitation lookup failed:', lookupErr);
      return json(500, { status: 'error', code: 'lookup_failed' });
    }
    if (!invite) {
      return json(404, { status: 'invalid', code: 'invalid' });
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return json(410, { status: 'expired', code: 'expired' });
    }

    const invitedEmail = String(invite.email || '').toLowerCase();

    // 2. Already claimed?
    if (invite.used_at) {
      // Allow the original vendor to reopen if their existing session matches
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

      // If the first click already provisioned the invited auth user but the browser
      // never completed the magic-link redirect, let the invited mailbox open the
      // same invite again. A forwarded/copy user still won't have the password.
      if (invite.user_id && !invite.vendor_id) {
        const { data: userRecord } = await admin.auth.admin.getUserById(invite.user_id);
        const claimedEmail = (userRecord?.user?.email || '').toLowerCase();
        if (claimedEmail === invitedEmail) {
          try {
            await admin.auth.admin.updateUserById(invite.user_id, {
              password: `${token}:${invite.id}`,
              email_confirm: true,
              user_metadata: { invited_via: 'vendor_invitation', invitation_id: invite.id },
            });
          } catch (e) {
            console.warn('repair invited auth user failed:', e);
          }

          const { data: signInData, error: signInErr } = await createClient(supabaseUrl, anonKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          }).auth.signInWithPassword({
            email: invitedEmail,
            password: `${token}:${invite.id}`,
          });

          if (!signInErr && signInData?.session) {
            return json(200, {
              status: 'claimed',
              session: signInData.session,
              redirect: `/vendor/registration?token=${encodeURIComponent(token)}`,
              vendor_id: invite.vendor_id,
            });
          }
        }
      }
      // Anyone else (re-click, forwarded, copied) is denied
      try {
        await admin.from('invitation_email_events').insert({
          invitation_id: invite.id,
          email_id: null,
          event_type: 'reuse_attempt',
          event_data: {
            used_at: invite.used_at,
            caller_email: callerEmail,
            caller_user_id: callerUserId,
          },
        });
      } catch { /* ignore */ }
      return json(403, { status: 'denied', code: 'already_used' });
    }

    // 3. First-click claim: ensure auth user exists for invitedEmail
    let authUserId: string | null = null;
    const invitePassword = `${token}:${invite.id}`;
    try {
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const found = list?.users?.find(
        (u) => (u.email || '').toLowerCase() === invitedEmail,
      );
      if (found) authUserId = found.id;
    } catch (e) {
      console.warn('listUsers failed:', e);
    }

    if (!authUserId) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: invitedEmail,
        password: invitePassword,
        email_confirm: true,
        user_metadata: { invited_via: 'vendor_invitation', invitation_id: invite.id },
      });
      if (createErr && !`${createErr.message}`.toLowerCase().includes('already')) {
        console.error('createUser failed:', createErr);
        return json(500, { status: 'error', code: 'provision_failed' });
      }
      if (created?.user) {
        authUserId = created.user.id;
      } else {
        // race: re-list
        try {
          const { data: list2 } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
          const f2 = list2?.users?.find((u) => (u.email || '').toLowerCase() === invitedEmail);
          if (f2) authUserId = f2.id;
        } catch { /* ignore */ }
      }
    }

    if (!authUserId) {
      return json(500, { status: 'error', code: 'provision_failed' });
    }

    // Ensure re-entry works for an existing auth user too.
    try {
      await admin.auth.admin.updateUserById(authUserId, {
        password: invitePassword,
        email_confirm: true,
        user_metadata: { invited_via: 'vendor_invitation', invitation_id: invite.id },
      });
    } catch (e) {
      console.warn('update invited auth user failed:', e);
    }

    // 4. Stamp used_at + user_id (atomic — only if still unclaimed)
    const { data: claimRow, error: claimErr } = await admin
      .from('vendor_invitations')
      .update({ used_at: new Date().toISOString(), user_id: authUserId })
      .eq('id', invite.id)
      .is('used_at', null)
      .select('id')
      .maybeSingle();

    if (claimErr) {
      console.error('claim update failed:', claimErr);
      return json(500, { status: 'error', code: 'claim_failed' });
    }
    if (!claimRow) {
      // Someone else claimed in the meantime
      return json(403, { status: 'denied', code: 'already_used' });
    }

    // 5. One-click sign-in without sending another email.
    const { data: signInData, error: signInErr } = await createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }).auth.signInWithPassword({ email: invitedEmail, password: invitePassword });

    if (signInErr || !signInData?.session) {
      console.error('invite password sign-in failed:', signInErr);
      return json(isAuthError(signInErr) ? 403 : 500, { status: 'error', code: 'signin_failed' });
    }

    // Log successful claim
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
    return json(500, { status: 'error', code: 'unknown' });
  }
});
