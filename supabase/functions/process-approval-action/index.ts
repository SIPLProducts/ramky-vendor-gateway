import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// v2: reverse-rejection routes back to the immediate previous level.


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
      .select('id, vendor_id, level_id, level_number, status, stage')
      .eq('id', progress_id).single();
    if (!progress) throw new Error('Progress not found');
    if (progress.status !== 'pending') throw new Error('Already actioned');

    const isBuyerRow = progress.stage === 'BUYER' || progress.level_id === null;

    // Validate user is approver for this level
    if (isBuyerRow) {
      // Authorise: caller must be the inviting buyer for this vendor.
      const { data: invite } = await admin
        .from('vendor_invitations')
        .select('created_by')
        .eq('vendor_id', progress.vendor_id)
        .order('created_at', { ascending: false })
        .limit(1).maybeSingle();
      if (!invite || invite.created_by !== userId) {
        throw new Error('You are not the buyer for this vendor');
      }
    } else {
      const userEmail = (userData.user.email ?? '').trim().toLowerCase();
      const { data: approvers } = await admin
        .from('approval_matrix_approvers')
        .select('id, user_id, approver_email')
        .eq('level_id', progress.level_id);

      const matched = (approvers ?? []).filter((a: any) => {
        if (a.user_id === userId) return true;
        const e = (a.approver_email ?? '').trim().toLowerCase();
        return !!userEmail && e === userEmail;
      });
      if (matched.length === 0) throw new Error('You are not an approver for this level');

      const toLink = matched.filter((a: any) => !a.user_id).map((a: any) => a.id);
      if (toLink.length > 0) {
        await admin.from('approval_matrix_approvers').update({ user_id: userId }).in('id', toLink);
      }
    }

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

    // Get level for mode (skip for synthetic buyer rows)
    const { data: level } = isBuyerRow
      ? { data: { approval_mode: 'ANY', level_number: progress.level_number, tenant_id: null as any } }
      : await admin
          .from('approval_matrix_levels')
          .select('approval_mode, level_number, tenant_id').eq('id', progress.level_id).single();

    // Stage -> vendor.status mapping
    const STAGE_TO_REVIEW: Record<string, string> = {
      BUYER: 'buyer_review',
      SCM_MANAGER: 'scm_manager_review',
      SCM_HEAD: 'scm_head_review',
      FINANCE_1: 'finance_1_review',
      FINANCE_2: 'finance_2_review',
      CEO_OFFICE: 'ceo_office_review',
    };

    // Look up the current level's stage (use synthetic stage for buyer row)
    let curStage = progress.stage ?? 'SCM_MANAGER';
    if (!isBuyerRow) {
      const { data: curLevel } = await admin
        .from('approval_matrix_levels')
        .select('stage').eq('id', progress.level_id).single();
      curStage = curLevel?.stage ?? 'SCM_MANAGER';
    }

    if (action === 'reject') {
      // 1) Mark the current step as rejected with remarks.
      const nowIso = new Date().toISOString();
      await admin.from('vendor_approval_progress').update({
        status: 'rejected', acted_by: userId, acted_at: nowIso, comments,
      }).eq('id', progress_id);

      const vendorRejectionPatch: Record<string, unknown> = {
        last_rejection_comments: comments ?? null,
        last_rejection_stage: curStage,
        last_rejected_by: userId,
        last_rejected_at: nowIso,
      };

      // BUYER reject → return application to the vendor for edit & resubmit.
      if (isBuyerRow) {
        await admin.from('vendors')
          .update({ status: 'returned_to_vendor', ...vendorRejectionPatch })
          .eq('id', progress.vendor_id);

        await admin.from('audit_logs').insert({
          action: 'vendor_buyer_rejected',
          user_id: userId,
          vendor_id: progress.vendor_id,
          details: { comments },
        });

        // Best-effort vendor notification.
        try {
          const { data: vendorRow } = await admin
            .from('vendors')
            .select('legal_name, primary_email, registered_email')
            .eq('id', progress.vendor_id).single();
          const vendorEmail = vendorRow?.primary_email || vendorRow?.registered_email;
          if (vendorEmail) {
            await admin.functions.invoke('send-status-notification', {
              body: {
                vendorId: progress.vendor_id,
                newStatus: 'returned_to_vendor',
                previousStatus: 'buyer_review',
                vendorEmail,
                vendorName: vendorRow?.legal_name ?? 'Vendor',
                comments: comments ?? '',
                simulationMode: false,
              },
            });
          }
        } catch (e) {
          console.warn('send-status-notification failed', e);
        }

        return new Response(JSON.stringify({ ok: true, vendor_status: 'returned_to_vendor' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Any other approver reject → always return to the inviting Buyer.
      // Cancel remaining pending steps so the chain is clean; on resubmit it
      // will be reseeded from scratch via route-vendor-approval.
      await admin.from('vendor_approval_progress')
        .update({ status: 'cancelled', acted_at: nowIso })
        .eq('vendor_id', progress.vendor_id)
        .eq('status', 'pending');

      await admin.from('vendors')
        .update({ status: 'returned_to_buyer', ...vendorRejectionPatch })
        .eq('id', progress.vendor_id);

      await admin.from('audit_logs').insert({
        action: 'vendor_rejected_returned_to_buyer',
        user_id: userId,
        vendor_id: progress.vendor_id,
        details: { comments, from_stage: curStage },
      });

      return new Response(JSON.stringify({ ok: true, vendor_status: 'returned_to_buyer', from_stage: curStage }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }



    // APPROVE
    await admin.from('vendor_approval_progress').update({
      status: 'approved', acted_by: userId, acted_at: new Date().toISOString(), comments,
    }).eq('id', progress_id);

    // For ALL mode we'd need to check sibling approvers — current schema has one row per level so single approval = level done.

    // Re-check remaining pending levels AFTER this approval.
    let { data: remainingProgress } = await admin
      .from('vendor_approval_progress')
      .select('id, level_number, level_id, status, stage')
      .eq('vendor_id', progress.vendor_id);
    let stillPending = (remainingProgress ?? []).filter((p) => p.status === 'pending');

    // AUTO-EXTEND: if no rows remain pending, check whether the matrix has grown
    // (new downstream stages added after this vendor was originally routed).
    // If yes, insert pending rows for the missing stages so the chain continues
    // instead of short-circuiting to SAP sync.
    if (stillPending.length === 0 && level?.tenant_id) {
      const { data: vendorRow } = await admin
        .from('vendors').select('is_msme_registered, vendor_type').eq('id', progress.vendor_id).single();
      const isMsme = vendorRow?.vendor_type === 'international'
        ? false
        : !!vendorRow?.is_msme_registered;

      let skipScm = false;
      const { data: invite } = await admin
        .from('vendor_invitations')
        .select('created_by')
        .eq('vendor_id', progress.vendor_id)
        .order('created_at', { ascending: false })
        .limit(1).maybeSingle();
      if (invite?.created_by) {
        const { data: mappings } = await admin
          .from('buyer_scm_mappings')
          .select('include_scm_stages')
          .eq('tenant_id', level.tenant_id)
          .eq('buyer_user_id', invite.created_by);
        skipScm = (mappings ?? []).some((m: any) => m.include_scm_stages === false);
      }

      const { data: activeLevels } = await admin
        .from('approval_matrix_levels')
        .select('id, level_number, stage, requires_msme')
        .eq('tenant_id', level.tenant_id)
        .eq('is_active', true);

      const levelIds = (activeLevels ?? []).map((l: any) => l.id);
      const { data: approverRows } = levelIds.length > 0
        ? await admin.from('approval_matrix_approvers').select('level_id').in('level_id', levelIds)
        : { data: [] as any[] };
      const stagesWithApprovers = new Set((approverRows ?? []).map((a: any) => a.level_id));

      const STAGE_ORDER: Record<string, number> = {
        SCM_MANAGER: 1, SCM_HEAD: 2, FINANCE_1: 3, FINANCE_2: 4, CEO_OFFICE: 5,
      };
      const eligible = (activeLevels ?? [])
        .filter((l: any) => !(l.requires_msme && !isMsme))
        .filter((l: any) => !(skipScm && (l.stage === 'SCM_MANAGER' || l.stage === 'SCM_HEAD')))
        .filter((l: any) => stagesWithApprovers.has(l.id))
        .sort((a: any, b: any) => (STAGE_ORDER[a.stage] ?? 99) - (STAGE_ORDER[b.stage] ?? 99)
          || (a.level_number ?? 0) - (b.level_number ?? 0));


      const existingLevelIds = new Set((remainingProgress ?? []).map((p: any) => p.level_id));
      const maxNum = (remainingProgress ?? []).reduce((m: number, p: any) => Math.max(m, p.level_number ?? 0), 0);

      const toAdd = eligible.filter((l: any) => !existingLevelIds.has(l.id));
      if (toAdd.length > 0) {
        const newRows = toAdd.map((l: any, idx: number) => ({
          vendor_id: progress.vendor_id,
          level_id: l.id,
          level_number: maxNum + idx + 1,
          status: 'pending',
        }));
        await admin.from('vendor_approval_progress').insert(newRows);
        const { data: refreshed } = await admin
          .from('vendor_approval_progress')
          .select('id, level_number, level_id, status')
          .eq('vendor_id', progress.vendor_id);
        remainingProgress = refreshed ?? [];
        stillPending = remainingProgress.filter((p: any) => p.status === 'pending');
      }
    }

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
    let nextStage: string | null = (nextRow as any).stage ?? null;
    if (!nextStage && nextRow.level_id) {
      const { data: nextLvl } = await admin
        .from('approval_matrix_levels')
        .select('stage').eq('id', nextRow.level_id).single();
      nextStage = nextLvl?.stage ?? null;
    }
    const nextStatus = STAGE_TO_REVIEW[nextStage ?? ''] ?? 'purchase_review';
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
