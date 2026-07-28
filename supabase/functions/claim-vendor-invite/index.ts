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

function randomPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('') + 'Aa1!';
}

const PREFETCH_UA_RE =
  /(bot|crawler|spider|preview|scanner|linkcheck|slurp|mimecast|proofpoint|barracuda|forcepoint|symantec|urldefense|safelinks|microsoft-safelinks)/i;

function looksLikePrefetch(req: Request, attempt: number): boolean {
  if (attempt > 1) return false;
  const ua = req.headers.get('user-agent') || '';
  if (PREFETCH_UA_RE.test(ua)) return true;
  const purpose = (req.headers.get('purpose') || req.headers.get('sec-purpose') || '').toLowerCase();
  if (purpose.includes('prefetch')) return true;
  return false;
}

async function findUserByEmail(admin: ReturnType<typeof createClient>, email: string): Promise<string | null> {
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    try {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) return null;
      const users = data?.users || [];
      const found = users.find((u: any) => (u.email || '').toLowerCase() === target);
      if (found) return found.id;
      if (users.length < 200) return null;
    } catch {
      return null;
    }
  }
  return null;
}

async function ensureVendorAccount(admin: ReturnType<typeof createClient>, userId: string, email: string): Promise<void> {
  const { data: profileRow } = await admin
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (!profileRow) {
    await admin
      .from('profiles')
      .insert({ id: userId, email, full_name: null, status: 'active' });
  }

  const { data: roleRow } = await admin
    .from('user_roles')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'vendor')
    .maybeSingle();

  if (!roleRow) {
    await admin
      .from('user_roles')
      .insert({ user_id: userId, role: 'vendor' });
  }
}

async function ensureAuthUser(admin: ReturnType<typeof createClient>, email: string, inviteId: string): Promise<string> {
  const existing = await findUserByEmail(admin, email);
  if (existing) {
    await ensureVendorAccount(admin, existing, email);
    return existing;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: randomPassword(),
    email_confirm: true,
    user_metadata: { invited_via: 'vendor_invitation', invitation_id: inviteId },
  });
  if (error && !`${error.message}`.toLowerCase().includes('already')) {
    throw new Error(error.message);
  }
  const userId = data?.user?.id || await findUserByEmail(admin, email);
  if (!userId) throw new Error('Unable to create or locate invited user');
  await ensureVendorAccount(admin, userId, email);
  return userId;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return json(200, { ok: true, time: new Date().toISOString() });
  }

  if (req.method !== 'POST') {
    return json(405, { status: 'error', code: 'method_not_allowed' });
  }

  try {
    const { token, attempt, redirectOrigin } = await req.json().catch(() => ({}));
    if (!token || typeof token !== 'string') {
      return json(400, { status: 'invalid', code: 'missing_token', message: 'Missing token' });
    }

    if (looksLikePrefetch(req, Number(attempt) || 1)) {
      return json(200, { status: 'pending', code: 'prefetch_suspected', message: 'Mail scanner prefetch suspected' });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return json(500, { status: 'error', code: 'env_missing', message: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check caller session (if any)
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
      .select('id, email, expires_at, used_at, user_id, vendor_id, tenant_id')
      .eq('token', token)
      .maybeSingle();

    if (lookupErr) {
      return json(500, { status: 'error', code: 'lookup_failed', message: lookupErr.message });
    }
    if (!invite) {
      return json(404, { status: 'invalid', code: 'invalid', message: 'Invitation not found for token' });
    }
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return json(410, { status: 'expired', code: 'expired', message: 'Invitation expired' });
    }

    const invitedEmail = String(invite.email || '').toLowerCase();
    const redirectPath = `/vendor/registration?token=${encodeURIComponent(token)}`;

    // Case A: caller is already signed in
    if (callerUserId && callerEmail) {
      if (callerEmail !== invitedEmail) {
        return json(403, { status: 'denied', code: 'email_mismatch', message: 'This invitation belongs to a different email address' });
      }
      // Bind invitation to this user (best-effort, idempotent) and stamp
      // used_at so the Vendor Invitations screen flips from Pending to Used
      // as soon as the vendor lands on the registration form.
      {
        const patch: Record<string, unknown> = {};
        if (!invite.user_id) patch.user_id = callerUserId;
        if (!invite.used_at) patch.used_at = new Date().toISOString();
        if (Object.keys(patch).length > 0) {
          await admin
            .from('vendor_invitations')
            .update(patch)
            .eq('id', invite.id);
        }
      }
      await ensureVendorAccount(admin, callerUserId, invitedEmail);
      return json(200, {
        status: 'verified',
        redirect: redirectPath,
        vendor_id: invite.vendor_id,
      });
    }

    // Case B: no session — provision user and return a magic-link token_hash
    // so the client can sign the vendor in via verifyOtp() and land directly
    // on the registration form. NOTE: Forwarded-link protection is intentionally
    // deferred; possession of the token grants access.
    let invitedUserId: string;
    try {
      invitedUserId = await ensureAuthUser(admin, invitedEmail, invite.id);
    } catch (e) {
      return json(500, { status: 'error', code: 'provision_failed', message: (e as Error).message });
    }

    if (!invite.user_id) {
      await admin
        .from('vendor_invitations')
        .update({ user_id: invitedUserId })
        .eq('id', invite.id)
        .is('user_id', null);
    }

    const origin = String(redirectOrigin || '').replace(/\/+$/, '');
    const redirectTo = origin ? `${origin}${redirectPath}` : undefined;

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: invitedEmail,
      options: redirectTo ? { redirectTo } : undefined,
    });
    if (linkErr || !linkData?.properties?.action_link) {
      return json(500, { status: 'error', code: 'generate_link_failed', message: linkErr?.message || 'No action_link' });
    }

    let tokenHash: string | null = null;
    let otpType: string | null = null;
    const props = linkData.properties as Record<string, unknown>;

    // verifyOtp({ token_hash }) expects GoTrue's hashed token. The action_link
    // also contains a short-lived raw token in some deployments; using that raw
    // URL token causes intermittent `otp_expired` / `invalid` failures on the
    // self-hosted auth endpoint. Prefer the official hashed_token returned by
    // generateLink and only fall back to URL parsing for older auth versions.
    tokenHash = typeof props.hashed_token === 'string' ? props.hashed_token : null;
    otpType = typeof props.verification_type === 'string' ? props.verification_type : null;
    if (!tokenHash) {
      try {
        const raw = new URL(linkData.properties.action_link as string);
        tokenHash = raw.searchParams.get('token_hash') || raw.searchParams.get('token');
        otpType = otpType || raw.searchParams.get('type');
      } catch { /* ignore */ }
    }

    if (!tokenHash) {
      return json(500, { status: 'error', code: 'token_hash_missing', message: 'Could not extract token_hash from action_link' });
    }

    return json(200, {
      status: 'signin_ready',
      token_hash: tokenHash,
      otp_type: otpType || 'magiclink',
      email: invitedEmail,
      redirect: redirectPath,
      vendor_id: invite.vendor_id,
    });
  } catch (err) {
    return json(500, { status: 'error', code: 'unknown', message: (err as Error)?.message || String(err) });
  }
});
