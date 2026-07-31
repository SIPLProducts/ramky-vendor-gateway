import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STAGE_TO_FLOW_COL: Record<string, string | null> = {
  BUYER: null,
  SCM_MANAGER: 'scm_manager_user_id',
  SCM_HEAD: 'scm_head_user_id',
  FINANCE_1: 'finance_1_user_id',
  FINANCE_2: 'finance_2_user_id',
  CEO_OFFICE: 'ceo_office_user_id',
};

const STAGE_TO_REVIEW: Record<string, string> = {
  BUYER: 'buyer_review',
  SCM_MANAGER: 'scm_manager_review',
  SCM_HEAD: 'scm_head_review',
  FINANCE_1: 'finance_1_review',
  FINANCE_2: 'finance_2_review',
  CEO_OFFICE: 'ceo_office_review',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { progress_id, action, comments, force, classification } = await req.json();
    if (!progress_id || !['approve', 'reject'].includes(action)) {
      return new Response(JSON.stringify({ error: 'Invalid input' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const forceReject = force === true;

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

    const { data: progress } = await admin
      .from('vendor_approval_progress')
      .select('id, vendor_id, level_id, level_number, status, stage, started_at')
      .eq('id', progress_id).single();
    if (!progress) throw new Error('Progress not found');
    if (progress.status !== 'pending') throw new Error('Already actioned');

    const curStage = progress.stage ?? 'SCM_MANAGER';
    const isBuyerRow = curStage === 'BUYER';

    // Authorise
    let invitingBuyerId: string | null = null;
    if (isBuyerRow) {
      const { data: invite } = await admin
        .from('vendor_invitations').select('created_by').eq('vendor_id', progress.vendor_id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!invite || invite.created_by !== userId) throw new Error('You are not the buyer for this vendor');
      invitingBuyerId = invite.created_by ?? null;
    } else {
      const { data: invite } = await admin
        .from('vendor_invitations').select('created_by').eq('vendor_id', progress.vendor_id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!invite?.created_by) throw new Error('No inviting buyer recorded for vendor');
      invitingBuyerId = invite.created_by;
      const col = STAGE_TO_FLOW_COL[curStage];
      if (!col) throw new Error(`Unknown stage ${curStage}`);
      const { data: flow } = await admin
        .from('buyer_approval_flows').select(`${col}`).eq('buyer_user_id', invite.created_by).maybeSingle();
      if (!flow || (flow as any)[col] !== userId) {
        throw new Error('You are not configured as the approver for this stage');
      }
    }

    // Active row check (lowest pending)
    const { data: allProgress } = await admin
      .from('vendor_approval_progress')
      .select('id, level_number, status, stage, started_at')
      .eq('vendor_id', progress.vendor_id);
    const minPending = (allProgress ?? [])
      .filter((p) => p.status === 'pending')
      .reduce((m, p) => Math.min(m, p.level_number), Infinity);
    if (progress.level_number !== minPending) throw new Error('Lower-level approval still pending');

    const nowIso = new Date().toISOString();

    if (action === 'reject') {
      const vendorRejectionPatch: Record<string, unknown> = {
        last_rejection_comments: comments ?? null,
        last_rejection_stage: curStage,
        last_rejected_by: userId,
        last_rejected_at: nowIso,
      };

      if (isBuyerRow) {
        await admin.from('vendor_approval_progress').update({
          status: 'rejected', acted_by: userId, acted_at: nowIso, completed_at: nowIso, comments,
        }).eq('id', progress_id);
        const { error: historyError } = await admin.from('vendor_approval_history').insert({
          vendor_id: progress.vendor_id, stage: curStage, level_number: progress.level_number,
          action: 'rejected', comments: comments ?? null, acted_by: userId, acted_at: nowIso,
        });
        if (historyError) throw new Error(`Failed to record approval comment: ${historyError.message}`);
        await admin.from('vendors').update({ status: 'returned_to_vendor', ...vendorRejectionPatch }).eq('id', progress.vendor_id);
        await admin.from('audit_logs').insert({
          action: 'vendor_buyer_rejected', user_id: userId, vendor_id: progress.vendor_id, details: { comments },
        });
        try {
          const { data: vendorRow } = await admin
            .from('vendors').select('legal_name, primary_email, registered_email').eq('id', progress.vendor_id).single();
          const vendorEmail = vendorRow?.primary_email || vendorRow?.registered_email;
          if (vendorEmail) {
            await admin.functions.invoke('send-status-notification', {
              body: {
                vendorId: progress.vendor_id, newStatus: 'returned_to_vendor', previousStatus: 'buyer_review',
                vendorEmail, vendorName: vendorRow?.legal_name ?? 'Vendor', comments: comments ?? '', simulationMode: false,
              },
            });
          }
        } catch (e) { console.warn('send-status-notification failed', e); }
        return new Response(JSON.stringify({ ok: true, vendor_status: 'returned_to_vendor' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Non-buyer stage rejection: pre-flight buyer notification email first.
      const stageLabels: Record<string, string> = {
        SCM_MANAGER: 'SCM CO',
        SCM_HEAD: 'SCM Head',
        FINANCE_1: 'Finance 1',
        FINANCE_2: 'Finance 2',
        CEO_OFFICE: 'CEO Office',
      };

      let emailSent = false;
      let emailError: string | null = null;
      let buyerEmailUsed: string | null = null;

      if (invitingBuyerId) {
        try {
          const [{ data: buyerProfile }, { data: rejecterProfile }, { data: vendorRow }] = await Promise.all([
            admin.from('profiles').select('email, full_name').eq('id', invitingBuyerId).maybeSingle(),
            admin.from('profiles').select('email, full_name').eq('id', userId).maybeSingle(),
            admin.from('vendors')
              .select('legal_name, vendor_reference_number, vendor_code, id')
              .eq('id', progress.vendor_id).maybeSingle(),
          ]);
          const buyerEmail = (buyerProfile as any)?.email;
          if (!buyerEmail) {
            emailError = 'Buyer email not found in profile.';
          } else {
            buyerEmailUsed = buyerEmail;
            const vendorName = (vendorRow as any)?.legal_name ?? 'Vendor';
            const vendorRef = (vendorRow as any)?.vendor_reference_number
              ?? (vendorRow as any)?.vendor_code
              ?? String((vendorRow as any)?.id ?? progress.vendor_id).slice(0, 8);
            const rejecterName = (rejecterProfile as any)?.full_name ?? 'Approver';
            const rejecterEmail = (rejecterProfile as any)?.email ?? '';
            const stageLabel = stageLabels[curStage] ?? curStage;
            const rejectedAtIst = new Date(nowIso).toLocaleString('en-IN', {
              timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit', hour12: false,
            }) + ' IST';
            const esc = (s: string) => String(s ?? '')
              .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            const row = (k: string, v: string) =>
              `<tr><td style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;width:38%">${esc(k)}</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${esc(v)}</td></tr>`;
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
                  ${row('Rejection Remarks', comments ?? '—')}
                  ${row('Rejection Date & Time', rejectedAtIst)}
                </table>
                <p>Please log in to the Vendor Portal to review the remarks and resubmit the application.</p>
                <p style="color:#6b7280;font-size:12px;margin-top:24px">This is an automated notification from the Ramky Vendor Portal.</p>
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

      // If the email failed and the caller did not explicitly force, abort
      // the rejection so the vendor stays in the current stage.
      if (!emailSent && !forceReject) {
        console.warn('buyer rejection email failed; awaiting confirmation', emailError);
        return new Response(JSON.stringify({
          ok: false,
          email_sent: false,
          requires_confirmation: true,
          error: emailError ?? 'Unable to send rejection email.',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Proceed with rejection (email sent OR forced).
      await admin.from('vendor_approval_progress').update({
        status: 'rejected', acted_by: userId, acted_at: nowIso, completed_at: nowIso, comments,
      }).eq('id', progress_id);
      const { error: historyError } = await admin.from('vendor_approval_history').insert({
        vendor_id: progress.vendor_id, stage: curStage, level_number: progress.level_number,
        action: 'rejected', from_stage: curStage, comments: comments ?? null, acted_by: userId, acted_at: nowIso,
      });
      if (historyError) throw new Error(`Failed to record approval comment: ${historyError.message}`);
      await admin.from('vendor_approval_progress')
        .update({ status: 'cancelled', acted_at: nowIso, completed_at: nowIso })
        .eq('vendor_id', progress.vendor_id).eq('status', 'pending');
      await admin.from('vendors').update({ status: 'returned_to_buyer', ...vendorRejectionPatch }).eq('id', progress.vendor_id);
      await admin.from('audit_logs').insert({
        action: 'vendor_rejected_returned_to_buyer', user_id: userId, vendor_id: progress.vendor_id,
        details: { comments, from_stage: curStage },
      });
      try {
        await admin.from('audit_logs').insert({
          action: emailSent ? 'buyer_notified_rejection_email' : 'buyer_rejection_email_failed',
          user_id: userId,
          vendor_id: progress.vendor_id,
          details: { buyer_email: buyerEmailUsed, stage: curStage, email_error: emailError },
        });
      } catch (_) { /* ignore */ }

      return new Response(JSON.stringify({
        ok: true,
        vendor_status: 'returned_to_buyer',
        from_stage: curStage,
        email_sent: emailSent,
        email_error: emailSent ? null : emailError,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // APPROVE
    // If buyer provided classification, persist it before routing forward.
    if (isBuyerRow && classification && (
      Array.isArray(classification.material_group_vendors) || Array.isArray(classification.vendor_categories)
    )) {
      const mg = Array.isArray(classification.material_group_vendors) ? classification.material_group_vendors : [];
      const vc = Array.isArray(classification.vendor_categories) ? classification.vendor_categories : [];
      await admin.from('vendors').update({
        material_group_vendor: mg[0] ?? null,
        material_group_vendors: mg,
        vendor_category: vc[0] ?? null,
        vendor_categories: vc,
      }).eq('id', progress.vendor_id);
    }

    await admin.from('vendor_approval_progress').update({
      status: 'approved', acted_by: userId, acted_at: nowIso, completed_at: nowIso, comments,
    }).eq('id', progress_id);
    const { error: historyError } = await admin.from('vendor_approval_history').insert({
      vendor_id: progress.vendor_id, stage: curStage, level_number: progress.level_number,
      action: 'approved', comments: comments ?? null, acted_by: userId, acted_at: nowIso,
    });
    if (historyError) throw new Error(`Failed to record approval comment: ${historyError.message}`);

    const remaining = (allProgress ?? [])
      .filter((p) => p.status === 'pending' && p.id !== progress_id);

    if (remaining.length === 0) {
      await admin.from('vendors').update({
        status: 'pending_sap_sync',
        purchase_reviewed_by: userId,
        purchase_reviewed_at: nowIso,
      }).eq('id', progress.vendor_id);
      return new Response(JSON.stringify({ ok: true, vendor_status: 'pending_sap_sync' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const nextRow = remaining.reduce((min, p) => (p.level_number < min.level_number ? p : min), remaining[0]);
    const nextStage: string = (nextRow as any).stage ?? 'SCM_MANAGER';
    const nextStatus = STAGE_TO_REVIEW[nextStage] ?? 'scm_manager_review';

    await admin.from('vendor_approval_progress')
      .update({ started_at: nowIso })
      .eq('id', (nextRow as any).id)
      .is('started_at', null);

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
