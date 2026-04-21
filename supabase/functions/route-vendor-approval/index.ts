import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

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

    // Get vendor + tenant
    const { data: vendor, error: vErr } = await supabase
      .from('vendors').select('id, tenant_id, status').eq('id', vendor_id).single();
    if (vErr || !vendor) throw vErr ?? new Error('Vendor not found');
    if (!vendor.tenant_id) {
      return new Response(JSON.stringify({ error: 'Vendor has no tenant' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Read matrix
    const { data: levels, error: lErr } = await supabase
      .from('approval_matrix_levels')
      .select('id, level_number')
      .eq('tenant_id', vendor.tenant_id)
      .eq('is_active', true)
      .order('level_number', { ascending: true });
    if (lErr) throw lErr;
    if (!levels || levels.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: 'No matrix configured; skipping' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clear existing progress (re-route)
    await supabase.from('vendor_approval_progress').delete().eq('vendor_id', vendor_id);

    const rows = levels.map((l) => ({
      vendor_id,
      level_id: l.id,
      level_number: l.level_number,
      status: 'pending',
    }));
    const { error: insErr } = await supabase.from('vendor_approval_progress').insert(rows);
    if (insErr) throw insErr;

    return new Response(JSON.stringify({ ok: true, levels_created: levels.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
