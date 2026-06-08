import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STAGE_TO_FLOW_COL: Record<string, string | null> = {
  BUYER: null,
  SCM_MANAGER: 'scm_manager_user_id',
  SCM_HEAD: 'scm_head_user_id',
  FINANCE_1: 'finance_1_user_id',
  FINANCE_2: 'finance_2_user_id',
  CEO_OFFICE: 'ceo_office_user_id',
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

    const { data: progress } = await admin
      .from('vendor_approval_progress')
      .select('id, vendor_id, level_id, level_number, status, stage, started_at')
      .eq('id', progress_id).single();
    if (!progress) throw new Error('Progress not found');
    if (progress.status !== 'pending') throw new Error('Already actioned');

    const curStage = progress.stage ?? 'SCM_MANAGER';
    const isBuyerRow = curStage === 'BUYER';

    // Authorise
    if (isBuyerRow) {
      const { data: invite } = await admin
        .from('vendor_invitations').select('created_by').eq('vendor_id', progress.vendor_id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!invite || invite.created_by !== userId) throw new Error('You are not the buyer for this vendor');
    } else {
      const { data: invite } = await admin
        .from('vendor_invitations').select('created_by').eq('vendor_id', progress.vendor_id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!invite?.created_by) throw new Error('No inviting buyer recorded for vendor');
      const col = STAGE_TO_FLOW_COL[curStage];
      if (!col) throw new Error(`Unknown stage ${curStage}`);
      const { data: flow } = await admin
        .from('buyer_approval_flows').select(`${col}`).eq('buyer_user_id', invite.created_by).maybeSingle();
      if (!flow || (flow as any)[col] !== userId) {
        throw new Error('You are not configured as the approver for this stage');
      }
    }

    // Active row check (lowest pending)
    const { data: allProgress } = await admin
      .from('vendor_approval_progress')
      .select('id, level_number, status, stage, started_at')
      .eq('vendor_id', progress.vendor_id);
    const minPending = (allProgress ?? [])
      .filter((p) => p.status === 'pending')
      .reduce((m, p) => Math.min(m, p.level_number), Infinity);
    if (progress.level_number !== minPending) throw new Error('Lower-level approval still pending');

    const nowIso = new Date().toISOString();

    if (action === 'reject') {
      await admin.from('vendor_approval_progress').update({
        status: 'rejected', acted_by: userId, acted_at: nowIso, completed_at: nowIso, comments,
      }).eq('id', progress_id);

      const vendorRejectionPatch: Record<string, unknown> = {
        last_rejection_comments: comments ?? null,
        last_rejection_stage: curStage,
        last_rejected_by: userId,
        last_rejected_at: nowIso,
      };

      if (isBuyerRow) {
        await admin.from('vendors').update({ status: 'returned_to_vendor', ...vendorRejectionPatch }).eq('id', progress.vendor_id);
        await admin.from('audit_logs').insert({
          action: 'vendor_buyer_rejected', user_id: userId, vendor_id: progress.vendor_id, details: { comments },
        });
        try {
          const { data: vendorRow } = await admin
            .from('vendors').select('legal_name, primary_email, registered_email').eq('id', progress.vendor_id).single();
          const vendorEmail = vendorRow?.primary_email || vendorRow?.registered_email;
          if (vendorEmail) {
            await admin.functions.invoke('send-status-notification', {
              body: {
                vendorId: progress.vendor_id, newStatus: 'returned_to_vendor', previousStatus: 'buyer_review',
                vendorEmail, vendorName: vendorRow?.legal_name ?? 'Vendor', comments: comments ?? '', simulationMode: false,
              },
            });
          }
        } catch (e) { console.warn('send-status-notification failed', e); }
        return new Response(JSON.stringify({ ok: true, vendor_status: 'returned_to_vendor' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await admin.from('vendor_approval_progress')
        .update({ status: 'cancelled', acted_at: nowIso, completed_at: nowIso })
        .eq('vendor_id', progress.vendor_id).eq('status', 'pending');
      await admin.from('vendors').update({ status: 'returned_to_buyer', ...vendorRejectionPatch }).eq('id', progress.vendor_id);
      await admin.from('audit_logs').insert({
        action: 'vendor_rejected_returned_to_buyer', user_id: userId, vendor_id: progress.vendor_id,
        details: { comments, from_stage: curStage },
      });
      return new Response(JSON.stringify({ ok: true, vendor_status: 'returned_to_buyer', from_stage: curStage }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // APPROVE
    await admin.from('vendor_approval_progress').update({
      status: 'approved', acted_by: userId, acted_at: nowIso, completed_at: nowIso, comments,
    }).eq('id', progress_id);

    const remaining = (allProgress ?? [])
      .filter((p) => p.status === 'pending' && p.id !== progress_id);

    if (remaining.length === 0) {
      await admin.from('vendors').update({
        status: 'pending_sap_sync',
        purchase_reviewed_by: userId,
        purchase_reviewed_at: nowIso,
      }).eq('id', progress.vendor_id);
      return new Response(JSON.stringify({ ok: true, vendor_status: 'pending_sap_sync' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const nextRow = remaining.reduce((min, p) => (p.level_number < min.level_number ? p : min), remaining[0]);
    const nextStage: string = (nextRow as any).stage ?? 'SCM_MANAGER';
    const nextStatus = STAGE_TO_REVIEW[nextStage] ?? 'scm_manager_review';

    await admin.from('vendor_approval_progress')
      .update({ started_at: nowIso })
      .eq('id', (nextRow as any).id)
      .is('started_at', null);

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
