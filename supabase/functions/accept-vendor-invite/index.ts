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

    return new Response(
      JSON.stringify({
        action_link: linkData.properties.action_link,
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
