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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { token, redirectOrigin } = await req.json();
    if (!token || typeof token !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Validate + bump access count via SECURITY DEFINER RPC
    const { data: rows, error: rpcError } = await admin.rpc('record_invitation_access', {
      _token: token,
    });
    if (rpcError) {
      console.error('record_invitation_access failed:', rpcError);
      return new Response(JSON.stringify({ error: 'Lookup failed', code: 'lookup_failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const invite = Array.isArray(rows) ? rows[0] : rows;
    if (!invite) {
      return new Response(JSON.stringify({ error: 'Invalid invitation', code: 'invalid' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Invitation expired', code: 'expired' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const email: string = invite.email;

    // 2. Ensure auth user exists for invited email
    // Try to find existing user by listing (small page) — fall back to create.
    let userExists = false;
    try {
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      userExists = !!list?.users?.find(
        (u) => (u.email || '').toLowerCase() === email.toLowerCase()
      );
    } catch (e) {
      console.warn('listUsers failed, will attempt create:', e);
    }

    if (!userExists) {
      const { error: createErr } = await admin.auth.admin.createUser({
        email,
        password: randomPassword(),
        email_confirm: true,
        user_metadata: { invited_via: 'vendor_invitation', invitation_id: invite.id },
      });
      if (createErr && !`${createErr.message}`.toLowerCase().includes('already')) {
        console.error('createUser failed:', createErr);
        return new Response(
          JSON.stringify({ error: 'Could not provision account', code: 'provision_failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 3. Generate a magic link that auto-signs the vendor in
    const origin = (redirectOrigin || '').replace(/\/$/, '');
    const redirectTo = origin
      ? `${origin}/vendor/registration?token=${encodeURIComponent(token)}`
      : undefined;

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: redirectTo ? { redirectTo } : undefined,
    });

    if (linkErr || !linkData?.properties?.action_link) {
      console.error('generateLink failed:', linkErr);
      return new Response(
        JSON.stringify({ error: 'Could not create sign-in link', code: 'link_failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize action_link for self-hosted reverse-proxy setups.
    // GoTrue builds links from SITE_URL / API_EXTERNAL_URL, which may point at
    // an internal host (e.g. http://10.200.1.7) even though the vendor is
    // browsing on a public URL. Rewrite both the action link's origin and the
    // embedded `redirect_to` query parameter to the caller's origin, and
    // prefix `/supabase` in front of `/auth/v1/...` so Nginx routes to Kong.
    const rawActionLink = linkData.properties.action_link as string;
    let actionLink = rawActionLink;
    try {
      const actionUrl = new URL(rawActionLink);
      const originUrl = redirectOrigin ? new URL(redirectOrigin) : null;
      if (originUrl) {
        actionUrl.protocol = originUrl.protocol;
        actionUrl.host = originUrl.host; // includes port
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
          } catch {
            // leave redirect_to as-is if unparseable
          }
        }
        actionLink = actionUrl.toString();
      }
    } catch (e) {
      console.warn('action_link normalization failed:', e);
    }

    // Also expose the OTP token_hash so the client can verify via the SDK
    // (avoids browser-level hits to /auth/v1/verify which may not be
    // proxied through Nginx on self-hosted deployments).
    let tokenHash: string | null = null;
    let otpType: string | null = null;
    try {
      const raw = new URL(linkData.properties.action_link as string);
      tokenHash = raw.searchParams.get('token');
      otpType = raw.searchParams.get('type');
    } catch (e) {
      console.warn('action_link token extraction failed:', e);
    }

    return new Response(
      JSON.stringify({
        action_link: actionLink,
        token_hash: tokenHash,
        otp_type: otpType,
        email,
        invitation_id: invite.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('accept-vendor-invite error:', err);
    return new Response(JSON.stringify({ error: 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
