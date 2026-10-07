import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { requireAuthenticatedUser, authErrorResponse } from '../_shared/auth.ts';
import { assignedApprover, STATUS_ROUTING } from './routing.ts';

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});
const schema = z.object({ vendorIds: z.array(z.string().uuid()).min(1).max(100) });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const auth = await requireAuthenticatedUser(req);
  if (!auth.ok) return authErrorResponse(auth, corsHeaders);
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return reply({ error: 'Invalid vendor selection.' }, 400);
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    // Resolve visibility before privileged routing/profile lookups. Never trust
    // client-supplied status, tenant, buyer, or approver IDs.
    const { data: vendors, error } = await caller.from('vendors').select('id, status, tenant_id, invitation_id').in('id', parsed.data.vendorIds);
    if (error) throw error;
    if (!vendors?.length) return reply({ items: [] });
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const ids = vendors.map(v => v.id);
    const invitationIds = vendors.map(v => v.invitation_id).filter(Boolean);
    const { data: invites, error: inviteError } = await admin.from('vendor_invitations')
      .select('id, vendor_id, created_by, tenant_id, created_at')
      .or(`vendor_id.in.(${ids.join(',')})${invitationIds.length ? `,id.in.(${invitationIds.join(',')})` : ''}`)
      .order('created_at', { ascending: false });
    if (inviteError) throw inviteError;
    const buyers = [...new Set((invites ?? []).map(i => i.created_by).filter(Boolean))];
    const { data: flows, error: flowError } = buyers.length ? await admin.from('buyer_approval_flows')
      .select('*').in('buyer_user_id', buyers) : { data: [], error: null };
    if (flowError) throw flowError;
    // SAP has a shared work queue, not a single buyer-flow assignee. Resolve
    // eligible active team members using the same company scope as the portal.
    const needsSapTeam = vendors.some(v => ['pending_sap_sync', 'dms_sync_pending'].includes(v.status));
    let sapMembers: Array<{ userId: string; tenantIds: string[] }> = [];
    if (needsSapTeam) {
      const { data: roles, error: rolesError } = await admin.from('custom_roles').select('id, name').eq('is_active', true);
      if (rolesError) throw rolesError;
      const roleIds = (roles ?? []).filter(r => r.name.toLowerCase() === 'sap team').map(r => r.id);
      if (roleIds.length) {
        const { data: members, error: membersError } = await admin.from('user_custom_roles').select('user_id').in('custom_role_id', roleIds);
        if (membersError) throw membersError;
        const memberIds = [...new Set((members ?? []).map(m => m.user_id))];
        if (memberIds.length) {
          const { data: companies, error: companiesError } = await admin.from('user_tenants').select('user_id, tenant_id').in('user_id', memberIds);
          if (companiesError) throw companiesError;
          sapMembers = memberIds.map(userId => ({ userId, tenantIds: (companies ?? []).filter(c => c.user_id === userId).map(c => c.tenant_id) }));
        }
      }
    }
    const assignments = vendors.map(v => {
      if (['pending_sap_sync', 'dms_sync_pending'].includes(v.status)) {
        return { vendorId: v.id, approverIds: sapMembers.filter(m => !m.tenantIds.length || (v.tenant_id !== null && m.tenantIds.includes(v.tenant_id))).map(m => m.userId), skipped: false };
      }
      const invite = (invites ?? []).find(i => i.id === v.invitation_id)
        ?? (invites ?? []).find(i => i.vendor_id === v.id);
      const buyerId = invite?.created_by ?? null;
      const candidates = (flows ?? []).filter(f => f.buyer_user_id === buyerId);
      const tenantId = v.tenant_id ?? invite?.tenant_id;
      const exact = candidates.filter(f => f.tenant_id === tenantId);
      const generic = candidates.filter(f => f.tenant_id === null);
      // Ambiguous mappings must never select an arbitrary approver.
      // Existing approval actions are buyer-scoped. A single buyer flow remains
      // authoritative even when its company differs from the vendor company.
      const flow = candidates.length === 1 ? candidates[0]
        : exact.length === 1 ? exact[0]
        : exact.length === 0 && generic.length === 1 ? generic[0] : undefined;
      const routing = STATUS_ROUTING[v.status];
      const approverId = assignedApprover(v.status, buyerId, flow);
      return { vendorId: v.id, approverIds: approverId ? [approverId] : [], skipped: !!(routing && flow?.[routing.skip]) };
    });
    const userIds = [...new Set(assignments.flatMap(a => a.approverIds))];
    const { data: profiles, error: profileError } = userIds.length ? await admin.from('profiles')
      .select('id, full_name, email, status').in('id', userIds) : { data: [], error: null };
    if (profileError) throw profileError;
    const names = new Map((profiles ?? []).filter(p => p.status === 'active').map(p => [p.id, p.full_name?.trim() || p.email]));
    return reply({ items: assignments.map(a => ({ vendorId: a.vendorId, name: a.skipped ? 'Stage skipped' : a.approverIds.map(id => names.get(id)).filter(Boolean).sort().join(', ') || null })) });
  } catch {
    console.warn('Dashboard approver lookup failed.');
    return reply({ error: 'Could not load assigned approver names.' }, 500);
  }
});