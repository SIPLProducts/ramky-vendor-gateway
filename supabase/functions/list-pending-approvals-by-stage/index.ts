import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { requireAuthenticatedUser, authErrorResponse } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STAGE_TO_FLOW_COL: Record<string, string> = {
  SCM_MANAGER: 'scm_manager_user_id',
  SCM_HEAD: 'scm_head_user_id',
  FINANCE_1: 'finance_1_user_id',
  FINANCE_2: 'finance_2_user_id',
  CEO_OFFICE: 'ceo_office_user_id',
};

const STAGE_TO_SKIP_COL: Record<string, string | null> = {
  SCM_MANAGER: 'skip_scm_manager',
  SCM_HEAD: 'skip_scm_head',
  FINANCE_1: 'skip_finance_1',
  FINANCE_2: 'skip_finance_2',
  CEO_OFFICE: null,
};

const STAGE_LABEL: Record<string, string> = {
  BUYER: 'Buyer Approval',
  SCM_MANAGER: 'SCM Manager',
  SCM_HEAD: 'SCM Head',
  FINANCE_1: 'Finance 1',
  FINANCE_2: 'Finance 2',
  CEO_OFFICE: 'CEO Office',
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

    // ─── BUYER STAGE ──────────────────────────────────────────────────
    if (stage === 'BUYER') {
      const { data: buyerInvites } = await admin
        .from('vendor_invitations').select('vendor_id').eq('created_by', auth.userId);
      const buyerVendorIds = Array.from(new Set((buyerInvites ?? []).map((r: any) => r.vendor_id).filter(Boolean)));
      if (buyerVendorIds.length === 0) {
        return new Response(JSON.stringify({ items: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: buyerProgress } = await admin
        .from('vendor_approval_progress')
        .select('id, vendor_id, level_number, status, stage, started_at, completed_at, rejection_comments, rejection_from_stage, rejection_at')
        .eq('stage', 'BUYER').eq('status', 'pending').in('vendor_id', buyerVendorIds);
      const { data: rejectedVendors } = await admin
        .from('vendors')
        .select('id, legal_name, trade_name, gstin, submitted_at, is_msme_registered, vendor_type, status, last_rejection_comments, last_rejection_stage, last_rejected_at, reference_number')
        .in('id', buyerVendorIds).eq('status', 'returned_to_buyer');

      // Latest invitation per vendor (for on-behalf detection + deep-link).
      const { data: invsForBuyer } = await admin
        .from('vendor_invitations')
        .select('id, vendor_id, created_on_behalf, created_at')
        .in('vendor_id', buyerVendorIds)
        .order('created_at', { ascending: false });
      const invByVendor = new Map<string, any>();
      (invsForBuyer ?? []).forEach((inv: any) => {
        if (!invByVendor.has(inv.vendor_id)) invByVendor.set(inv.vendor_id, inv);
      });

      const pendingVIds = (buyerProgress ?? []).map((p: any) => p.vendor_id);
      const { data: vendors } = pendingVIds.length
        ? await admin.from('vendors').select('id, legal_name, trade_name, gstin, submitted_at, is_msme_registered, vendor_type, reference_number').in('id', pendingVIds)
        : { data: [] as any[] } as any;
      const vMap = new Map((vendors ?? []).map((v: any) => [v.id, v]));

      const pendingItems = (buyerProgress ?? []).map((p: any) => {
        const v: any = vMap.get(p.vendor_id);
        const isIntl = v?.vendor_type === 'international';
        const inv = invByVendor.get(p.vendor_id);
        return {
          progressId: p.id,
          vendorId: p.vendor_id,
          referenceNumber: v?.reference_number ?? null,
          vendorName: (v?.gstin ? (v?.trade_name || v?.legal_name) : (v?.legal_name || v?.trade_name)) || p.vendor_id.slice(0, 8),
          submittedAt: v?.submitted_at ?? null,
          isMsme: isIntl ? false : !!v?.is_msme_registered,
          isInternational: isIntl,
          levelNumber: p.level_number,
          levelName: 'Buyer Approval',
          approvalMode: 'ANY',
          stage: 'BUYER',
          blockedByPrevious: false,
          kind: 'pending',
          startedAt: p.started_at,
          rejectionComments: p.rejection_comments ?? null,
          rejectionFromStage: p.rejection_from_stage ?? null,
          rejectionAt: p.rejection_at ?? null,
          isOnBehalf: !!inv?.created_on_behalf,
          invitationId: inv?.id ?? null,
        };
      });

      const rejectedItems = (rejectedVendors ?? []).map((v: any) => {
        const isIntl = v?.vendor_type === 'international';
        const inv = invByVendor.get(v.id);
        return {
          progressId: null, vendorId: v.id,
          referenceNumber: v?.reference_number ?? null,
          vendorName: (v?.gstin ? (v?.trade_name || v?.legal_name) : (v?.legal_name || v?.trade_name)) || v.id.slice(0, 8),
          submittedAt: v?.submitted_at ?? null,
          isMsme: isIntl ? false : !!v?.is_msme_registered,
          isInternational: isIntl,
          levelNumber: 0, levelName: 'Rejected', approvalMode: 'ANY', stage: 'BUYER',
          blockedByPrevious: false, kind: 'rejected',
          rejectionComments: v?.last_rejection_comments ?? null,
          rejectionFromStage: v?.last_rejection_stage ?? null,
          rejectionAt: v?.last_rejected_at ?? null,
          isOnBehalf: !!inv?.created_on_behalf,
          invitationId: inv?.id ?? null,
        };
      });


      return new Response(JSON.stringify({ items: [...pendingItems, ...rejectedItems] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── DOWNSTREAM STAGES (via buyer_approval_flows) ─────────────────
    const userCol = STAGE_TO_FLOW_COL[stage];
    if (!userCol) {
      return new Response(JSON.stringify({ items: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const skipCol = STAGE_TO_SKIP_COL[stage];

    // 1. Buyers whose flow assigns me to this stage (and stage not skipped).
    let flowsQ = admin.from('buyer_approval_flows').select('buyer_user_id').eq(userCol, auth.userId);
    if (skipCol) flowsQ = flowsQ.eq(skipCol, false);
    const { data: flows } = await flowsQ;
    const buyerIds = Array.from(new Set((flows ?? []).map((f: any) => f.buyer_user_id).filter(Boolean)));
    if (buyerIds.length === 0) {
      return new Response(JSON.stringify({ items: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Vendors invited by those buyers
    const { data: invites } = await admin
      .from('vendor_invitations')
      .select('vendor_id, created_by, tenant_id, created_at')
      .in('created_by', buyerIds)
      .order('created_at', { ascending: false });
    const vendorIds = Array.from(new Set((invites ?? []).map((i: any) => i.vendor_id).filter(Boolean)));
    if (vendorIds.length === 0) {
      return new Response(JSON.stringify({ items: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3. Pending progress rows for this stage on those vendors
    const { data: progress } = await admin
      .from('vendor_approval_progress')
      .select('id, vendor_id, level_number, status, stage, started_at, completed_at, rejection_comments, rejection_from_stage, rejection_at')
      .eq('stage', stage).eq('status', 'pending').in('vendor_id', vendorIds);
    if (!progress || progress.length === 0) {
      return new Response(JSON.stringify({ items: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 4. Full chain for blockedByPrevious
    const progressVendorIds = Array.from(new Set(progress.map((p: any) => p.vendor_id)));
    const { data: allProgress } = await admin
      .from('vendor_approval_progress')
      .select('vendor_id, level_number, status')
      .in('vendor_id', progressVendorIds);
    const allByVendor = new Map<string, { level_number: number; status: string }[]>();
    (allProgress ?? []).forEach((p: any) => {
      const arr = allByVendor.get(p.vendor_id) ?? [];
      arr.push({ level_number: p.level_number, status: p.status });
      allByVendor.set(p.vendor_id, arr);
    });

    const { data: vendors } = await admin
      .from('vendors')
      .select('id, legal_name, trade_name, gstin, submitted_at, is_msme_registered, vendor_type, tenant_id, reference_number')
      .in('id', progressVendorIds);
    const vMap = new Map((vendors ?? []).map((v: any) => [v.id, v]));

    const inviteByVendor = new Map<string, any>();
    (invites ?? []).forEach((inv: any) => {
      if (!inviteByVendor.has(inv.vendor_id)) inviteByVendor.set(inv.vendor_id, inv);
    });

    const tenantIds = Array.from(new Set([
      ...(vendors ?? []).map((v: any) => v.tenant_id).filter(Boolean),
      ...(invites ?? []).map((i: any) => i.tenant_id).filter(Boolean),
    ]));
    const { data: tenantsRows } = tenantIds.length
      ? await admin.from('tenants').select('id, name, code').in('id', tenantIds)
      : { data: [] as any[] } as any;
    const tMap = new Map((tenantsRows ?? []).map((t: any) => [t.id, t]));

    const buyerProfileIds = Array.from(new Set((invites ?? []).map((i: any) => i.created_by).filter(Boolean)));
    const { data: buyerProfiles } = buyerProfileIds.length
      ? await admin.from('profiles').select('id, full_name, email').in('id', buyerProfileIds)
      : { data: [] as any[] } as any;
    const buyerMap = new Map((buyerProfiles ?? []).map((p: any) => [p.id, p]));

    const items = progress.map((p: any) => {
      const v: any = vMap.get(p.vendor_id);
      const chain = allByVendor.get(p.vendor_id) ?? [];
      const blockedByPrevious = chain.some((r) => r.level_number < p.level_number && r.status !== 'approved');
      const isIntl = v?.vendor_type === 'international';
      const inv = inviteByVendor.get(p.vendor_id);
      const buyer = inv?.created_by ? buyerMap.get(inv.created_by) : null;
      const vendorTenant = v?.tenant_id ? tMap.get(v.tenant_id) : null;
      const inviteTenant = inv?.tenant_id ? tMap.get(inv.tenant_id) : null;
      return {
        progressId: p.id,
        vendorId: p.vendor_id,
        referenceNumber: v?.reference_number ?? null,
        vendorName: v?.legal_name ?? v?.trade_name ?? p.vendor_id.slice(0, 8),
        submittedAt: v?.submitted_at ?? null,
        isMsme: isIntl ? false : !!v?.is_msme_registered,
        isInternational: isIntl,
        levelNumber: p.level_number,
        levelName: STAGE_LABEL[stage] ?? stage,
        approvalMode: 'ANY',
        stage,
        blockedByPrevious,
        startedAt: p.started_at,
        vendorCompany: vendorTenant ? `${vendorTenant.name}${vendorTenant.code ? ` (${vendorTenant.code})` : ''}` : null,
        invitationCompany: inviteTenant ? `${inviteTenant.name}${inviteTenant.code ? ` (${inviteTenant.code})` : ''}` : null,
        companyMismatch: !!(vendorTenant && inviteTenant && v?.tenant_id !== inv?.tenant_id),
        buyerName: buyer?.full_name ?? null,
        buyerEmail: buyer?.email ?? null,
        mappedScmManagers: [],
        rejectionComments: p.rejection_comments ?? null,
        rejectionFromStage: p.rejection_from_stage ?? null,
        rejectionAt: p.rejection_at ?? null,
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
