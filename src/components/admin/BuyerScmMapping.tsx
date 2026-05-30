import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Link2, Plus, Loader2 } from 'lucide-react';


interface Props { tenantId: string | null; }
interface UserOpt { id: string; full_name: string | null; email: string; }
interface MappingRow {
  id: string;
  buyer_user_id: string;
  scm_manager_user_id: string;
  include_scm_stages: boolean;
  created_at: string;
  buyer?: UserOpt;
  scm?: UserOpt;
}


const SCM_ROLE = 'SCM Manager';
const BUYER_ROLE = 'Buyer';

export function BuyerScmMapping({ tenantId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scmUsers, setScmUsers] = useState<UserOpt[]>([]);
  const [buyerUsers, setBuyerUsers] = useState<UserOpt[]>([]);
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [scmId, setScmId] = useState('');
  const [buyerId, setBuyerId] = useState('');
  const [includeScm, setIncludeScm] = useState(true);
  const [aliasTenantNames, setAliasTenantNames] = useState<string[]>([]);
  const [effectiveSaveTenantId, setEffectiveSaveTenantId] = useState<string | null>(null);


  const fetchAll = async <T,>(
    build: (from: number, to: number) => any,
    pageSize = 1000,
  ): Promise<T[]> => {
    const all: T[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await build(from, from + pageSize - 1);
      if (error) throw error;
      const rows = (data ?? []) as T[];
      all.push(...rows);
      if (rows.length < pageSize) break;
      from += pageSize;
    }
    return all;
  };

  // Normalize tenant name for alias matching: lowercase, strip punctuation,
  // and collapse common company suffix variants (limited, ltd, pvt, private, etc.).
  const normalizeTenantName = (raw: string): string => {
    const SUFFIXES = ['limited', 'ltd', 'private', 'pvt', 'company', 'co', 'corporation', 'corp', 'inc', 'llp', 'plc'];
    let s = (raw || '')
      .toLowerCase()
      .replace(/[.,'"`()&\-_/\\]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    let changed = true;
    while (changed) {
      changed = false;
      for (const suf of SUFFIXES) {
        if (s.endsWith(' ' + suf) || s === suf) {
          s = s.slice(0, s.length - suf.length).trim();
          changed = true;
        }
      }
    }
    return s;
  };

  const resolveTenantAliases = async (
    selectedTenantId: string,
  ): Promise<{ ids: string[]; aliasNames: string[] }> => {
    const { data: all, error } = await supabase
      .from('tenants')
      .select('id, name, code, is_active')
      .eq('is_active', true);
    if (error || !all) return { ids: [selectedTenantId], aliasNames: [] };
    const selected = all.find((t) => t.id === selectedTenantId);
    if (!selected) return { ids: [selectedTenantId], aliasNames: [] };
    const targetNorm = normalizeTenantName(selected.name);
    const targetCode = (selected.code ?? '').trim().toLowerCase();
    const matches = all.filter((t) => {
      if (t.id === selected.id) return true;
      const sameCode = !!targetCode && (t.code ?? '').trim().toLowerCase() === targetCode;
      const sameNorm = !!targetNorm && normalizeTenantName(t.name) === targetNorm;
      return sameCode || sameNorm;
    });
    return {
      ids: matches.map((t) => t.id),
      aliasNames: matches.filter((t) => t.id !== selected.id).map((t) => t.name),
    };
  };

  const loadData = async () => {
    setLoading(true);
    try {
      let tenantIds: string[] = [];
      let aliasNames: string[] = [];
      if (tenantId) {
        const r = await resolveTenantAliases(tenantId);
        tenantIds = r.ids;
        aliasNames = r.aliasNames;
      }
      setAliasTenantNames(aliasNames);

      const [rolesRes, profilesRes, userTenantsData, mappingsRes] = await Promise.all([
        supabase.from('custom_roles').select('id,name').in('name', [SCM_ROLE, BUYER_ROLE]),
        supabase.from('profiles').select('id, full_name, email'),
        tenantIds.length > 0
          ? fetchAll<{ user_id: string; tenant_id: string }>((from, to) =>
              supabase.from('user_tenants').select('user_id, tenant_id').in('tenant_id', tenantIds).range(from, to),
            )
          : fetchAll<{ user_id: string; tenant_id: string }>((from, to) =>
              supabase.from('user_tenants').select('user_id, tenant_id').range(from, to),
            ),
        tenantIds.length > 0
          ? supabase.from('buyer_scm_mappings').select('*').in('tenant_id', tenantIds).order('created_at', { ascending: false })
          : supabase.from('buyer_scm_mappings').select('*').order('created_at', { ascending: false }),
      ]);
      if (rolesRes.error) throw rolesRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (mappingsRes.error) throw mappingsRes.error;

      const scmRoleId = rolesRes.data?.find((r) => r.name === SCM_ROLE)?.id;
      const buyerRoleId = rolesRes.data?.find((r) => r.name === BUYER_ROLE)?.id;

      const ucrData = await fetchAll<{ user_id: string; custom_role_id: string }>((from, to) =>
        supabase
          .from('user_custom_roles')
          .select('user_id, custom_role_id')
          .in('custom_role_id', [scmRoleId, buyerRoleId].filter(Boolean) as string[])
          .range(from, to),
      );

      const profileMap = new Map<string, UserOpt>(
        (profilesRes.data ?? []).map((p) => [p.id, p as UserOpt])
      );
      const tenantUserSet = tenantIds.length > 0
        ? new Set(userTenantsData.map((ut) => ut.user_id))
        : null;

      const scmIds = new Set<string>();
      const buyerIds = new Set<string>();
      ucrData.forEach((r) => {
        if (r.custom_role_id === scmRoleId) scmIds.add(r.user_id);
        if (r.custom_role_id === buyerRoleId) buyerIds.add(r.user_id);
      });

      const filterByTenant = (id: string) => !tenantUserSet || tenantUserSet.has(id);
      const toOpts = (ids: Set<string>) =>
        Array.from(ids)
          .filter(filterByTenant)
          .map((id) => profileMap.get(id))
          .filter((u): u is UserOpt => !!u)
          .sort((a, b) => (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email));

      setScmUsers(toOpts(scmIds));
      setBuyerUsers(toOpts(buyerIds));

      // Save new mappings against the tenant id that actually has assigned users.
      let saveTenantId: string | null = tenantId ?? null;
      if (tenantId && tenantIds.length > 1) {
        const utCountByTenant = new Map<string, number>();
        userTenantsData.forEach((ut) => {
          utCountByTenant.set(ut.tenant_id, (utCountByTenant.get(ut.tenant_id) ?? 0) + 1);
        });
        if ((utCountByTenant.get(tenantId) ?? 0) === 0) {
          const fallback = tenantIds.find((id) => (utCountByTenant.get(id) ?? 0) > 0);
          if (fallback) saveTenantId = fallback;
        }
      }
      setEffectiveSaveTenantId(saveTenantId);

      const enriched: MappingRow[] = (mappingsRes.data ?? []).map((m: any) => ({
        ...m,
        buyer: profileMap.get(m.buyer_user_id),
        scm: profileMap.get(m.scm_manager_user_id),
      }));
      setMappings(enriched);
    } catch (err: any) {
      toast({ title: 'Failed to load mappings', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); /* eslint-disable-next-line */ }, [tenantId]);

  const handleSave = async () => {
    const saveTenantId = effectiveSaveTenantId ?? tenantId;
    if (!saveTenantId) {
      toast({ title: 'Select a tenant', description: 'Mappings must be scoped to a tenant.', variant: 'destructive' });
      return;
    }
    if (!scmId || !buyerId) {
      toast({ title: 'Both fields required', variant: 'destructive' });
      return;
    }
    const existing = mappings.find((m) => m.buyer_user_id === buyerId);
    if (existing) {
      toast({
        title: 'Buyer already mapped',
        description: `This buyer is already mapped to ${label(existing.scm)}. Remove the existing mapping first.`,
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('buyer_scm_mappings').insert({
        tenant_id: saveTenantId,
        buyer_user_id: buyerId,
        scm_manager_user_id: scmId,
        include_scm_stages: includeScm,
        created_by: user?.id,
      });

      if (error) {
        if (error.code === '23505') {
          toast({ title: 'Buyer already mapped', description: 'This buyer already has an SCM Manager assigned.', variant: 'destructive' });
        } else throw error;

      } else {
        toast({ title: 'Mapping saved' });
        setScmId(''); setBuyerId(''); setIncludeScm(true);
        await loadData();
      }
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this mapping?')) return;
    const { error } = await supabase.from('buyer_scm_mappings').delete().eq('id', id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Mapping removed' });
    await loadData();
  };

  const handleToggleScm = async (id: string, next: boolean) => {
    setMappings((prev) => prev.map((m) => (m.id === id ? { ...m, include_scm_stages: next } : m)));
    const { error } = await supabase
      .from('buyer_scm_mappings')
      .update({ include_scm_stages: next })
      .eq('id', id);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      await loadData();
    }
  };


  const label = (u?: UserOpt) => (u ? (u.full_name || u.email) : '—');

  return (
    <div className="space-y-6">
      {!tenantId && (
        <div className="text-sm text-muted-foreground">
          Select a specific tenant in the scope above to add new mappings. Showing mappings across all tenants.
        </div>
      )}
      {tenantId && aliasTenantNames.length > 0 && (
        <div className="text-xs rounded-md border bg-muted/30 p-3 text-muted-foreground">
          Including users and mappings from equivalent company record{aliasTenantNames.length === 1 ? '' : 's'}:{' '}
          <span className="font-medium text-foreground">{aliasTenantNames.join(', ')}</span>.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" /> Add Buyer ↔ SCM Manager Mapping
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="text-xs text-muted-foreground">SCM Manager</label>
              <Select value={scmId} onValueChange={setScmId}>
                <SelectTrigger><SelectValue placeholder="Select SCM Manager" /></SelectTrigger>
                <SelectContent>
                  {scmUsers.length === 0 && <div className="p-2 text-xs text-muted-foreground">No users with SCM Manager role. Assign it in the Users tab.</div>}
                  {scmUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Buyer</label>
              <Select value={buyerId} onValueChange={setBuyerId}>
                <SelectTrigger><SelectValue placeholder="Select Buyer" /></SelectTrigger>
                <SelectContent>
                  {buyerUsers.length === 0 && <div className="p-2 text-xs text-muted-foreground">No users with Buyer role. Assign it in the Users tab.</div>}
                  {buyerUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Save Mapping
            </Button>
          </div>
          <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
            <Switch id="include-scm" checked={includeScm} onCheckedChange={setIncludeScm} />
            <div className="space-y-0.5">
              <label htmlFor="include-scm" className="text-sm font-medium cursor-pointer">
                Include SCM Manager / SCM Head in approval flow
              </label>
              <p className="text-xs text-muted-foreground">
                When off, vendors invited by this buyer skip SCM stages and go directly to Finance 1.
              </p>
            </div>
          </div>
        </CardContent>

      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Existing Mappings</span>
            <Badge variant="outline">{mappings.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : mappings.length === 0 ? (
            <div className="text-sm text-muted-foreground">No mappings yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SCM Manager</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead className="w-56">Include SCM in flow</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-20 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{label(m.scm)}</TableCell>
                    <TableCell>{label(m.buyer)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={m.include_scm_stages}
                          onCheckedChange={(v) => handleToggleScm(m.id, v)}
                        />
                        <span className="text-xs text-muted-foreground">
                          {m.include_scm_stages ? 'With SCM' : 'Skip SCM → Finance 1'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(m.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

          )}
        </CardContent>
      </Card>
    </div>
  );
}
