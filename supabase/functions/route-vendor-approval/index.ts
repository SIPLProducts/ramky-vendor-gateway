import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { requireAuthenticatedUser, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Thin wrapper around the SECURITY DEFINER seed_vendor_approval_progress() RPC.
// The actual seeding logic lives in the database so it can also run from the
// AFTER UPDATE trigger on vendors and stay in sync with both code paths.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = await requireAuthenticatedUser(req, ['admin', 'sharvi_admin', 'customer_admin', 'finance', 'purchase', 'vendor']);
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

    const { data, error } = await supabase.rpc('seed_vendor_approval_progress', { _vendor_id: vendor_id });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    const levelsCreated = (row?.levels_created as number | undefined) ?? 0;
    const vendorStatus = (row?.vendor_status as string | null | undefined) ?? null;

    if (levelsCreated === 0) {
      return new Response(JSON.stringify({ ok: true, message: 'No matrix configured; skipping' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, levels_created: levelsCreated, vendor_status: vendorStatus }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
