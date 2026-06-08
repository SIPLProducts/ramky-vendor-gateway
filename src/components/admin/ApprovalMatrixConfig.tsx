import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Save, ArrowRight, Loader2, UserCheck } from 'lucide-react';
import { useTenants } from '@/hooks/useTenant';

type Stage = 'SCM_MANAGER' | 'SCM_HEAD' | 'FINANCE_1' | 'FINANCE_2' | 'CEO_OFFICE';

interface UserOpt { id: string; full_name: string | null; email: string }

interface FlowState {
  scm_manager_user_id: string | null;
  scm_head_user_id: string | null;
  finance_1_user_id: string | null;
  finance_2_user_id: string | null;
  ceo_office_user_id: string | null;
  skip_scm_manager: boolean;
  skip_scm_head: boolean;
  skip_finance_1: boolean;
  skip_finance_2: boolean;
}

const EMPTY_FLOW: FlowState = {
  scm_manager_user_id: null,
  scm_head_user_id: null,
  finance_1_user_id: null,
  finance_2_user_id: null,
  ceo_office_user_id: null,
  skip_scm_manager: false,
  skip_scm_head: false,
  skip_finance_1: false,
  skip_finance_2: false,
};

const STAGE_DEFS: Array<{
  stage: Stage;
  label: string;
  userKey: keyof FlowState;
  skipKey: keyof FlowState | null;
  roleNames: string[];
  helper?: string;
}> = [
  { stage: 'SCM_MANAGER', label: 'SCM Manager', userKey: 'scm_manager_user_id', skipKey: 'skip_scm_manager', roleNames: ['SCM Manager'] },
  { stage: 'SCM_HEAD', label: 'SCM Head', userKey: 'scm_head_user_id', skipKey: 'skip_scm_head', roleNames: ['SCM Head'] },
  { stage: 'FINANCE_1', label: 'Finance 1', userKey: 'finance_1_user_id', skipKey: 'skip_finance_1', roleNames: ['Finance 1', 'Finance Approval'] },
  { stage: 'FINANCE_2', label: 'Finance 2', userKey: 'finance_2_user_id', skipKey: 'skip_finance_2', roleNames: ['Finance 2', 'Finance Approval'] },
  { stage: 'CEO_OFFICE', label: 'CEO Office', userKey: 'ceo_office_user_id', skipKey: null, roleNames: ['CEO Office'], helper: 'Runs only for MSME-registered domestic vendors.' },
];

interface Props { tenantId?: string | null }

