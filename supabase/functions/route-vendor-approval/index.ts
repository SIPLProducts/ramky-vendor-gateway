import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { requireAuthenticatedUser, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Canonical stage order — buyer submits, then SCM Managers (L2..Ln) act before SCM Head (L1),
// then Finance 1, Finance 2, and finally CEO Office (only for MSME-registered vendors).
const STAGE_ORDER: Record<string, number> = {
  SCM_MANAGER: 1,
  SCM_HEAD: 2,
  FINANCE_1: 3,
  FINANCE_2: 4,
  CEO_OFFICE: 5,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = await requireAuthenticatedUser(req, ['admin', 'sharvi_admin', 'customer_admin', 'finance', 'purchase']);
  if (!auth.ok) return authErrorResponse(auth, corsHeaders);

  try {
    const { vendor_id } = await req.json();
    if (!vendor_id) {
      return new Response(JSON.stringify({ error: 'vendor_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get vendor + tenant + MSME flag
    const { data: vendor, error: vErr } = await supabase
      .from('vendors')
      .select('id, tenant_id, status, is_msme_registered')
      .eq('id', vendor_id)
      .single();
    if (vErr || !vendor) throw vErr ?? new Error('Vendor not found');
    if (!vendor.tenant_id) {
      return new Response(JSON.stringify({ error: 'Vendor has no tenant' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isMsme = !!vendor.is_msme_registered;

    // Read matrix levels
    const { data: levels, error: lErr } = await supabase
      .from('approval_matrix_levels')
      .select('id, level_number, stage, requires_msme')
      .eq('tenant_id', vendor.tenant_id)
      .eq('is_active', true);
    if (lErr) throw lErr;
    if (!levels || levels.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: 'No matrix configured; skipping' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Filter MSME-only stages when vendor is non-MSME
    const eligible = levels.filter((l: any) => !(l.requires_msme && !isMsme));

    // Order by canonical stage, then by level_number within SCM_MANAGER (L2 < L3 < L4 ...)
    eligible.sort((a: any, b: any) => {
      const sa = STAGE_ORDER[a.stage] ?? 99;
      const sb = STAGE_ORDER[b.stage] ?? 99;
      if (sa !== sb) return sa - sb;
      // Within SCM_MANAGER, lower level_number runs first (L2 before L3)
      // But the buyer's diagram shows L2..Ln are parallel options; we still sort ascending
      return (a.level_number ?? 0) - (b.level_number ?? 0);
    });

    // Clear existing progress (re-route)
    await supabase.from('vendor_approval_progress').delete().eq('vendor_id', vendor_id);

    // Renumber 1..N so the existing "active = lowest pending" logic continues to work
    const rows = eligible.map((l: any, idx: number) => ({
      vendor_id,
      level_id: l.id,
      level_number: idx + 1,
      status: 'pending',
    }));

    if (rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: 'No eligible levels after MSME filter' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: insErr } = await supabase.from('vendor_approval_progress').insert(rows);
    if (insErr) throw insErr;

    return new Response(JSON.stringify({ ok: true, levels_created: rows.length, msme: isMsme }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
