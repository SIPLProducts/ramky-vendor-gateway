import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  const visible = local.slice(0, Math.min(2, local.length));
  const stars = '*'.repeat(Math.max(1, local.length - visible.length));
  const [dName, ...dRest] = domain.split('.');
  const dVisible = dName.slice(0, 1);
  const dStars = '*'.repeat(Math.max(1, dName.length - 1));
  return `${visible}${stars}@${dVisible}${dStars}${dRest.length ? '.' + dRest.join('.') : ''}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();
    if (!token || typeof token !== 'string') {
      return new Response(JSON.stringify({ code: 'invalid' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data, error } = await admin
      .from('vendor_invitations')
      .select('email, expires_at, used_at')
      .eq('token', token)
      .maybeSingle();

    if (error || !data) {
      return new Response(JSON.stringify({ code: 'invalid' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const expired = data.expires_at && new Date(data.expires_at) < new Date();

    return new Response(
      JSON.stringify({
        masked_email: maskEmail(data.email),
        expires_at: data.expires_at,
        used: !!data.used_at,
        expired: !!expired,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('get-invitation-summary error:', err);
    return new Response(JSON.stringify({ code: 'error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
