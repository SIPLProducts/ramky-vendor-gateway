// Lets the SAP Team (or admin) reject a vendor at the SAP Sync stage and send
// it back to the inviting Buyer for correction. Sets vendors.status =
// 'returned_to_buyer', stores remarks, and notifies the buyer via SMTP using
// the same configuration as approval-stage rejections in
// process-approval-action. If the buyer email fails and the caller did not
// pass forceReject:true, the rejection is aborted so the SAP team can
// confirm/retry.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { requireAuthenticatedUser, authErrorResponse } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const row = (k: string, v: string) =>
  `<tr><td style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;width:38%">${esc(k)}</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${esc(v)}</td></tr>`;

function getName1(v: any): string {
  const clean = (x: any) => {
    const s = x == null ? '' : String(x).trim();
    return s && !['-', '—', 'n/a', 'na', 'none', 'null', 'undefined'].includes(s.toLowerCase()) ? s : '';
  };
  return clean(v?.trade_name) || clean(v?.legal_name) || clean(v?.account_holder_name) || 'Vendor';
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = await requireAuthenticatedUser(req, [
    'admin', 'sharvi_admin', 'SAP Team', 'sap team',
  ]);
  if (!auth.ok) return authErrorResponse(auth, corsHeaders);

  try {
    const body = await req.json();
    const vendorId: string | undefined = body.vendorId || body.vendor_id;
    const remarks: string = (body.remarks || body.comments || '').toString().trim();
    const forceReject: boolean = !!body.forceReject;

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
      .select('id, status, legal_name, trade_name, gstin, account_holder_name, reference_number, sap_vendor_code, tenant_id')
      .eq('id', vendorId).single();
    if (vErr || !vendor) throw new Error(vErr?.message || 'Vendor not found');

    // Identify the inviting buyer.
    const { data: invite } = await admin
      .from('vendor_invitations')
      .select('created_by, email')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle();

    const invitingBuyerId: string | null = (invite as any)?.created_by ?? null;

    // Build email -- same template as process-approval-action reject.
    let emailSent = false;
    let emailError: string | null = null;
    let buyerEmailUsed: string | null = null;

    if (invitingBuyerId) {
      try {
        const [{ data: buyerProfile }, { data: rejecterProfile }] = await Promise.all([
          admin.from('profiles').select('email, full_name').eq('id', invitingBuyerId).maybeSingle(),
          admin.from('profiles').select('email, full_name').eq('id', auth.userId).maybeSingle(),
        ]);
        const buyerEmail = (buyerProfile as any)?.email ?? (invite as any)?.email ?? null;
        if (!buyerEmail) {
          emailError = 'Buyer email not found in profile.';
        } else {
          buyerEmailUsed = buyerEmail;
          const vendorName = getName1(vendor);
          const vendorRef = (vendor as any).reference_number
            ?? (vendor as any).sap_vendor_code
            ?? String(vendor.id).slice(0, 8);
          const rejecterName = (rejecterProfile as any)?.full_name ?? 'SAP Team';
          const rejecterEmail = (rejecterProfile as any)?.email ?? '';
          const stageLabel = 'SAP Team';
          const rejectedAtIst = new Date().toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: false,
          }) + ' IST';
          const html = `
            <div style="font-family:Arial,sans-serif;color:#111;max-width:640px;margin:auto">
              <h2 style="color:#b91c1c;margin:0 0 12px">Vendor Application Rejected</h2>
              <p>Dear ${esc((buyerProfile as any)?.full_name ?? 'Buyer')},</p>
              <p>The vendor application below has been <b>rejected</b> at the <b>${esc(stageLabel)}</b> stage and routed back to you for correction.</p>
              <table style="border-collapse:collapse;width:100%;margin:12px 0;font-size:14px">
                ${row('Vendor Name', vendorName)}
                ${row('Vendor Reference Number', vendorRef)}
                ${row('Rejected By', `${rejecterName}${rejecterEmail ? ` <${rejecterEmail}>` : ''}`)}
                ${row('Rejection Stage', stageLabel)}
                ${row('Rejection Remarks', remarks)}
                ${row('Rejection Date & Time', rejectedAtIst)}
              </table>
              <p>Please log in to the Vyapaar Portal to review the remarks, update the vendor information, and resubmit. Once resubmitted, the application will restart the approval workflow (SCM CO → SCM Head → Finance 1 → Finance 2 → ...).</p>
              <p style="margin-top:16px;font-size:13px;color:#374151">For any queries, please contact <a href="mailto:vyapaarsupport@ramky.com" style="color:#1e3a5f;text-decoration:none;font-weight:600">vyapaarsupport@ramky.com</a>.</p>
              <p style="color:#6b7280;font-size:12px;margin-top:24px">This is an automated notification from the Ramky Vyapaar Portal.</p>
            </div>`;
          const { data: emailResp, error: emailInvokeErr } = await admin.functions.invoke('send-smtp-email', {
            body: { to: buyerEmail, subject: 'Vendor Application Rejected', html },
          });
          if (emailInvokeErr) {
            emailError = emailInvokeErr.message ?? 'SMTP invoke failed';
          } else if (emailResp && (emailResp as any).success === false) {
            emailError = (emailResp as any).error ?? 'SMTP send failed';
          } else {
            emailSent = true;
          }
        }
      } catch (e: any) {
        emailError = e?.message ?? String(e);
      }
    } else {
      emailError = 'No inviting buyer recorded for vendor.';
    }

    // Abort unless email sent or caller forced.
    if (!emailSent && !forceReject) {
      return new Response(JSON.stringify({
        ok: false,
        email_sent: false,
        requires_confirmation: true,
        error: emailError ?? 'Unable to send rejection email.',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

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

    const { error: historyError } = await admin.from('vendor_approval_history').insert({
      vendor_id: vendorId, stage: 'SAP_TEAM', level_number: null,
      action: 'returned_to_buyer', from_stage: 'SAP_TEAM',
      comments: remarks ?? null, acted_by: auth.userId, acted_at: nowIso,
    });
    if (historyError) console.warn('history log failed (non-blocking):', historyError.message);

    try {
      await admin.from('audit_logs').insert({
        action: emailSent ? 'buyer_notified_rejection_email' : 'buyer_rejection_email_failed',
        user_id: auth.userId,
        vendor_id: vendorId,
        details: { buyer_email: buyerEmailUsed, stage: 'SAP_TEAM', email_error: emailError },
      });
    } catch (_) { /* ignore */ }

    return new Response(JSON.stringify({
      ok: true,
      success: true,
      vendor_status: 'returned_to_buyer',
      email_sent: emailSent,
      email_error: emailSent ? null : emailError,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Unexpected error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
