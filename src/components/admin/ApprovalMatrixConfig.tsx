import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Save, Trash2, ArrowRight, ChevronsUpDown, AlertTriangle, CheckCircle2, Database, FlaskConical, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTenants, useTenantUsersWithRoles, useTenantUserCounts, type TenantUserWithRole, type AppRole } from '@/hooks/useTenant';
import { useQueryClient } from '@tanstack/react-query';

const APP_ROLES: AppRole[] = ['sharvi_admin', 'admin', 'customer_admin', 'finance', 'purchase', 'approver', 'vendor'];
import { AssignUsersToTenantDialog } from './AssignUsersToTenantDialog';
import { UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Row {
  rowKey: string;
  level_id?: string;
  level_number: number;
  level_name: string;
  designation: string;
  approval_mode: 'ANY' | 'ALL';
  user_id: string | null;
}

interface RowError {
  rowKey: string;
  level_number: number;
  message: string;
}

interface DbState {
  levels: number;
  approvers: number;
  lastUpdated: string | null;
}

const newRowKey = () => Math.random().toString(36).slice(2, 10);

export function ApprovalMatrixConfig() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: tenants = [] } = useTenants();
  const activeTenants = useMemo(() => tenants.filter((t) => t.is_active), [tenants]);

  const [tenantId, setTenantId] = useState<string>('');
  const [pendingTenantId, setPendingTenantId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingWrite, setTestingWrite] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<string>('[]');
  const [dbState, setDbState] = useState<DbState>({ levels: 0, approvers: 0, lastUpdated: null });
  const [lastSaveResult, setLastSaveResult] = useState<{ levels: number; approvers: number; at: number } | null>(null);
  const [pendingRoleChanges, setPendingRoleChanges] = useState<Record<string, AppRole>>({});
  const [canEditRoles, setCanEditRoles] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
      const roles = (data ?? []).map((r) => r.role);
      setCanEditRoles(roles.includes('sharvi_admin') || roles.includes('admin'));
    })();
  }, [user?.id]);

  const isDirty = useMemo(
    () => JSON.stringify(rows.map(({ rowKey, ...r }) => r)) !== savedSnapshot || Object.keys(pendingRoleChanges).length > 0,
    [rows, savedSnapshot, pendingRoleChanges]
  );

  const { data: tenantUsers = [], isLoading: usersLoading } = useTenantUsersWithRoles(tenantId || null);
  const { data: tenantUserCounts = {} } = useTenantUserCounts();
  const userById = useMemo(() => new Map(tenantUsers.map((u) => [u.user_id, u])), [tenantUsers]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const currentTenant = activeTenants.find((t) => t.id === tenantId);

  // Auto-clear save banner after 10s
  useEffect(() => {
    if (!lastSaveResult) return;
    const t = setTimeout(() => setLastSaveResult(null), 10_000);
    return () => clearTimeout(t);
  }, [lastSaveResult]);

  // Beforeunload guard
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  useEffect(() => {
    if (activeTenants.length > 0 && !tenantId) {
      setTenantId(activeTenants[0].id);
    }
  }, [activeTenants, tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    loadMatrix(tenantId);
    loadDbState(tenantId);
  }, [tenantId]);

  const loadDbState = useCallback(async (tid: string) => {
    const { data: lvls } = await supabase
      .from('approval_matrix_levels')
      .select('id, updated_at')
      .eq('tenant_id', tid);
    const levelIds = (lvls ?? []).map((l) => l.id);
    let approverCount = 0;
    if (levelIds.length > 0) {
      const { count } = await supabase
        .from('approval_matrix_approvers')
        .select('*', { count: 'exact', head: true })
        .in('level_id', levelIds);
      approverCount = count ?? 0;
    }
    const lastUpdated = (lvls ?? [])
      .map((l) => l.updated_at)
      .sort()
      .pop() ?? null;
    setDbState({ levels: lvls?.length ?? 0, approvers: approverCount, lastUpdated });
  }, []);

  const loadMatrix = async (tid: string) => {
    setLoading(true);
    console.log('[ApprovalMatrix] loading matrix for tenant', tid);
    const [{ data: lvls }, { data: appr }] = await Promise.all([
      supabase
        .from('approval_matrix_levels')
        .select('*')
        .eq('tenant_id', tid)
        .order('level_number', { ascending: false }),
      supabase.from('approval_matrix_approvers').select('level_id, user_id'),
    ]);

    const flat: Row[] = [];
    (lvls ?? []).forEach((l) => {
      const approvers = (appr ?? []).filter((a) => a.level_id === l.id);
      if (approvers.length === 0) {
        flat.push({
          rowKey: newRowKey(),
          level_id: l.id,
          level_number: l.level_number,
          level_name: l.level_name,
          designation: l.designation ?? '',
          approval_mode: (l.approval_mode as 'ANY' | 'ALL') ?? 'ANY',
          user_id: null,
        });
      } else {
        approvers.forEach((a) => {
          flat.push({
            rowKey: newRowKey(),
            level_id: l.id,
            level_number: l.level_number,
            level_name: l.level_name,
            designation: l.designation ?? '',
            approval_mode: (l.approval_mode as 'ANY' | 'ALL') ?? 'ANY',
            user_id: a.user_id,
          });
        });
      }
    });
    setRows(flat);
    setSavedSnapshot(JSON.stringify(flat.map(({ rowKey, ...r }) => r)));
    setLoading(false);
    console.log('[ApprovalMatrix] hydrated', flat.length, 'rows');
  };

  const levelNumbers = useMemo(() => {
    const set = new Set(rows.map((r) => r.level_number));
    const max = rows.length === 0 ? 0 : Math.max(...rows.map((r) => r.level_number));
    const arr = Array.from(set).sort((a, b) => b - a);
    if (!arr.includes(max + 1)) arr.unshift(max + 1);
    return arr;
  }, [rows]);

  const addRow = () => {
    const nextLevel = rows.length === 0 ? 1 : Math.max(...rows.map((r) => r.level_number));
    setRows((prev) => [
      ...prev,
      {
        rowKey: newRowKey(),
        level_number: nextLevel,
        level_name: '',
        designation: '',
        approval_mode: 'ANY',
        user_id: null,
      },
    ]);
  };

  const updateRow = (key: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.rowKey === key ? { ...r, ...patch } : r)));
  };

  const updateLevelMeta = (level_number: number, patch: Partial<Pick<Row, 'level_name' | 'designation' | 'approval_mode'>>) => {
    setRows((prev) => prev.map((r) => (r.level_number === level_number ? { ...r, ...patch } : r)));
  };

  const removeRow = (key: string) => setRows((prev) => prev.filter((r) => r.rowKey !== key));

  const grouped = useMemo(() => {
    const map = new Map<number, Row[]>();
    rows.forEach((r) => {
      const arr = map.get(r.level_number) ?? [];
      arr.push(r);
      map.set(r.level_number, arr);
    });
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
  }, [rows]);

  // Inline per-row validation
  const rowErrors = useMemo<RowError[]>(() => {
    const errs: RowError[] = [];
    const seenPairs = new Set<string>();
    rows.forEach((r) => {
      if (!r.level_number || r.level_number < 1) {
        errs.push({ rowKey: r.rowKey, level_number: r.level_number, message: 'Invalid Level #' });
      }
      if (!r.user_id) {
        errs.push({ rowKey: r.rowKey, level_number: r.level_number, message: 'No approver selected' });
      } else {
        const key = `${r.level_number}::${r.user_id}`;
        if (seenPairs.has(key)) {
          errs.push({ rowKey: r.rowKey, level_number: r.level_number, message: 'Duplicate approver at this level' });
        }
        seenPairs.add(key);
      }
    });
    return errs;
  }, [rows]);

  const errorRowKeys = useMemo(() => new Set(rowErrors.map((e) => e.rowKey)), [rowErrors]);
  const canSave = !!tenantId && rows.length > 0 && rowErrors.length === 0 && !saving;

  const totalApprovers = rows.filter((r) => r.user_id).length;

  const saveAll = async () => {
    if (!canSave) {
      toast({ title: 'Cannot save', description: 'Fix the highlighted rows first.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    console.log('[ApprovalMatrix] validating', rows.length, 'rows across', grouped.length, 'levels');
    try {
      const keptLevelIds: string[] = [];
      let savedApprovers = 0;
      for (const [levelNumber, group] of grouped) {
        const first = group[0];
        let levelId = first.level_id;
        const levelPayload = {
          tenant_id: tenantId,
          level_number: levelNumber,
          level_name: first.level_name,
          designation: first.designation || null,
          approval_mode: first.approval_mode,
        };
        console.log('[ApprovalMatrix] upserting level', levelNumber, levelPayload);
        if (levelId) {
          const { error } = await supabase.from('approval_matrix_levels').update(levelPayload).eq('id', levelId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from('approval_matrix_levels')
            .insert(levelPayload)
            .select('id')
            .single();
          if (error) throw error;
          levelId = data.id;
        }
        keptLevelIds.push(levelId!);

        await supabase.from('approval_matrix_approvers').delete().eq('level_id', levelId);
        const approverRows = group
          .filter((r) => r.user_id)
          .map((r) => ({ level_id: levelId!, user_id: r.user_id!, added_by: user?.id }));
        console.log('[ApprovalMatrix] inserting', approverRows.length, 'approvers for level', levelNumber);
        if (approverRows.length > 0) {
          const { error } = await supabase.from('approval_matrix_approvers').insert(approverRows);
          if (error) throw error;
          savedApprovers += approverRows.length;
        }
      }

      const { data: existing } = await supabase
        .from('approval_matrix_levels')
        .select('id')
        .eq('tenant_id', tenantId);
      const keepSet = new Set(keptLevelIds);
      const toDelete = (existing ?? []).filter((e) => !keepSet.has(e.id)).map((e) => e.id);
      if (toDelete.length > 0) {
        console.log('[ApprovalMatrix] deleting', toDelete.length, 'orphan levels');
        await supabase.from('approval_matrix_levels').delete().in('id', toDelete);
      }

      await supabase.from('audit_logs').insert({
        action: 'approval_matrix_saved',
        user_id: user?.id,
        details: { tenant_id: tenantId, level_count: grouped.length, row_count: rows.length },
      });

      console.log('[ApprovalMatrix] done — saved', grouped.length, 'levels and', savedApprovers, 'approvers');
      setLastSaveResult({ levels: grouped.length, approvers: savedApprovers, at: Date.now() });
      toast({ title: 'Approval matrix saved', description: `${grouped.length} level(s), ${savedApprovers} approver(s)` });
      await Promise.all([loadMatrix(tenantId), loadDbState(tenantId)]);
    } catch (e: any) {
      console.error('[ApprovalMatrix] Save failed:', e);
      toast({
        title: 'Save failed',
        description: e?.message ?? 'Unknown error — check browser console for details.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const testWriteAccess = async () => {
    if (!tenantId) return;
    setTestingWrite(true);
    console.log('[ApprovalMatrix] test write access for tenant', tenantId);
    try {
      const sentinel = {
        tenant_id: tenantId,
        level_number: 9999,
        level_name: '__sentinel_test__',
        designation: null,
        approval_mode: 'ANY',
      };
      const { data, error } = await supabase
        .from('approval_matrix_levels')
        .insert(sentinel)
        .select('id')
        .single();
      if (error) throw error;
      const id = data.id;
      const { error: delErr } = await supabase.from('approval_matrix_levels').delete().eq('id', id);
      if (delErr) throw delErr;
      console.log('[ApprovalMatrix] test write OK');
      toast({ title: 'Write access OK', description: 'Insert + delete succeeded for this tenant.' });
    } catch (e: any) {
      console.error('[ApprovalMatrix] test write failed:', e);
      toast({
        title: 'Write access FAILED',
        description: e?.message ?? 'Check console for full error.',
        variant: 'destructive',
      });
    } finally {
      setTestingWrite(false);
    }
  };

  const handleTenantChange = (next: string) => {
    if (isDirty && next !== tenantId) {
      setPendingTenantId(next);
    } else {
      setTenantId(next);
    }
  };

  const confirmTenantSwitch = () => {
    if (pendingTenantId) {
      setTenantId(pendingTenantId);
      setPendingTenantId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end justify-between">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Tenant</label>
          <Select value={tenantId} onValueChange={handleTenantChange}>
            <SelectTrigger className="w-72"><SelectValue placeholder="Select tenant" /></SelectTrigger>
            <SelectContent>
              {activeTenants.map((t) => {
                const count = tenantUserCounts[t.id] ?? 0;
                return (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} · {count} user{count === 1 ? '' : 's'}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {isDirty && !loading && (
            <Badge variant="destructive" className="animate-pulse">Unsaved changes</Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={testWriteAccess}
            disabled={!tenantId || testingWrite}
            title="Insert + delete a sentinel row to verify RLS / network"
          >
            {testingWrite ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FlaskConical className="h-4 w-4 mr-1" />}
            Test write access
          </Button>
          <Button variant="outline" onClick={addRow} disabled={!tenantId}>
            <Plus className="h-4 w-4 mr-1" /> Add Row
          </Button>
          <Button onClick={saveAll} disabled={!canSave} variant={isDirty ? 'default' : 'secondary'}>
            <Save className="h-4 w-4 mr-1" /> {saving ? 'Saving...' : 'Save All'}
          </Button>
        </div>
      </div>

      {/* DB state strip */}
      {tenantId && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-md border bg-muted/30 text-sm">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            {dbState.levels === 0 && dbState.approvers === 0 ? (
              <span className="text-muted-foreground">
                <strong className="text-foreground">Nothing saved yet</strong> for this tenant in the database.
              </span>
            ) : (
              <span>
                <strong>Currently in database:</strong> {dbState.levels} level{dbState.levels === 1 ? '' : 's'} ·{' '}
                {dbState.approvers} approver{dbState.approvers === 1 ? '' : 's'}
                {dbState.lastUpdated && (
                  <span className="text-muted-foreground"> · last updated {new Date(dbState.lastUpdated).toLocaleString()}</span>
                )}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Save success banner */}
      {lastSaveResult && (
        <div className="flex items-center gap-2 p-3 rounded-md border border-green-500/40 bg-green-500/10 text-sm">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span>
            <strong>Saved · {lastSaveResult.levels} level{lastSaveResult.levels === 1 ? '' : 's'} · {lastSaveResult.approvers} approver{lastSaveResult.approvers === 1 ? '' : 's'}</strong>{' '}
            persisted to database.
          </span>
        </div>
      )}

      {/* Diagnostics panel */}
      {tenantId && !loading && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {rowErrors.length === 0 && rows.length > 0 ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Diagnostics — all rows valid
                </>
              ) : (
                <>
                  <AlertTriangle className={cn('h-4 w-4', rowErrors.length > 0 ? 'text-destructive' : 'text-muted-foreground')} />
                  Diagnostics
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>Rows: <strong className="text-foreground">{rows.length}</strong></span>
              <span>Levels: <strong className="text-foreground">{grouped.length}</strong></span>
              <span>Approvers selected: <strong className="text-foreground">{totalApprovers}</strong></span>
              <span>Issues: <strong className={cn(rowErrors.length > 0 ? 'text-destructive' : 'text-foreground')}>{rowErrors.length}</strong></span>
            </div>
            {rowErrors.length > 0 ? (
              <ul className="text-xs space-y-1 mt-2 max-h-32 overflow-auto">
                {rowErrors.map((e, i) => (
                  <li key={i} className="text-destructive">
                    • Level {e.level_number}: {e.message}
                  </li>
                ))}
              </ul>
            ) : rows.length === 0 ? (
              <p className="text-xs text-muted-foreground">Add at least one row to begin.</p>
            ) : (
              <p className="text-xs text-muted-foreground">Ready to save. Click <strong>Save All</strong> to persist.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Chain preview */}
      {grouped.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Approval Chain (Vendor Submitted → SAP Sync)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline">Vendor Submitted</Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              {[...grouped].reverse().map(([num, group]) => (
                <span key={num} className="flex items-center gap-2">
                  <Badge>
                    L{num} · {group[0]?.level_name || '(unnamed)'} · {group.length} approver{group.length > 1 ? 's' : ''}
                  </Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </span>
              ))}
              <Badge variant="secondary">SAP Sync</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Missing-users banner */}
      {tenantId && !usersLoading && tenantUsers.length === 0 && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-md border border-dashed border-destructive/50 bg-destructive/5">
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <strong>No users assigned to this tenant.</strong>{' '}
              <span className="text-muted-foreground">Approver dropdowns will be empty until you assign at least one user.</span>
            </div>
          </div>
          <Button size="sm" onClick={() => setAssignDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1" /> Assign Users
          </Button>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Approvers (one row per person · group rows by Level # for co-approvers)</CardTitle>
          {tenantId && tenantUsers.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setAssignDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-1" /> Manage Users
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table className="min-w-[1100px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Level #</TableHead>
                  <TableHead className="w-40">Level Name</TableHead>
                  <TableHead className="w-36">Designation</TableHead>
                  <TableHead className="w-64">Approver</TableHead>
                  <TableHead className="w-56">Email</TableHead>
                  <TableHead className="w-28">Role</TableHead>
                  <TableHead className="w-28">Mode</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                      No approvers configured for this tenant. Click <strong>+ Add Row</strong> to start.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => {
                    const selectedUser = r.user_id ? userById.get(r.user_id) : null;
                    const hasError = errorRowKeys.has(r.rowKey);
                    return (
                      <TableRow key={r.rowKey} className={cn(hasError && 'bg-destructive/5')}>
                        <TableCell>
                          <Select
                            value={String(r.level_number)}
                            onValueChange={(v) => updateRow(r.rowKey, { level_number: Number(v) })}
                          >
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {levelNumbers.map((n) => (
                                <SelectItem key={n} value={String(n)}>L{n}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={r.level_name}
                            onChange={(e) => updateLevelMeta(r.level_number, { level_name: e.target.value })}
                            placeholder="e.g. SCM Head"
                            className={cn('h-8', !r.level_name.trim() && 'border-destructive')}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={r.designation}
                            onChange={(e) => updateLevelMeta(r.level_number, { designation: e.target.value })}
                            placeholder="e.g. Manager"
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <ApproverCombobox
                            users={tenantUsers}
                            loading={usersLoading}
                            value={r.user_id}
                            invalid={!r.user_id}
                            excludeIds={rows
                              .filter((x) => x.rowKey !== r.rowKey && x.level_number === r.level_number && x.user_id)
                              .map((x) => x.user_id!)}
                            onSelect={(uid) => updateRow(r.rowKey, { user_id: uid })}
                            onAssignUsers={() => setAssignDialogOpen(true)}
                          />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground truncate max-w-[14rem]">
                          {selectedUser?.email ?? '—'}
                        </TableCell>
                        <TableCell>
                          {selectedUser?.role ? (
                            <Badge variant="outline" className="text-xs">{selectedUser.role}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={r.approval_mode}
                            onValueChange={(v) => updateLevelMeta(r.level_number, { approval_mode: v as 'ANY' | 'ALL' })}
                          >
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ANY">ANY one</SelectItem>
                              <SelectItem value="ALL">ALL must</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeRow(r.rowKey)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {tenantId && (
        <AssignUsersToTenantDialog
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          tenantId={tenantId}
          tenantName={currentTenant?.name}
        />
      )}

      {/* Tenant switch confirmation */}
      <AlertDialog open={!!pendingTenantId} onOpenChange={(open) => !open && setPendingTenantId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved approval matrix changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes for <strong>{currentTenant?.name}</strong>. Switching tenants will discard them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay here</AlertDialogCancel>
            <AlertDialogAction onClick={confirmTenantSwitch}>Discard & switch</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface ComboProps {
  users: TenantUserWithRole[];
  loading: boolean;
  value: string | null;
  invalid?: boolean;
  excludeIds: string[];
  onSelect: (userId: string) => void;
  onAssignUsers?: () => void;
}

function ApproverCombobox({ users, loading, value, invalid, excludeIds, onSelect, onAssignUsers }: ComboProps) {
  const [open, setOpen] = useState(false);
  const selected = users.find((u) => u.user_id === value) ?? null;
  const exclude = new Set(excludeIds);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'h-8 w-full justify-between font-normal',
            !selected && 'text-muted-foreground',
            invalid && !selected && 'border-destructive'
          )}
        >
          <span className="truncate flex items-center gap-1.5">
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}
            {loading
              ? 'Loading users…'
              : selected
              ? (selected.full_name ?? selected.email)
              : 'Select approver…'}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 ml-2 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[20rem] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search by name or email…" />
          <CommandList>
            {loading ? (
              <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading users…
              </div>
            ) : users.length === 0 ? (
              <div className="p-4 text-center space-y-2">
                <p className="text-sm text-muted-foreground">No users assigned to this tenant.</p>
                {onAssignUsers && (
                  <Button size="sm" onClick={onAssignUsers}>
                    <UserPlus className="h-3.5 w-3.5 mr-1" /> Assign Users
                  </Button>
                )}
              </div>
            ) : (
              <CommandEmpty>No matching users.</CommandEmpty>
            )}
            {!loading && users.length > 0 && (
              <CommandGroup>
                {users.map((u) => {
                  const disabled = exclude.has(u.user_id);
                  return (
                    <CommandItem
                      key={u.user_id}
                      value={`${u.full_name ?? ''} ${u.email}`}
                      disabled={disabled}
                      onSelect={() => {
                        if (disabled) return;
                        onSelect(u.user_id);
                        setOpen(false);
                      }}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{u.full_name ?? '—'}</div>
                        <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                      </div>
                      {u.role && (
                        <Badge variant="outline" className="text-[10px] shrink-0">{u.role}</Badge>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
