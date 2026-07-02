import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { email, user_id, attempt_status } = await req.json();
    if (!email || !attempt_status) {
      return new Response(JSON.stringify({ error: 'email and attempt_status required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!['success', 'inactive_user', 'invalid_credentials'].includes(attempt_status)) {
      return new Response(JSON.stringify({ error: 'invalid attempt_status' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? null;
    const ua = req.headers.get('user-agent') ?? null;

    await admin.from('login_attempts').insert({
      email, user_id: user_id ?? null, attempt_status, ip, user_agent: ua,
    });

    if (user_id) {
      await admin.from('profiles').update({ last_login_attempt_at: new Date().toISOString() }).eq('id', user_id);
    } else {
      // best-effort by email
      await admin.from('profiles').update({ last_login_attempt_at: new Date().toISOString() }).ilike('email', email);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('log-login-attempt error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
