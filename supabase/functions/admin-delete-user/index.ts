import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

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
    if (!callerRoles.includes('admin') && !callerRoles.includes('sharvi_admin')) {
      return jsonResponse({ error: 'Forbidden: admin role required' }, 403);
    }

    const body = await req.json();
    const user_id: string | undefined = body?.user_id;
    if (!user_id) return jsonResponse({ error: 'user_id is required' }, 400);
    if (user_id === callerId) return jsonResponse({ error: 'You cannot delete your own account' }, 400);

    log('lookup_target', { user_id });
    const { data: profile } = await admin.from('profiles').select('email').eq('id', user_id).maybeSingle();
    const targetEmail = profile?.email ?? null;

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

    // 9. App-side role/tenant/profile cleanup
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
    await admin.from('audit_logs').insert({
      action: 'user_deleted',
      user_id: callerId,
      details: { target_user_id: user_id, target_email: targetEmail },
    });

    return jsonResponse({ ok: true });
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    console.error(JSON.stringify({ fn: 'admin-delete-user', step: currentStep, error: msg }));
    return jsonResponse({ error: msg, step: currentStep }, 400);
  }
});
