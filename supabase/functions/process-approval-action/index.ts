import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { progress_id, action, comments } = await req.json();
    if (!progress_id || !['approve', 'reject'].includes(action)) {
      return new Response(JSON.stringify({ error: 'Invalid input' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: userData, error: uErr } = await anonClient.auth.getUser(token);
    if (uErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = userData.user.id;

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Get progress row + level
    const { data: progress } = await admin
      .from('vendor_approval_progress')
      .select('id, vendor_id, level_id, level_number, status')
      .eq('id', progress_id).single();
    if (!progress) throw new Error('Progress not found');
    if (progress.status !== 'pending') throw new Error('Already actioned');

    // Validate user is approver for this level — either by user_id OR by matching email
    const userEmail = (userData.user.email ?? '').toLowerCase();
    const { data: approvers } = await admin
      .from('approval_matrix_approvers')
      .select('id, user_id, approver_email')
      .eq('level_id', progress.level_id);
    const isApprover = (approvers ?? []).some(
      (a: any) => a.user_id === userId || (a.approver_email && a.approver_email.toLowerCase() === userEmail)
    );
    if (!isApprover) throw new Error('You are not an approver for this level');

    // Validate it is the active (lowest-numbered pending) level for the vendor
    const { data: allProgress } = await admin
      .from('vendor_approval_progress')
      .select('level_number, status').eq('vendor_id', progress.vendor_id);
    const minPending = (allProgress ?? [])
      .filter((p) => p.status === 'pending')
      .reduce((min, p) => Math.min(min, p.level_number), Infinity);
    if (progress.level_number !== minPending) {
      throw new Error('Lower-level approval still pending');
    }

    // Get level for mode
    const { data: level } = await admin
      .from('approval_matrix_levels')
      .select('approval_mode, level_number, tenant_id').eq('id', progress.level_id).single();

    // Stage -> vendor.status mapping
    const STAGE_TO_REVIEW: Record<string, string> = {
      SCM_MANAGER: 'scm_manager_review',
      SCM_HEAD: 'scm_head_review',
      FINANCE_1: 'finance_1_review',
      FINANCE_2: 'finance_2_review',
      CEO_OFFICE: 'ceo_office_review',
    };
    const STAGE_TO_REJECT: Record<string, string> = {
      SCM_MANAGER: 'scm_manager_rejected',
      SCM_HEAD: 'scm_head_rejected',
      FINANCE_1: 'finance_1_rejected',
      FINANCE_2: 'finance_2_rejected',
      CEO_OFFICE: 'ceo_office_rejected',
    };

    // Look up the current level's stage
    const { data: curLevel } = await admin
      .from('approval_matrix_levels')
      .select('stage').eq('id', progress.level_id).single();
    const curStage = curLevel?.stage ?? 'SCM_MANAGER';

    if (action === 'reject') {
      await admin.from('vendor_approval_progress').update({
        status: 'rejected', acted_by: userId, acted_at: new Date().toISOString(), comments,
      }).eq('id', progress_id);
      const rejectStatus = STAGE_TO_REJECT[curStage] ?? 'purchase_rejected';
      await admin.from('vendors').update({ status: rejectStatus }).eq('id', progress.vendor_id);
      return new Response(JSON.stringify({ ok: true, vendor_status: rejectStatus }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // APPROVE
    await admin.from('vendor_approval_progress').update({
      status: 'approved', acted_by: userId, acted_at: new Date().toISOString(), comments,
    }).eq('id', progress_id);

    // For ALL mode we'd need to check sibling approvers — current schema has one row per level so single approval = level done.

    // Re-check remaining pending levels AFTER this approval.
    // If none remain pending -> all SCM matrix levels are approved -> hand off to Finance review.
    // Otherwise, advance to the next pending level (no vendor status change).
    const { data: remainingProgress } = await admin
      .from('vendor_approval_progress')
      .select('id, level_number, level_id, status')
      .eq('vendor_id', progress.vendor_id);
    const stillPending = (remainingProgress ?? []).filter((p) => p.status === 'pending');

    if (stillPending.length === 0) {
      await admin.from('vendors').update({
        status: 'pending_sap_sync',
        purchase_reviewed_by: userId,
        purchase_reviewed_at: new Date().toISOString(),
      }).eq('id', progress.vendor_id);
      return new Response(JSON.stringify({ ok: true, vendor_status: 'pending_sap_sync' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const nextRow = stillPending.reduce((min, p) => (p.level_number < min.level_number ? p : min), stillPending[0]);
    const { data: nextLvl } = await admin
      .from('approval_matrix_levels')
      .select('stage').eq('id', nextRow.level_id).single();
    const nextStatus = STAGE_TO_REVIEW[nextLvl?.stage ?? ''] ?? 'purchase_review';
    await admin.from('vendors').update({ status: nextStatus }).eq('id', progress.vendor_id);

    return new Response(JSON.stringify({ ok: true, vendor_status: nextStatus, advanced_to_level: nextRow.level_number }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
