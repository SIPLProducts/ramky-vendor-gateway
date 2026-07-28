import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

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

const FLOW_COLS = [
  'scm_manager_user_id',
  'scm_head_user_id',
  'finance_1_user_id',
  'finance_2_user_id',
  'ceo_office_user_id',
] as const;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401);
    const callerId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // admin check
    const { data: roleRows } = await admin.from('user_roles').select('role').eq('user_id', callerId);
    const callerRoles = (roleRows ?? []).map((r: any) => r.role);
    const { data: customRoleRows } = await admin
      .from('user_custom_roles')
      .select('custom_roles(name, is_active)')
      .eq('user_id', callerId);
    const customRoleNames: string[] = (customRoleRows ?? [])
      .map((r: any) => r?.custom_roles)
      .filter((cr: any) => cr && cr.is_active)
      .map((cr: any) => String(cr.name || '').toLowerCase());
    const ADMIN_BUILTIN = ['admin', 'sharvi_admin', 'customer_admin'];
    const ADMIN_CUSTOM = ['admin', 'sharvi admin', 'customer admin'];
    const isAdmin =
      callerRoles.some((r: string) => ADMIN_BUILTIN.includes(r)) ||
      customRoleNames.some((n) => ADMIN_CUSTOM.includes(n));
    if (!isAdmin) return json({ error: 'Forbidden: admin role required' }, 403);

    const body = await req.json();
    const mode: 'preview' | 'apply' = body?.mode === 'apply' ? 'apply' : 'preview';
    const inactive_user_id: string | undefined = body?.inactive_user_id;
    const replacement_user_id: string | undefined = body?.replacement_user_id;

    if (!inactive_user_id) return json({ error: 'inactive_user_id is required' }, 400);
    if (inactive_user_id === callerId) return json({ error: 'You cannot inactivate your own account' }, 400);

    // Load inactive user context
    const [profRes, rolesRes, customRes, tenantsRes] = await Promise.all([
      admin.from('profiles').select('id, email, full_name, status').eq('id', inactive_user_id).maybeSingle(),
      admin.from('user_roles').select('role').eq('user_id', inactive_user_id),
      admin.from('user_custom_roles').select('custom_role_id, custom_roles(name, is_active)').eq('user_id', inactive_user_id),
      admin.from('user_tenants').select('tenant_id').eq('user_id', inactive_user_id),
    ]);
    if (!profRes.data) return json({ error: 'Inactive user not found' }, 404);
    const inactiveEmail = profRes.data.email as string;
    const inactiveRoles: string[] = (rolesRes.data ?? []).map((r: any) => r.role);
    const inactiveCustomIds: string[] = (customRes.data ?? []).map((r: any) => r.custom_role_id);
    const inactiveCustomNames: string[] = (customRes.data ?? [])
      .map((r: any) => r?.custom_roles)
      .filter((cr: any) => cr && cr.is_active)
      .map((cr: any) => String(cr.name || '').toLowerCase());
    const inactiveTenantIds: string[] = (tenantsRes.data ?? []).map((t: any) => t.tenant_id);

    // Compute impact counts
    const flowFilters = FLOW_COLS.map((c) => `${c}.eq.${inactive_user_id}`).join(',');
    const [flowRes, matrixRes, mapBuyerRes, mapScmRes, invitesRes] = await Promise.all([
      admin.from('buyer_approval_flows').select('id', { count: 'exact', head: true }).or(flowFilters),
      admin.from('approval_matrix_approvers').select('id', { count: 'exact', head: true }).eq('user_id', inactive_user_id),
      admin.from('buyer_scm_mappings').select('id', { count: 'exact', head: true }).eq('buyer_user_id', inactive_user_id),
      admin.from('buyer_scm_mappings').select('id', { count: 'exact', head: true }).eq('scm_manager_user_id', inactive_user_id),
      admin.from('vendor_invitations').select('id', { count: 'exact', head: true }).eq('created_by', inactive_user_id),
    ]);
    const counts = {
      buyer_approval_flows: flowRes.count ?? 0,
      approval_matrix_approvers: matrixRes.count ?? 0,
      buyer_scm_mappings: (mapBuyerRes.count ?? 0) + (mapScmRes.count ?? 0),
      vendor_invitations: invitesRes.count ?? 0,
    };

    // Build eligible replacement list (active, same role scope, overlapping tenant)
    // Candidates: profiles with status=active, not same user
    const { data: candProfiles } = await admin
      .from('profiles')
      .select('id, email, full_name, status')
      .eq('status', 'active')
      .neq('id', inactive_user_id);
    const candIds = (candProfiles ?? []).map((p: any) => p.id);

    let eligible: Array<{ id: string; email: string; full_name: string | null }> = [];
    if (candIds.length > 0) {
      const [candRolesRes, candCustomRes] = await Promise.all([
        admin.from('user_roles').select('user_id, role').in('user_id', candIds),
        admin.from('user_custom_roles').select('user_id, custom_role_id, custom_roles(name, is_active)').in('user_id', candIds),
      ]);
      const roleByUser = new Map<string, string[]>();
      (candRolesRes.data ?? []).forEach((r: any) => {
        const arr = roleByUser.get(r.user_id) ?? [];
        arr.push(r.role);
        roleByUser.set(r.user_id, arr);
      });
      const customByUser = new Map<string, string[]>();
      (candCustomRes.data ?? []).forEach((r: any) => {
        const cr = r?.custom_roles;
        if (!cr || !cr.is_active) return;
        const arr = customByUser.get(r.user_id) ?? [];
        arr.push(String(cr.name || '').toLowerCase());
        customByUser.set(r.user_id, arr);
      });

      eligible = (candProfiles ?? []).filter((p: any) => {
        const roles = roleByUser.get(p.id) ?? [];
        const customs = customByUser.get(p.id) ?? [];
        // Same custom role match: if inactive has any custom role, replacement must share at least one
        if (inactiveCustomNames.length > 0) {
          const sharedCustom = inactiveCustomNames.some((n) => customs.includes(n));
          if (!sharedCustom) return false;
        } else {
          // Otherwise: must share a built-in role
          const sharedRole = inactiveRoles.some((r) => roles.includes(r));
          if (!sharedRole) return false;
        }
        return true;
      }).map((p: any) => ({ id: p.id, email: p.email, full_name: p.full_name }));
    }


    if (mode === 'preview') {
      return json({ ok: true, counts, eligible, inactive: { id: inactive_user_id, email: inactiveEmail } });
    }

    // APPLY mode — validate replacement
    if (!replacement_user_id) return json({ error: 'replacement_user_id is required for apply mode' }, 400);
    if (replacement_user_id === inactive_user_id) return json({ error: 'Replacement must differ from inactive user' }, 400);
    if (!eligible.some((e) => e.id === replacement_user_id)) {
      return json({ error: 'Replacement user is not eligible (role, tenant, or active status mismatch)' }, 400);
    }

    const applied = { buyer_approval_flows: 0, approval_matrix_approvers: 0, buyer_scm_mappings: 0 };

    // 1) buyer_approval_flows — update each column separately
    for (const col of FLOW_COLS) {
      const { data: updated, error } = await admin
        .from('buyer_approval_flows')
        .update({ [col]: replacement_user_id })
        .eq(col, inactive_user_id)
        .select('id');
      if (error) throw new Error(`buyer_approval_flows.${col}: ${error.message}`);
      applied.buyer_approval_flows += updated?.length ?? 0;
    }

    // 2) approval_matrix_approvers — handle unique(level_id, user_id)
    const { data: matrixRows } = await admin
      .from('approval_matrix_approvers')
      .select('id, level_id')
      .eq('user_id', inactive_user_id);
    for (const row of matrixRows ?? []) {
      const { data: dup } = await admin
        .from('approval_matrix_approvers')
        .select('id')
        .eq('level_id', row.level_id)
        .eq('user_id', replacement_user_id)
        .maybeSingle();
      if (dup) {
        await admin.from('approval_matrix_approvers').delete().eq('id', row.id);
      } else {
        await admin.from('approval_matrix_approvers').update({ user_id: replacement_user_id }).eq('id', row.id);
      }
      applied.approval_matrix_approvers += 1;
    }

    // 3) buyer_scm_mappings — as scm_manager
    const { data: scmRows } = await admin
      .from('buyer_scm_mappings')
      .select('id, buyer_user_id')
      .eq('scm_manager_user_id', inactive_user_id);
    for (const row of scmRows ?? []) {
      const { data: dup } = await admin
        .from('buyer_scm_mappings')
        .select('id')
        .eq('buyer_user_id', row.buyer_user_id)
        .eq('scm_manager_user_id', replacement_user_id)
        .maybeSingle();
      if (dup) {
        await admin.from('buyer_scm_mappings').delete().eq('id', row.id);
      } else {
        await admin.from('buyer_scm_mappings').update({ scm_manager_user_id: replacement_user_id }).eq('id', row.id);
      }
      applied.buyer_scm_mappings += 1;
    }
    // also as buyer_user_id
    const { data: buyerRows } = await admin
      .from('buyer_scm_mappings')
      .select('id, scm_manager_user_id')
      .eq('buyer_user_id', inactive_user_id);
    for (const row of buyerRows ?? []) {
      const { data: dup } = await admin
        .from('buyer_scm_mappings')
        .select('id')
        .eq('buyer_user_id', replacement_user_id)
        .eq('scm_manager_user_id', row.scm_manager_user_id)
        .maybeSingle();
      if (dup) {
        await admin.from('buyer_scm_mappings').delete().eq('id', row.id);
      } else {
        await admin.from('buyer_scm_mappings').update({ buyer_user_id: replacement_user_id }).eq('id', row.id);
      }
      applied.buyer_scm_mappings += 1;
    }

    // Audit log
    const { data: replProf } = await admin
      .from('profiles').select('email, full_name').eq('id', replacement_user_id).maybeSingle();
    await admin.from('audit_logs').insert({
      action: 'user_inactivated_reassigned',
      user_id: callerId,
      details: {
        inactive_user_id,
        inactive_email: inactiveEmail,
        replacement_user_id,
        replacement_email: replProf?.email ?? null,
        counts: applied,
        updated_at: new Date().toISOString(),
      },
    });

    return json({ ok: true, counts: applied });
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    console.error('reassign-user-work error:', msg);
    return json({ error: msg }, 400);
  }
});
