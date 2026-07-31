// Lets the inviting buyer (or admin) re-approve a vendor that was rejected by
// a downstream approver and returned to the buyer. This re-seeds the approval
// chain (via the seed trigger fired on buyer_review status) and auto-approves
// the synthetic BUYER row so the vendor moves forward to the next stage in the
// configured approval matrix.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { requireAuthenticatedUser, authErrorResponse } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STAGE_TO_REVIEW: Record<string, string> = {
  BUYER: 'buyer_review',
  SCM_MANAGER: 'scm_manager_review',
  SCM_HEAD: 'scm_head_review',
  FINANCE_1: 'finance_1_review',
  FINANCE_2: 'finance_2_review',
  CEO_OFFICE: 'ceo_office_review',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = await requireAuthenticatedUser(req);
  if (!auth.ok) return authErrorResponse(auth, corsHeaders);

  try {
    const { vendor_id, comments, classification } = await req.json();
    if (!vendor_id) {
      return new Response(JSON.stringify({ error: 'vendor_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const isAdmin = ['admin', 'sharvi_admin', 'customer_admin'].some((r) => auth.roles.includes(r));
    if (!isAdmin) {
      const { data: invite } = await admin
        .from('vendor_invitations')
        .select('created_by')
        .eq('vendor_id', vendor_id)
        .order('created_at', { ascending: false })
        .limit(1).maybeSingle();
      if (!invite || invite.created_by !== auth.userId) {
        return new Response(JSON.stringify({ error: 'You are not the buyer for this vendor' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const { data: vendor } = await admin
      .from('vendors')
      .select('id, status, last_rejection_stage, last_rejection_comments')
      .eq('id', vendor_id).single();
    if (!vendor) throw new Error('Vendor not found');
    if (vendor.status !== 'returned_to_buyer') {
      return new Response(JSON.stringify({ error: 'Vendor is not in returned_to_buyer state' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fromStage = vendor.last_rejection_stage ?? null;
    const nowIso = new Date().toISOString();

    // If buyer provided classification, persist it before re-routing forward.
    if (classification && (
      Array.isArray(classification.material_group_vendors) || Array.isArray(classification.vendor_categories)
    )) {
      const mg = Array.isArray(classification.material_group_vendors) ? classification.material_group_vendors : [];
      const vc = Array.isArray(classification.vendor_categories) ? classification.vendor_categories : [];
      await admin.from('vendors').update({
        material_group_vendor: mg[0] ?? null,
        material_group_vendors: mg,
        vendor_category: vc[0] ?? null,
        vendor_categories: vc,
      }).eq('id', vendor_id);
    }

    // Re-seed the approval chain from scratch (BUYER row + matrix levels).
    // The trigger only auto-seeds when coming from 'returned_to_vendor', so we
    // call the seeding function directly to cover the 'returned_to_buyer' path.
    const { error: seedErr } = await admin.rpc('seed_vendor_approval_progress', {
      _vendor_id: vendor_id,
    });
    if (seedErr) throw seedErr;

    // Clear rejection metadata on the vendor.
    await admin.from('vendors').update({
      last_rejection_comments: null,
      last_rejection_stage: null,
      last_rejected_by: null,
      last_rejected_at: null,
    }).eq('id', vendor_id);


    // Find the freshly-seeded synthetic BUYER row and auto-approve it.
    const { data: buyerRow } = await admin
      .from('vendor_approval_progress')
      .select('id, level_number')
      .eq('vendor_id', vendor_id)
      .eq('stage', 'BUYER')
      .eq('status', 'pending')
      .order('level_number', { ascending: true })
      .limit(1).maybeSingle();

    if (buyerRow) {
      await admin.from('vendor_approval_progress').update({
        status: 'approved', acted_by: auth.userId, acted_at: nowIso, comments: comments ?? null,
      }).eq('id', buyerRow.id);
      const { error: historyError } = await admin.from('vendor_approval_history').insert({
        vendor_id, stage: 'BUYER', level_number: buyerRow.level_number,
        action: 'resubmitted', from_stage: fromStage, comments: comments ?? null,
        acted_by: auth.userId, acted_at: nowIso,
      });
      if (historyError) console.warn('history log failed (non-blocking):', historyError.message);
    }

    // Advance vendor.status to the next pending stage (mirrors process-approval-action).
    const { data: allProgress } = await admin
      .from('vendor_approval_progress')
      .select('id, level_number, level_id, status, stage')
      .eq('vendor_id', vendor_id);
    const pending = (allProgress ?? []).filter((p: any) => p.status === 'pending');

    let vendorStatus = 'pending_sap_sync';
    if (pending.length > 0) {
      const next = pending.reduce((min: any, p: any) =>
        (p.level_number < min.level_number ? p : min), pending[0]);
      let nextStage: string | null = next.stage ?? null;
      if (!nextStage && next.level_id) {
        const { data: lvl } = await admin
          .from('approval_matrix_levels')
          .select('stage').eq('id', next.level_id).single();
        nextStage = lvl?.stage ?? null;
      }
      vendorStatus = STAGE_TO_REVIEW[nextStage ?? ''] ?? 'scm_manager_review';
    }
    await admin.from('vendors').update({ status: vendorStatus }).eq('id', vendor_id);

    await admin.from('audit_logs').insert({
      action: 'vendor_buyer_reapproved_after_rejection',
      user_id: auth.userId,
      vendor_id,
      details: { from_stage: fromStage, comments: comments ?? null, new_status: vendorStatus },
    });

    return new Response(JSON.stringify({ ok: true, vendor_status: vendorStatus }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
