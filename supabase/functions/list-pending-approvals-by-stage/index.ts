import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { requireAuthenticatedUser, authErrorResponse } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = await requireAuthenticatedUser(req);
  if (!auth.ok) return authErrorResponse(auth, corsHeaders);

  try {
    const { stage } = await req.json();
    if (!stage) {
      return new Response(JSON.stringify({ error: 'stage required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const email = (auth.email ?? '').trim().toLowerCase();

    // 1. Find all approver rows for this user — by user_id OR by email.
    // Run as two clean queries instead of a fragile PostgREST .or() string,
    // so dots/plus-aliases/punctuation in emails can never break the filter.
    const selectCols = 'id, level_id, user_id, approver_email, approval_matrix_levels!inner(id, stage, level_name, approval_mode)';

    const byUserPromise = admin
      .from('approval_matrix_approvers')
      .select(selectCols)
      .eq('user_id', auth.userId);

    const byEmailPromise = email
      ? admin
          .from('approval_matrix_approvers')
          .select(selectCols)
          .ilike('approver_email', email)
      : Promise.resolve({ data: [] as any[], error: null });

    const [byUserRes, byEmailRes] = await Promise.all([byUserPromise, byEmailPromise]);
    if (byUserRes.error) throw byUserRes.error;
    if ((byEmailRes as any).error) throw (byEmailRes as any).error;

    const merged = new Map<string, any>();
    [...(byUserRes.data ?? []), ...((byEmailRes as any).data ?? [])].forEach((row: any) => {
      merged.set(row.id, row);
    });

    // Auto-link user_id on rows matched by email so future lookups are exact.
    const toLink = [...merged.values()].filter(
      (r: any) => !r.user_id && r.approver_email && r.approver_email.toLowerCase() === email,
    );
    if (toLink.length > 0) {
      await admin
        .from('approval_matrix_approvers')
        .update({ user_id: auth.userId })
        .in('id', toLink.map((r: any) => r.id));
    }

    const levelMeta = new Map<string, any>();
    [...merged.values()].forEach((row: any) => {
      if (row.approval_matrix_levels?.stage === stage) {
        levelMeta.set(row.level_id, row.approval_matrix_levels);
      }
    });
    const stageLevelIds = [...levelMeta.keys()];
    if (stageLevelIds.length === 0) {
      return new Response(JSON.stringify({ items: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Pending progress at those levels
    const { data: progress, error: pErr } = await admin
      .from('vendor_approval_progress')
      .select('id, vendor_id, level_id, level_number, status')
      .in('level_id', stageLevelIds)
      .eq('status', 'pending');
    if (pErr) throw pErr;
    if (!progress || progress.length === 0) {
      return new Response(JSON.stringify({ items: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let filteredProgress = progress;

    // SCM Manager: restrict to vendors invited by a buyer mapped to this user
    // via buyer_scm_mappings ("SCM - Buyer Relation"). This mirrors the RLS
    // rule scm_manager_can_see_vendor so the list never contains vendors the
    // user cannot actually open.
    if (stage === 'SCM_MANAGER') {
      const { data: mappings, error: mErr } = await admin
        .from('buyer_scm_mappings')
        .select('buyer_user_id')
        .eq('scm_manager_user_id', auth.userId);
      if (mErr) throw mErr;
      const buyerIds = Array.from(
        new Set((mappings ?? []).map((m: any) => m.buyer_user_id).filter(Boolean)),
      );
      if (buyerIds.length === 0) {
        return new Response(JSON.stringify({ items: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const progressVendorIds = Array.from(new Set(progress.map((p: any) => p.vendor_id)));
      const { data: invites, error: iErr } = await admin
        .from('vendor_invitations')
        .select('vendor_id')
        .in('created_by', buyerIds)
        .in('vendor_id', progressVendorIds);
      if (iErr) throw iErr;
      const allowed = new Set(
        (invites ?? []).map((r: any) => r.vendor_id).filter(Boolean),
      );
      filteredProgress = progress.filter((p: any) => allowed.has(p.vendor_id));
      if (filteredProgress.length === 0) {
        return new Response(JSON.stringify({ items: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const vendorIds = [...new Set(filteredProgress.map((p: any) => p.vendor_id))];


    // 3. Full progress chain (service role bypasses RLS)
    const { data: allProgress } = await admin
      .from('vendor_approval_progress')
      .select('vendor_id, level_number, status')
      .in('vendor_id', vendorIds);

    const allByVendor = new Map<string, { level_number: number; status: string }[]>();
    (allProgress ?? []).forEach((p: any) => {
      const arr = allByVendor.get(p.vendor_id) ?? [];
      arr.push({ level_number: p.level_number, status: p.status });
      allByVendor.set(p.vendor_id, arr);
    });

    // 4. Vendor info
    const { data: vendors } = await admin
      .from('vendors')
      .select('id, legal_name, trade_name, submitted_at, is_msme_registered, vendor_type')
      .in('id', vendorIds);
    const vMap = new Map((vendors ?? []).map((v: any) => [v.id, v]));

    const items = filteredProgress.map((p: any) => {
      const v: any = vMap.get(p.vendor_id);
      const lvl = levelMeta.get(p.level_id);
      const chain = allByVendor.get(p.vendor_id) ?? [];
      const blockedByPrevious = chain.some(
        (r) => r.level_number < p.level_number && r.status !== 'approved',
      );
      const isInternational = v?.vendor_type === 'international';
      return {
        progressId: p.id,
        vendorId: p.vendor_id,
        vendorName: v?.legal_name ?? v?.trade_name ?? p.vendor_id.slice(0, 8),
        submittedAt: v?.submitted_at ?? null,
        isMsme: isInternational ? false : !!v?.is_msme_registered,
        isInternational,
        levelNumber: p.level_number,
        levelName: lvl?.level_name ?? '—',
        approvalMode: lvl?.approval_mode ?? 'ANY',
        stage,
        blockedByPrevious,
      };
    });

    return new Response(JSON.stringify({ items }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
