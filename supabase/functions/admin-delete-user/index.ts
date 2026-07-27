import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, _status = 200) {
  // Always return 200 so supabase.functions.invoke surfaces our structured
  // { ok:false, error, step } body to the UI instead of a generic
  // "Edge Function returned a non-2xx status code" message.
  return new Response(JSON.stringify(body), {
    status: 200,
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

  let currentStep = 'init';
  const log = (step: string, extra: Record<string, unknown> = {}) => {
    currentStep = step;
    console.log(JSON.stringify({ fn: 'admin-delete-user', step, ...extra }));
  };

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'Unauthorized' }, 401);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    log('verify_caller');
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonResponse({ error: 'Unauthorized: ' + (userErr?.message ?? 'no user') }, 401);
    }
    const callerId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    log('check_caller_role');
    const { data: roleRows, error: roleErr } = await admin
      .from('user_roles').select('role').eq('user_id', callerId);
    if (roleErr) throw roleErr;
    const callerRoles = (roleRows ?? []).map((r) => r.role);
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
      callerRoles.some((r) => ADMIN_BUILTIN.includes(r)) ||
      customRoleNames.some((n) => ADMIN_CUSTOM.includes(n));
    if (!isAdmin) {
      return jsonResponse({ error: 'Forbidden: admin role required' }, 403);
    }

    const body = await req.json();
    const user_id: string | undefined = body?.user_id;
    const replacement_user_id: string | undefined = body?.replacement_user_id;
    if (!user_id) return jsonResponse({ error: 'user_id is required' }, 400);
    if (user_id === callerId) return jsonResponse({ error: 'You cannot delete your own account' }, 400);
    if (replacement_user_id && replacement_user_id === user_id) {
      return jsonResponse({ error: 'Replacement must differ from user being deleted' }, 400);
    }

    log('lookup_target', { user_id });
    const { data: profile } = await admin.from('profiles').select('email').eq('id', user_id).maybeSingle();
    const targetEmail = profile?.email ?? null;

    // ----- Assess active workload for this user -----
    log('assess_workload');
    const flowFilters = FLOW_COLS.map((c) => `${c}.eq.${user_id}`).join(',');
    const [flowRes, matrixRes, mapBuyerRes, mapScmRes, pendingProgressRes] = await Promise.all([
      admin.from('buyer_approval_flows').select('id', { count: 'exact', head: true }).or(flowFilters),
      admin.from('approval_matrix_approvers').select('id', { count: 'exact', head: true }).eq('user_id', user_id),
      admin.from('buyer_scm_mappings').select('id', { count: 'exact', head: true }).eq('buyer_user_id', user_id),
      admin.from('buyer_scm_mappings').select('id', { count: 'exact', head: true }).eq('scm_manager_user_id', user_id),
      admin.from('vendor_approval_progress').select('id', { count: 'exact', head: true }).eq('acted_by', user_id).eq('status', 'pending'),
    ]);
    const workloadCounts = {
      buyer_approval_flows: flowRes.count ?? 0,
      approval_matrix_approvers: matrixRes.count ?? 0,
      buyer_scm_mappings: (mapBuyerRes.count ?? 0) + (mapScmRes.count ?? 0),
      vendor_approval_progress_pending: pendingProgressRes.count ?? 0,
    };
    const hasWorkload =
      workloadCounts.buyer_approval_flows +
      workloadCounts.approval_matrix_approvers +
      workloadCounts.buyer_scm_mappings +
      workloadCounts.vendor_approval_progress_pending > 0;

    if (hasWorkload && !replacement_user_id) {
      return jsonResponse({
        error: 'This user has active approval workload. Select a replacement user before deleting.',
        code: 'replacement_required',
        counts: workloadCounts,
      });
    }

    // ----- Validate replacement eligibility (same rule as reassign-user-work) -----
    const applied = { buyer_approval_flows: 0, approval_matrix_approvers: 0, buyer_scm_mappings: 0, vendor_approval_progress: 0 };

    if (replacement_user_id) {
      log('validate_replacement', { replacement_user_id });
      const [{ data: replProfile }, { data: replRoles }, { data: replCustom }] = await Promise.all([
        admin.from('profiles').select('id, email, status').eq('id', replacement_user_id).maybeSingle(),
        admin.from('user_roles').select('role').eq('user_id', replacement_user_id),
        admin.from('user_custom_roles').select('custom_roles(name, is_active)').eq('user_id', replacement_user_id),
      ]);
      if (!replProfile) {
        return jsonResponse({ error: 'Replacement user not found', code: 'replacement_invalid' });
      }
      if (replProfile.status && replProfile.status !== 'active') {
        return jsonResponse({ error: 'Replacement user is not active', code: 'replacement_invalid' });
      }

      const [{ data: targetRoles }, { data: targetCustom }] = await Promise.all([
        admin.from('user_roles').select('role').eq('user_id', user_id),
        admin.from('user_custom_roles').select('custom_roles(name, is_active)').eq('user_id', user_id),
      ]);
      const targetRoleList: string[] = (targetRoles ?? []).map((r: any) => r.role);
      const targetCustomNames: string[] = (targetCustom ?? [])
        .map((r: any) => r?.custom_roles).filter((c: any) => c && c.is_active)
        .map((c: any) => String(c.name || '').toLowerCase());
      const replRoleList: string[] = (replRoles ?? []).map((r: any) => r.role);
      const replCustomNames: string[] = (replCustom ?? [])
        .map((r: any) => r?.custom_roles).filter((c: any) => c && c.is_active)
        .map((c: any) => String(c.name || '').toLowerCase());

      let eligible = false;
      if (targetCustomNames.length > 0) {
        eligible = targetCustomNames.some((n) => replCustomNames.includes(n));
      } else {
        eligible = targetRoleList.some((r) => replRoleList.includes(r));
      }
      if (!eligible) {
        return jsonResponse({
          error: 'Replacement user does not share the same role as the user being deleted.',
          code: 'replacement_invalid',
        });
      }

      // ----- Reassign workload BEFORE destructive cleanup -----
      // 1) buyer_approval_flows
      for (const col of FLOW_COLS) {
        const { data: updated, error } = await admin
          .from('buyer_approval_flows')
          .update({ [col]: replacement_user_id })
          .eq(col, user_id)
          .select('id');
        if (error) throw new Error(`buyer_approval_flows.${col}: ${error.message}`);
        applied.buyer_approval_flows += updated?.length ?? 0;
      }

      // 2) approval_matrix_approvers with dedupe on (level_id, user_id)
      const { data: matrixRows } = await admin
        .from('approval_matrix_approvers').select('id, level_id').eq('user_id', user_id);
      for (const row of matrixRows ?? []) {
        const { data: dup } = await admin
          .from('approval_matrix_approvers').select('id')
          .eq('level_id', row.level_id).eq('user_id', replacement_user_id).maybeSingle();
        if (dup) {
          await admin.from('approval_matrix_approvers').delete().eq('id', row.id);
        } else {
          await admin.from('approval_matrix_approvers').update({ user_id: replacement_user_id }).eq('id', row.id);
        }
        applied.approval_matrix_approvers += 1;
      }

      // 3) buyer_scm_mappings — as scm_manager
      const { data: scmRows } = await admin
        .from('buyer_scm_mappings').select('id, buyer_user_id').eq('scm_manager_user_id', user_id);
      for (const row of scmRows ?? []) {
        const { data: dup } = await admin
          .from('buyer_scm_mappings').select('id')
          .eq('buyer_user_id', row.buyer_user_id)
          .eq('scm_manager_user_id', replacement_user_id).maybeSingle();
        if (dup) {
          await admin.from('buyer_scm_mappings').delete().eq('id', row.id);
        } else {
          await admin.from('buyer_scm_mappings').update({ scm_manager_user_id: replacement_user_id }).eq('id', row.id);
        }
        applied.buyer_scm_mappings += 1;
      }
      // as buyer
      const { data: buyerRows } = await admin
        .from('buyer_scm_mappings').select('id, scm_manager_user_id').eq('buyer_user_id', user_id);
      for (const row of buyerRows ?? []) {
        const { data: dup } = await admin
          .from('buyer_scm_mappings').select('id')
          .eq('buyer_user_id', replacement_user_id)
          .eq('scm_manager_user_id', row.scm_manager_user_id).maybeSingle();
        if (dup) {
          await admin.from('buyer_scm_mappings').delete().eq('id', row.id);
        } else {
          await admin.from('buyer_scm_mappings').update({ buyer_user_id: replacement_user_id }).eq('id', row.id);
        }
        applied.buyer_scm_mappings += 1;
      }

      // 4) vendor_approval_progress — reassign only in-flight pending rows already tagged to this user
      {
        const { data: updated, error } = await admin
          .from('vendor_approval_progress')
          .update({ acted_by: replacement_user_id })
          .eq('acted_by', user_id)
          .eq('status', 'pending')
          .select('id');
        if (error) throw new Error(`vendor_approval_progress: ${error.message}`);
        applied.vendor_approval_progress = updated?.length ?? 0;
      }
    }

    // Helper to run step + surface error
    const run = async (step: string, fn: () => Promise<{ error: any } | any>) => {
      log(step);
      const res: any = await fn();
      if (res?.error) {
        console.error(JSON.stringify({ fn: 'admin-delete-user', step, error: res.error.message ?? res.error }));
        throw new Error(`[${step}] ${res.error.message ?? res.error}`);
      }
      return res;
    };

    // 1. Find vendors owned by this user
    log('find_owned_vendors');
    const { data: ownedVendors, error: vErr } = await admin
      .from('vendors').select('id').eq('user_id', user_id);
    if (vErr) throw vErr;
    const vendorIds = (ownedVendors ?? []).map((v) => v.id);
    log('owned_vendors_found', { count: vendorIds.length });

    // 2. Nullify user_id in vendor_feedback (preserve feedback history)
    await run('vendor_feedback.nullify_user', () =>
      admin.from('vendor_feedback').update({ user_id: null }).eq('user_id', user_id)
    );

    // 3. For vendors being deleted, delete their feedback (FK has NO ACTION)
    if (vendorIds.length > 0) {
      await run('vendor_feedback.delete_for_owned_vendors', () =>
        admin.from('vendor_feedback').delete().in('vendor_id', vendorIds)
      );
    }

    // 4. Nullify reviewer references on vendors not owned by this user
    await run('vendors.nullify_finance_reviewer', () =>
      admin.from('vendors').update({ finance_reviewed_by: null }).eq('finance_reviewed_by', user_id)
    );
    await run('vendors.nullify_purchase_reviewer', () =>
      admin.from('vendors').update({ purchase_reviewed_by: null }).eq('purchase_reviewed_by', user_id)
    );

    // 5. Detach invitations created by this user
    await run('vendor_invitations.nullify_created_by', () =>
      admin.from('vendor_invitations').update({ created_by: null }).eq('created_by', user_id)
    );

    // 6. Detach portal_config.updated_by
    await run('portal_config.nullify_updated_by', () =>
      admin.from('portal_config').update({ updated_by: null }).eq('updated_by', user_id)
    );

    // 7. Detach audit_logs.user_id (preserve history)
    await run('audit_logs.nullify_user', () =>
      admin.from('audit_logs').update({ user_id: null }).eq('user_id', user_id)
    );

    // 8. Now delete vendors owned by user (cascades will handle child rows where defined)
    if (vendorIds.length > 0) {
      await run('vendors.delete_owned', () =>
        admin.from('vendors').delete().in('id', vendorIds)
      );
    }

    // 9. App-side role/tenant/profile cleanup (safety net — reassignment above should
    //    have already moved these rows when a replacement was provided).
    await run('buyer_scm_mappings.delete_as_buyer', () =>
      admin.from('buyer_scm_mappings').delete().eq('buyer_user_id', user_id)
    );
    await run('buyer_scm_mappings.delete_as_scm', () =>
      admin.from('buyer_scm_mappings').delete().eq('scm_manager_user_id', user_id)
    );
    await run('buyer_scm_mappings.nullify_created_by', () =>
      admin.from('buyer_scm_mappings').update({ created_by: null }).eq('created_by', user_id)
    );
    await run('approval_matrix_approvers.delete', () =>
      admin.from('approval_matrix_approvers').delete().eq('user_id', user_id)
    );
    await run('user_custom_roles.delete', () =>
      admin.from('user_custom_roles').delete().eq('user_id', user_id)
    );
    await run('user_tenants.delete', () =>
      admin.from('user_tenants').delete().eq('user_id', user_id)
    );
    await run('user_roles.delete', () =>
      admin.from('user_roles').delete().eq('user_id', user_id)
    );
    await run('profiles.delete', () =>
      admin.from('profiles').delete().eq('id', user_id)
    );

    // 10. Finally delete auth user
    log('auth.admin.deleteUser');
    const { error: delAuthErr } = await admin.auth.admin.deleteUser(user_id);
    if (delAuthErr) {
      console.error(JSON.stringify({ fn: 'admin-delete-user', step: 'auth.admin.deleteUser', error: delAuthErr.message }));
      return jsonResponse({
        error: `Failed to delete auth user: ${delAuthErr.message}. There may still be database rows referencing this user.`,
        step: 'auth.admin.deleteUser',
      }, 400);
    }

    log('audit_log_user_deleted');
    let replacementEmail: string | null = null;
    if (replacement_user_id) {
      const { data: rp } = await admin.from('profiles').select('email').eq('id', replacement_user_id).maybeSingle();
      replacementEmail = rp?.email ?? null;
    }
    await admin.from('audit_logs').insert({
      action: replacement_user_id ? 'user_deleted_with_reassignment' : 'user_deleted',
      user_id: callerId,
      details: {
        target_user_id: user_id,
        target_email: targetEmail,
        replacement_user_id: replacement_user_id ?? null,
        replacement_email: replacementEmail,
        reassigned_counts: applied,
      },
    });

    return jsonResponse({ ok: true, reassigned_counts: applied });
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    console.error(JSON.stringify({ fn: 'admin-delete-user', step: currentStep, error: msg }));
    return jsonResponse({ error: msg, step: currentStep }, 400);
  }
});
