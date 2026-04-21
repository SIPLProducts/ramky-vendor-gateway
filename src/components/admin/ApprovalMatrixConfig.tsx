import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Plus, Save, Trash2, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ApproverPicker } from './ApproverPicker';

interface Tenant { id: string; name: string; }
interface Level {
  id?: string;
  level_number: number;
  level_name: string;
  designation: string;
  approval_mode: 'ANY' | 'ALL';
  approver_user_ids: string[];
  _new?: boolean;
  _dirty?: boolean;
}

export function ApprovalMatrixConfig() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState<string>('');
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('tenants').select('id, name').eq('is_active', true).order('name');
      setTenants(data ?? []);
      if (data && data.length > 0 && !tenantId) setTenantId(data[0].id);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    loadMatrix(tenantId);
  }, [tenantId]);

  const loadMatrix = async (tid: string) => {
    setLoading(true);
    const [{ data: lvls }, { data: appr }] = await Promise.all([
      supabase.from('approval_matrix_levels').select('*').eq('tenant_id', tid).order('level_number', { ascending: false }),
      supabase.from('approval_matrix_approvers').select('level_id, user_id'),
    ]);
    const apprByLevel = new Map<string, string[]>();
    (appr ?? []).forEach((a) => {
      const arr = apprByLevel.get(a.level_id) ?? [];
      arr.push(a.user_id);
      apprByLevel.set(a.level_id, arr);
    });
    setLevels(
      (lvls ?? []).map((l) => ({
        id: l.id,
        level_number: l.level_number,
        level_name: l.level_name,
        designation: l.designation ?? '',
        approval_mode: (l.approval_mode as 'ANY' | 'ALL') ?? 'ANY',
        approver_user_ids: apprByLevel.get(l.id) ?? [],
      }))
    );
    setLoading(false);
  };

  const addLevel = () => {
    const nextNum = levels.length === 0 ? 1 : Math.max(...levels.map((l) => l.level_number)) + 1;
    setLevels([
      { level_number: nextNum, level_name: '', designation: '', approval_mode: 'ANY', approver_user_ids: [], _new: true, _dirty: true },
      ...levels,
    ]);
  };

  const updateLevel = (idx: number, patch: Partial<Level>) => {
    setLevels((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch, _dirty: true } : l)));
  };

  const removeLevel = (idx: number) => {
    setLevels((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveAll = async () => {
    // validations
    if (levels.length === 0) {
      toast({ title: 'Add at least one level', variant: 'destructive' });
      return;
    }
    for (const l of levels) {
      if (!l.level_name.trim()) {
        toast({ title: 'All levels need a name', variant: 'destructive' });
        return;
      }
      if (l.approver_user_ids.length === 0) {
        toast({ title: `Level ${l.level_number} has no approvers`, variant: 'destructive' });
        return;
      }
    }

    setSaving(true);
    try {
      // Renumber sequentially based on order in array (top of list = highest level)
      // Order was: highest at top (index 0). So highest level_number should be at top.
      const sortedDesc = [...levels];
      const total = sortedDesc.length;
      const renumbered = sortedDesc.map((l, idx) => ({ ...l, level_number: total - idx }));

      // Upsert each level and replace approvers
      for (const l of renumbered) {
        let levelId = l.id;
        if (!levelId) {
          const { data, error } = await supabase
            .from('approval_matrix_levels')
            .insert({
              tenant_id: tenantId,
              level_number: l.level_number,
              level_name: l.level_name,
              designation: l.designation || null,
              approval_mode: l.approval_mode,
            })
            .select('id')
            .single();
          if (error) throw error;
          levelId = data.id;
        } else {
          const { error } = await supabase
            .from('approval_matrix_levels')
            .update({
              level_number: l.level_number,
              level_name: l.level_name,
              designation: l.designation || null,
              approval_mode: l.approval_mode,
            })
            .eq('id', levelId);
          if (error) throw error;
        }
        // Replace approvers
        await supabase.from('approval_matrix_approvers').delete().eq('level_id', levelId);
        if (l.approver_user_ids.length > 0) {
          const rows = l.approver_user_ids.map((uid) => ({ level_id: levelId!, user_id: uid, added_by: user?.id }));
          const { error } = await supabase.from('approval_matrix_approvers').insert(rows);
          if (error) throw error;
        }
      }

      // Delete removed levels
      const { data: existing } = await supabase
        .from('approval_matrix_levels')
        .select('id')
        .eq('tenant_id', tenantId);
      const keepIds = new Set(renumbered.filter((r) => r.id).map((r) => r.id!));
      const toDelete = (existing ?? []).filter((e) => !keepIds.has(e.id)).map((e) => e.id);
      if (toDelete.length > 0) {
        await supabase.from('approval_matrix_levels').delete().in('id', toDelete);
      }

      await supabase.from('audit_logs').insert({
        action: 'approval_matrix_saved',
        user_id: user?.id,
        details: { tenant_id: tenantId, level_count: renumbered.length },
      });

      toast({ title: 'Approval matrix saved' });
      await loadMatrix(tenantId);
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end justify-between">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Tenant</label>
          <Select value={tenantId} onValueChange={setTenantId}>
            <SelectTrigger className="w-72"><SelectValue placeholder="Select tenant" /></SelectTrigger>
            <SelectContent>
              {tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={addLevel}><Plus className="h-4 w-4 mr-1" /> Add Level</Button>
          <Button onClick={saveAll} disabled={saving}>
            <Save className="h-4 w-4 mr-1" /> {saving ? 'Saving...' : 'Save Matrix'}
          </Button>
        </div>
      </div>

      {/* Chain preview */}
      {levels.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Approval Chain (Vendor Submitted → SAP Sync)</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline">Vendor Submitted</Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              {[...levels].reverse().map((l, i) => (
                <span key={i} className="flex items-center gap-2">
                  <Badge>L{l.level_number} · {l.level_name || '(unnamed)'}</Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </span>
              ))}
              <Badge variant="secondary">SAP Sync</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Levels (top = first to act, bottom = final approver)</CardTitle></CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Level</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Approvers</TableHead>
                  <TableHead className="w-32">Mode</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                  ))
                ) : levels.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No levels configured. Click "Add Level" to start.
                  </TableCell></TableRow>
                ) : (
                  levels.map((l, idx) => (
                    <TableRow key={idx}>
                      <TableCell><Badge variant="outline">L{l.level_number}</Badge></TableCell>
                      <TableCell>
                        <Input value={l.level_name} onChange={(e) => updateLevel(idx, { level_name: e.target.value })}
                          placeholder="e.g. SCM Head" className="h-8" />
                      </TableCell>
                      <TableCell>
                        <Input value={l.designation} onChange={(e) => updateLevel(idx, { designation: e.target.value })}
                          placeholder="e.g. Manager" className="h-8" />
                      </TableCell>
                      <TableCell>
                        <ApproverPicker
                          selectedUserIds={l.approver_user_ids}
                          onChange={(ids) => updateLevel(idx, { approver_user_ids: ids })}
                          tenantId={tenantId}
                        />
                      </TableCell>
                      <TableCell>
                        <Select value={l.approval_mode} onValueChange={(v) => updateLevel(idx, { approval_mode: v as 'ANY' | 'ALL' })}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ANY">ANY one</SelectItem>
                            <SelectItem value="ALL">ALL must</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => removeLevel(idx)} className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
