// Lets the SAP Team (or admin) reject a vendor at the SAP Sync stage and send
// it back to the inviting Buyer for correction. Sets vendors.status =
// 'returned_to_buyer', stores remarks, and notifies the buyer via email.
//
// Once the buyer re-approves (via buyer-reapprove-rejected), the entire
// approval matrix is re-seeded so the vendor restarts the workflow
// (SCM Manager -> SCM Head -> Finance 1 -> Finance 2 -> ...).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { requireAuthenticatedUser, authErrorResponse } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = await requireAuthenticatedUser(req, [
    'admin',
    'sharvi_admin',
    'SAP Team',
    'sap team',
  ]);
  if (!auth.ok) return authErrorResponse(auth, corsHeaders);

  try {
    const body = await req.json();
    const vendorId: string | undefined = body.vendorId || body.vendor_id;
    const remarks: string = (body.remarks || body.comments || '').toString().trim();

    if (!vendorId) {
      return new Response(JSON.stringify({ error: 'vendorId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!remarks) {
      return new Response(JSON.stringify({ error: 'Remarks are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: vendor, error: vErr } = await admin
      .from('vendors')
      .select('id, status, legal_name, trade_name, primary_email, registered_email, tenant_id')
      .eq('id', vendorId).single();
    if (vErr || !vendor) throw new Error(vErr?.message || 'Vendor not found');

    const nowIso = new Date().toISOString();

    // Move vendor back to the inviting buyer for correction.
    const { error: updErr } = await admin.from('vendors').update({
      status: 'returned_to_buyer',
      last_rejection_comments: remarks,
      last_rejection_stage: 'SAP_TEAM',
      last_rejected_by: auth.userId,
      last_rejected_at: nowIso,
    } as any).eq('id', vendorId);
    if (updErr) throw updErr;

    // Clear any pending approval rows so the workflow restarts cleanly when
    // the buyer re-approves (buyer-reapprove-rejected re-seeds the matrix).
    await admin
      .from('vendor_approval_progress')
      .delete()
      .eq('vendor_id', vendorId);

    await admin.from('audit_logs').insert({
      action: 'sap_team_return_to_buyer',
      user_id: auth.userId,
      vendor_id: vendorId,
      details: { remarks, stage: 'SAP_TEAM' },
    });

    // Identify the inviting buyer and email them.
    const { data: invite } = await admin
      .from('vendor_invitations')
      .select('created_by, email')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle();

    let buyerEmail: string | null = invite?.email ?? null;
    let buyerName = 'Buyer';
    if (invite?.created_by) {
      const { data: prof } = await admin
        .from('profiles')
        .select('email, full_name')
        .eq('id', invite.created_by)
        .maybeSingle();
      if (prof?.email) buyerEmail = prof.email;
      if (prof?.full_name) buyerName = prof.full_name;
    }

    if (buyerEmail) {
      try {
        await admin.functions.invoke('send-status-notification', {
          body: {
            vendorId,
            newStatus: 'returned_to_buyer',
            previousStatus: vendor.status,
            vendorEmail: buyerEmail,
            vendorName: buyerName,
            comments: `SAP Team returned this vendor for correction.\n\nRemarks: ${remarks}`,
            simulationMode: false,
          },
        });
      } catch (e) {
        console.warn('[sap-team-return-to-buyer] notification failed', e);
      }
    }

    return new Response(JSON.stringify({ ok: true, success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Unexpected error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