export function ApprovalMatrixConfig({ tenantId: tenantIdProp }: Props = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: tenants = [] } = useTenants();
  const activeTenants = useMemo(() => tenants.filter((t) => t.is_active), [tenants]);

  const [internalTenantId, setInternalTenantId] = useState<string>('');
  const externallyControlled = tenantIdProp !== undefined;
  const tenantId = externallyControlled ? (tenantIdProp ?? '') : internalTenantId;

  const [buyers, setBuyers] = useState<UserOpt[]>([]);
  const [usersByRole, setUsersByRole] = useState<Record<string, UserOpt[]>>({});
  const [buyerId, setBuyerId] = useState<string>('');
  const [flow, setFlow] = useState<FlowState>(EMPTY_FLOW);
  const [existingFlowId, setExistingFlowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allFlows, setAllFlows] = useState<Array<{ id: string; buyer_user_id: string; flow: FlowState }>>([]);

  useEffect(() => {
    if (externallyControlled) return;
    if (activeTenants.length > 0 && !internalTenantId) setInternalTenantId(activeTenants[0].id);
  }, [activeTenants, internalTenantId, externallyControlled]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const allRoleNames = ['Buyer', ...Array.from(new Set(STAGE_DEFS.flatMap((s) => s.roleNames)))];
      const [{ data: roles }, { data: profiles }, ut] = await Promise.all([
        supabase.from('custom_roles').select('id, name').in('name', allRoleNames),
        supabase.from('profiles').select('id, full_name, email'),
        tenantId
          ? supabase.from('user_tenants').select('user_id').eq('tenant_id', tenantId)
          : Promise.resolve({ data: null as any }),
      ]);
      const roleMap = new Map((roles ?? []).map((r: any) => [r.id, r.name as string]));
      const profileMap = new Map<string, UserOpt>((profiles ?? []).map((p: any) => [p.id, p as UserOpt]));
      const tenantUserSet: Set<string> | null = ut?.data ? new Set((ut.data as any[]).map((r) => r.user_id)) : null;

      const { data: ucr } = await supabase
        .from('user_custom_roles')
        .select('user_id, custom_role_id')
        .in('custom_role_id', Array.from(roleMap.keys()));

      const byRoleName = new Map<string, Set<string>>();
      (ucr ?? []).forEach((r: any) => {
        const name = roleMap.get(r.custom_role_id);
        if (!name) return;
        const set = byRoleName.get(name) ?? new Set<string>();
        set.add(r.user_id);
        byRoleName.set(name, set);
      });

      const toOpts = (ids: Set<string> | undefined) =>
        Array.from(ids ?? [])
          .filter((id) => !tenantUserSet || tenantUserSet.has(id))
          .map((id) => profileMap.get(id))
          .filter((u): u is UserOpt => !!u)
          .sort((a, b) => (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email));

      setBuyers(toOpts(byRoleName.get('Buyer')));

      const grouped: Record<string, UserOpt[]> = {};
      STAGE_DEFS.forEach((def) => {
        const merged = new Set<string>();
        def.roleNames.forEach((rn) => byRoleName.get(rn)?.forEach((id) => merged.add(id)));
        grouped[def.stage] = toOpts(merged);
      });
      setUsersByRole(grouped);

      // Load existing flows for overview table
      const { data: flows } = await supabase
        .from('buyer_approval_flows')
        .select('*')
        .order('created_at', { ascending: false });
      setAllFlows(
        (flows ?? []).map((f: any) => ({
          id: f.id,
          buyer_user_id: f.buyer_user_id,
          flow: {
            scm_manager_user_id: f.scm_manager_user_id,
            scm_head_user_id: f.scm_head_user_id,
            finance_1_user_id: f.finance_1_user_id,
            finance_2_user_id: f.finance_2_user_id,
            ceo_office_user_id: f.ceo_office_user_id,
            skip_scm_manager: f.skip_scm_manager,
            skip_scm_head: f.skip_scm_head,
            skip_finance_1: f.skip_finance_1,
            skip_finance_2: f.skip_finance_2,
          },
        })),
      );
    } catch (err: any) {
      toast({ title: 'Failed to load', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [tenantId, toast]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const profileById = useMemo(() => {
    const m = new Map<string, UserOpt>();
    [...buyers, ...Object.values(usersByRole).flat()].forEach((u) => m.set(u.id, u));
    return m;
  }, [buyers, usersByRole]);

  // Load buyer flow when buyer changes
  useEffect(() => {
    if (!buyerId) { setFlow(EMPTY_FLOW); setExistingFlowId(null); return; }
    (async () => {
      const { data } = await supabase
        .from('buyer_approval_flows')
        .select('*')
        .eq('buyer_user_id', buyerId)
        .maybeSingle();
      if (data) {
        setExistingFlowId(data.id);
        setFlow({
          scm_manager_user_id: data.scm_manager_user_id,
          scm_head_user_id: data.scm_head_user_id,
          finance_1_user_id: data.finance_1_user_id,
          finance_2_user_id: data.finance_2_user_id,
          ceo_office_user_id: data.ceo_office_user_id,
          skip_scm_manager: data.skip_scm_manager,
          skip_scm_head: data.skip_scm_head,
          skip_finance_1: data.skip_finance_1,
          skip_finance_2: data.skip_finance_2,
        });
      } else {
        setExistingFlowId(null);
        setFlow(EMPTY_FLOW);
      }
    })();
  }, [buyerId]);

  const handleSave = async () => {
    if (!buyerId) {
      toast({ title: 'Select a buyer', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        buyer_user_id: buyerId,
        tenant_id: tenantId || null,
        ...flow,
        created_by: user?.id,
      };
      let error;
      if (existingFlowId) {
        ({ error } = await supabase.from('buyer_approval_flows').update(payload).eq('id', existingFlowId));
      } else {
        ({ error } = await supabase.from('buyer_approval_flows').insert(payload));
      }
      if (error) throw error;
      toast({ title: 'Approval flow saved' });
      await loadUsers();
      const { data } = await supabase
        .from('buyer_approval_flows')
        .select('id').eq('buyer_user_id', buyerId).maybeSingle();
      if (data) setExistingFlowId(data.id);
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateFlow = (patch: Partial<FlowState>) => setFlow((f) => ({ ...f, ...patch }));

  const buyerLabel = (id: string) => {
    const u = profileById.get(id);
    return u ? (u.full_name || u.email) : id.slice(0, 8);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserCheck className="h-4 w-4" /> Buyer-based Approval Chain
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Buyer</label>
              <Select value={buyerId} onValueChange={setBuyerId} disabled={loading}>
                <SelectTrigger><SelectValue placeholder="Select buyer" /></SelectTrigger>
                <SelectContent>
                  {buyers.length === 0 && <div className="p-2 text-xs text-muted-foreground">No users with the Buyer role.</div>}
                  {buyers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleSave} disabled={!buyerId || saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {existingFlowId ? 'Update Flow' : 'Save Flow'}
              </Button>
            </div>
          </div>

          {buyerId && (
            <>
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <span className="text-muted-foreground">Chain preview:</span>{' '}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge>Buyer: {buyerLabel(buyerId)}</Badge>
                  {STAGE_DEFS.map((def) => {
                    const uid = flow[def.userKey] as string | null;
                    const skipped = def.skipKey ? (flow[def.skipKey] as boolean) : false;
                    const inactive = !uid || skipped;
                    return (
                      <span key={def.stage} className="flex items-center gap-2">
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <Badge variant={inactive ? 'outline' : 'default'} className={inactive ? 'opacity-60' : ''}>
                          {def.label}
                          {skipped ? ' · skipped' : uid ? ` · ${buyerLabel(uid)}` : ' · not set'}
                        </Badge>
                      </span>
                    );
                  })}
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="secondary">SAP Sync</Badge>
                </div>
              </div>

              <div className="space-y-3">
                {STAGE_DEFS.map((def) => {
                  const opts = usersByRole[def.stage] ?? [];
                  const uid = flow[def.userKey] as string | null;
                  const skipped = def.skipKey ? (flow[def.skipKey] as boolean) : false;
                  return (
                    <div key={def.stage} className="grid grid-cols-1 md:grid-cols-[160px_1fr_auto] gap-3 items-end border rounded-md p-3">
                      <div>
                        <div className="text-sm font-medium">{def.label}</div>
                        {def.helper && <div className="text-xs text-muted-foreground mt-0.5">{def.helper}</div>}
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Approver</label>
                        <Select
                          value={uid ?? ''}
                          onValueChange={(v) => updateFlow({ [def.userKey]: v || null } as any)}
                          disabled={skipped}
                        >
                          <SelectTrigger><SelectValue placeholder={`Select ${def.label}`} /></SelectTrigger>
                          <SelectContent>
                            {opts.length === 0 && <div className="p-2 text-xs text-muted-foreground">No users with this role.</div>}
                            {opts.map((u) => (
                              <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {def.skipKey && (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={skipped}
                            onCheckedChange={(v) => updateFlow({ [def.skipKey!]: v } as any)}
                          />
                          <span className="text-xs text-muted-foreground">Skip</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Configured Buyers</span>
            <Badge variant="outline">{allFlows.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : allFlows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No buyer flows configured yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Buyer</TableHead>
                  <TableHead>SCM Mgr</TableHead>
                  <TableHead>SCM Head</TableHead>
                  <TableHead>Finance 1</TableHead>
                  <TableHead>Finance 2</TableHead>
                  <TableHead>CEO Office</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allFlows.map((f) => {
                  const cell = (uid: string | null, skipped: boolean) =>
                    skipped ? <span className="text-xs text-muted-foreground">skipped</span>
                      : uid ? buyerLabel(uid)
                      : <span className="text-xs text-muted-foreground">—</span>;
                  return (
                    <TableRow key={f.id} className="cursor-pointer" onClick={() => setBuyerId(f.buyer_user_id)}>
                      <TableCell className="font-medium">{buyerLabel(f.buyer_user_id)}</TableCell>
                      <TableCell>{cell(f.flow.scm_manager_user_id, f.flow.skip_scm_manager)}</TableCell>
                      <TableCell>{cell(f.flow.scm_head_user_id, f.flow.skip_scm_head)}</TableCell>
                      <TableCell>{cell(f.flow.finance_1_user_id, f.flow.skip_finance_1)}</TableCell>
                      <TableCell>{cell(f.flow.finance_2_user_id, f.flow.skip_finance_2)}</TableCell>
                      <TableCell>{cell(f.flow.ceo_office_user_id, false)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
