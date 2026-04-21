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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify caller is admin / sharvi_admin
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const callerId = claimsData.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: roleRows, error: roleErr } = await admin
      .from('user_roles').select('role').eq('user_id', callerId);
    if (roleErr) throw roleErr;
    const callerRoles = (roleRows ?? []).map((r) => r.role);
    if (!callerRoles.includes('admin') && !callerRoles.includes('sharvi_admin')) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { email, password, full_name, role, tenant_ids, custom_role_ids } = body ?? {};
    if (!email || !password || !role) {
      return new Response(JSON.stringify({ error: 'email, password and role are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Create user (auto-confirm)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name ?? null },
    });
    if (createErr || !created.user) {
      return new Response(JSON.stringify({ error: createErr?.message ?? 'Failed to create user' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const newUserId = created.user.id;

    // Replace default role assigned by handle_new_user trigger
    await admin.from('user_roles').delete().eq('user_id', newUserId);
    const { error: roleInsErr } = await admin.from('user_roles').insert({ user_id: newUserId, role });
    if (roleInsErr) throw roleInsErr;

    // Tenants
    if (Array.isArray(tenant_ids) && tenant_ids.length > 0) {
      const rows = tenant_ids.map((tid: string, i: number) => ({
        user_id: newUserId, tenant_id: tid, is_default: i === 0,
      }));
      const { error: tErr } = await admin.from('user_tenants').insert(rows);
      if (tErr) throw tErr;
    }

    // Custom roles
    if (Array.isArray(custom_role_ids) && custom_role_ids.length > 0) {
      const rows = custom_role_ids.map((cid: string) => ({
        user_id: newUserId, custom_role_id: cid, assigned_by: callerId,
      }));
      const { error: cErr } = await admin.from('user_custom_roles').insert(rows);
      if (cErr) throw cErr;
    }

    // Audit log
    await admin.from('audit_logs').insert({
      action: 'user_created',
      user_id: callerId,
      details: { new_user_id: newUserId, email, role, tenant_ids: tenant_ids ?? [], custom_role_ids: custom_role_ids ?? [] },
    });

    return new Response(JSON.stringify({ user_id: newUserId, email }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('admin-create-user error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
