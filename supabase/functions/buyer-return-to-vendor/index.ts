// Lets the inviting buyer (or admin) send a rejected vendor application
// back to the vendor for edit + resubmit.
//
// Sets vendors.status = 'returned_to_vendor', stores remarks, and emails
// the vendor.
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
    const { vendor_id, comments } = await req.json();
    if (!vendor_id) {
      return new Response(JSON.stringify({ error: 'vendor_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Authorise: caller must be the inviting buyer or an admin/customer_admin/sharvi_admin.
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
      .select('id, status, legal_name, primary_email, registered_email, last_rejection_comments, last_rejection_stage')
      .eq('id', vendor_id).single();
    if (!vendor) throw new Error('Vendor not found');

    const combinedRemarks = [
      vendor.last_rejection_comments ? `Approver remarks: ${vendor.last_rejection_comments}` : null,
      comments ? `Buyer remarks: ${comments}` : null,
    ].filter(Boolean).join('\n\n');

    await admin.from('vendors').update({
      status: 'returned_to_vendor',
      last_rejection_comments: combinedRemarks || vendor.last_rejection_comments,
      last_rejected_by: auth.userId,
      last_rejected_at: new Date().toISOString(),
    }).eq('id', vendor_id);

    await admin.from('audit_logs').insert({
      action: 'vendor_returned_to_vendor',
      user_id: auth.userId,
      vendor_id,
      details: { comments, prior_stage: vendor.last_rejection_stage },
    });

    // Best-effort vendor notification via existing status-notification fn.
    const vendorEmail = vendor.primary_email || vendor.registered_email;
    if (vendorEmail) {
      try {
        await admin.functions.invoke('send-status-notification', {
          body: {
            to: vendorEmail,
            vendor_name: vendor.legal_name,
            status: 'returned_to_vendor',
            remarks: combinedRemarks,
          },
        });
      } catch (e) {
        console.warn('send-status-notification failed', e);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
