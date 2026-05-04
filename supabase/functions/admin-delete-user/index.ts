import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: ' + (userErr?.message ?? 'no user') }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const callerId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: roleRows, error: roleErr } = await admin
      .from('user_roles').select('role').eq('user_id', callerId);
    if (roleErr) throw roleErr;
    const callerRoles = (roleRows ?? []).map((r) => r.role);
    if (!callerRoles.includes('admin') && !callerRoles.includes('sharvi_admin')) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const user_id: string | undefined = body?.user_id;
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (user_id === callerId) {
      return new Response(JSON.stringify({ error: 'You cannot delete your own account' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Capture email for audit
    const { data: profile } = await admin.from('profiles').select('email').eq('id', user_id).maybeSingle();
    const targetEmail = profile?.email ?? null;

    // Cleanup app-side rows first
    await admin.from('user_custom_roles').delete().eq('user_id', user_id);
    await admin.from('user_tenants').delete().eq('user_id', user_id);
    await admin.from('user_roles').delete().eq('user_id', user_id);
    await admin.from('profiles').delete().eq('id', user_id);

    // Delete auth user
    const { error: delAuthErr } = await admin.auth.admin.deleteUser(user_id);
    if (delAuthErr) {
      return new Response(JSON.stringify({ error: delAuthErr.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await admin.from('audit_logs').insert({
      action: 'user_deleted',
      user_id: callerId,
      details: { target_user_id: user_id, target_email: targetEmail },
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('admin-delete-user error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
