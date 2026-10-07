import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { requireAuthenticatedUser, authErrorResponse } from '../_shared/auth.ts';
import { assignedApprover } from './routing.ts';

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
    const { data: invites, error: inviteError } = await admin.from('vendor_invitations')
      .select('id, vendor_id, created_by, tenant_id, created_at').in('vendor_id', ids).order('created_at', { ascending: false });
    if (inviteError) throw inviteError;
    const buyers = [...new Set((invites ?? []).map(i => i.created_by).filter(Boolean))];
    const { data: flows, error: flowError } = buyers.length ? await admin.from('buyer_approval_flows')
      .select('*').in('buyer_user_id', buyers) : { data: [], error: null };
    if (flowError) throw flowError;
    const assignments = vendors.map(v => {
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
      return { vendorId: v.id, approverId: assignedApprover(v.status, buyerId, flow) };
    });
    const userIds = [...new Set(assignments.map(a => a.approverId).filter((id): id is string => !!id))];
    const { data: profiles, error: profileError } = userIds.length ? await admin.from('profiles')
      .select('id, full_name').in('id', userIds) : { data: [], error: null };
    if (profileError) throw profileError;
    const names = new Map((profiles ?? []).map(p => [p.id, p.full_name]));
    return reply({ items: assignments.map(a => ({ vendorId: a.vendorId, name: a.approverId ? names.get(a.approverId) ?? null : null })) });
  } catch {
    console.warn('Dashboard approver lookup failed.');
    return reply({ error: 'Could not load assigned approver names.' }, 500);
  }
});