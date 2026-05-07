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

    const email = (auth.email ?? '').toLowerCase();

    // 1. Levels at this stage where user is an approver
    const { data: myLevels, error: lvlErr } = await admin
      .from('approval_matrix_approvers')
      .select('level_id, approval_matrix_levels!inner(id, stage, level_name, approval_mode)')
      .or(
        email
          ? `user_id.eq.${auth.userId},approver_email.ilike.${email}`
          : `user_id.eq.${auth.userId}`,
      );
    if (lvlErr) throw lvlErr;

    const levelMeta = new Map<string, any>();
    (myLevels ?? []).forEach((row: any) => {
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

    const vendorIds = [...new Set(progress.map((p: any) => p.vendor_id))];

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
      .select('id, legal_name, trade_name, submitted_at, is_msme_registered')
      .in('id', vendorIds);
    const vMap = new Map((vendors ?? []).map((v: any) => [v.id, v]));

    const items = progress.map((p: any) => {
      const v: any = vMap.get(p.vendor_id);
      const lvl = levelMeta.get(p.level_id);
      const chain = allByVendor.get(p.vendor_id) ?? [];
      const blockedByPrevious = chain.some(
        (r) => r.level_number < p.level_number && r.status !== 'approved',
      );
      return {
        progressId: p.id,
        vendorId: p.vendor_id,
        vendorName: v?.legal_name ?? v?.trade_name ?? p.vendor_id.slice(0, 8),
        submittedAt: v?.submitted_at ?? null,
        isMsme: !!v?.is_msme_registered,
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
