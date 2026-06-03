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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
import { Plus, Save, Trash2, ArrowRight, AlertTriangle, CheckCircle2, Database, FlaskConical, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTenants, useTenantUserCounts } from '@/hooks/useTenant';
import { cn } from '@/lib/utils';
import { formatStageLevel } from '@/lib/approvalLabels';

type Stage = 'SCM_MANAGER' | 'SCM_HEAD' | 'FINANCE_1' | 'FINANCE_2' | 'CEO_OFFICE';

const STAGE_LABELS: Record<Stage, string> = {
  SCM_MANAGER: 'SCM Manager',
  SCM_HEAD: 'SCM Head',
  FINANCE_1: 'Finance 1',
  FINANCE_2: 'Finance 2',
  CEO_OFFICE: 'CEO Office',
};

const STAGE_ORDER: Stage[] = ['SCM_MANAGER', 'SCM_HEAD', 'FINANCE_1', 'FINANCE_2', 'CEO_OFFICE'];

interface Row {
  rowKey: string;
  level_id?: string;
  approver_id?: string;
  level_number: number;
  approval_mode: 'ANY' | 'ALL';
  approver_name: string;
  approver_email: string;
  stage: Stage;
  requires_msme: boolean;
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
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ApprovalMatrixConfigProps {
  tenantId?: string | null;
}

export function ApprovalMatrixConfig({ tenantId: tenantIdProp }: ApprovalMatrixConfigProps = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: tenants = [] } = useTenants();
  const activeTenants = useMemo(() => tenants.filter((t) => t.is_active), [tenants]);
  const externallyControlled = tenantIdProp !== undefined;

  const [internalTenantId, setInternalTenantId] = useState<string>('');
  const tenantId = externallyControlled ? (tenantIdProp ?? '') : internalTenantId;
  const setTenantId = (v: string) => { if (!externallyControlled) setInternalTenantId(v); };
  const [pendingTenantId, setPendingTenantId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [activeStage, setActiveStage] = useState<Stage>('SCM_MANAGER');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingWrite, setTestingWrite] = useState(false);
  const [resolvingUsers, setResolvingUsers] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<string>('[]');
  const [dbState, setDbState] = useState<DbState>({ levels: 0, approvers: 0, lastUpdated: null });
  const [lastSaveResult, setLastSaveResult] = useState<{ levels: number; approvers: number; at: number } | null>(null);

  const isDirty = useMemo(
    () => JSON.stringify(rows.map(({ rowKey, ...r }) => r)) !== savedSnapshot,
    [rows, savedSnapshot]
  );

  const { data: tenantUserCounts = {} } = useTenantUserCounts();
  const currentTenant = activeTenants.find((t) => t.id === tenantId);

  useEffect(() => {
    if (!lastSaveResult) return;
    const t = setTimeout(() => setLastSaveResult(null), 10_000);
    return () => clearTimeout(t);
  }, [lastSaveResult]);

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
    if (externallyControlled) return;
    if (activeTenants.length > 0 && !internalTenantId) {
      setInternalTenantId(activeTenants[0].id);
    }
  }, [activeTenants, internalTenantId, externallyControlled]);

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
    const { data: lvls } = await supabase
      .from('approval_matrix_levels')
      .select('*')
      .eq('tenant_id', tid)
      .order('level_number', { ascending: true });

    const levelIds = (lvls ?? []).map((l) => l.id);
    let appr: any[] = [];
    if (levelIds.length > 0) {
      const { data } = await supabase
        .from('approval_matrix_approvers')
        .select('id, level_id, user_id, approver_name, approver_email')
        .in('level_id', levelIds);
      appr = data ?? [];
    }

    const legacyUserIds = appr.filter((a) => a.user_id && (!a.approver_name || !a.approver_email)).map((a) => a.user_id);
    let profileMap = new Map<string, { full_name: string | null; email: string }>();
    if (legacyUserIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name, email').in('id', legacyUserIds);
      profileMap = new Map((profs ?? []).map((p) => [p.id, { full_name: p.full_name, email: p.email }]));
    }

    const flat: Row[] = [];
    (lvls ?? []).forEach((l) => {
      const approvers = appr.filter((a) => a.level_id === l.id);
      const stage = ((l as any).stage as Stage) ?? 'SCM_MANAGER';
      if (approvers.length === 0) {
        flat.push({
          rowKey: newRowKey(),
          level_id: l.id,
          level_number: l.level_number,
          approval_mode: (l.approval_mode as 'ANY' | 'ALL') ?? 'ANY',
          approver_name: '',
          approver_email: '',
          stage,
          requires_msme: !!(l as any).requires_msme,
        });
      } else {
        approvers.forEach((a) => {
          const prof = a.user_id ? profileMap.get(a.user_id) : undefined;
          flat.push({
            rowKey: newRowKey(),
            level_id: l.id,
            approver_id: a.id,
            level_number: l.level_number,
            approval_mode: (l.approval_mode as 'ANY' | 'ALL') ?? 'ANY',
            approver_name: a.approver_name ?? prof?.full_name ?? '',
            approver_email: a.approver_email ?? prof?.email ?? '',
            stage,
            requires_msme: !!(l as any).requires_msme,
          });
        });
      }
    });
    setRows(flat);
    setSavedSnapshot(JSON.stringify(flat.map(({ rowKey, ...r }) => r)));
    setLoading(false);
  };

  // Rows for the active stage tab only
  const stageRows = useMemo(() => rows.filter((r) => r.stage === activeStage), [rows, activeStage]);

  // Level numbers available within the active stage (each stage is independent)
  const activeStageLevels = useMemo(() => {
    const stageRowsLocal = rows.filter((r) => r.stage === activeStage);
    const set = new Set(stageRowsLocal.map((r) => r.level_number));
    const max = stageRowsLocal.length === 0 ? 0 : Math.max(...stageRowsLocal.map((r) => r.level_number));
    const arr = Array.from(set).sort((a, b) => a - b);
    if (!arr.includes(max + 1)) arr.push(max + 1);
    return arr;
  }, [rows, activeStage]);

  const stageCounts = useMemo(() => {
    const c: Record<Stage, number> = { SCM_MANAGER: 0, SCM_HEAD: 0, FINANCE_1: 0, FINANCE_2: 0, CEO_OFFICE: 0 };
    rows.forEach((r) => { c[r.stage] = (c[r.stage] ?? 0) + 1; });
    return c;
  }, [rows]);

  const addRow = () => {
    // Each stage is independent: new approver defaults to L1, user can change.
    const existing = rows.filter((r) => r.stage === activeStage);
    const nextLevel = existing.length === 0 ? 1 : Math.max(...existing.map((r) => r.level_number));
    setRows((prev) => [
      ...prev,
      {
        rowKey: newRowKey(),
        level_number: nextLevel,
        approval_mode: 'ANY',
        approver_name: '',
        approver_email: '',
        stage: activeStage,
        requires_msme: activeStage === 'CEO_OFFICE',
      },
    ]);
  };

  const addLevel = () => {
    const existing = rows.filter((r) => r.stage === activeStage);
    const nextLevel = existing.length === 0 ? 1 : Math.max(...existing.map((r) => r.level_number)) + 1;
    setRows((prev) => [
      ...prev,
      {
        rowKey: newRowKey(),
        level_number: nextLevel,
        approval_mode: 'ANY',
        approver_name: '',
        approver_email: '',
        stage: activeStage,
        requires_msme: activeStage === 'CEO_OFFICE',
      },
    ]);
  };

  const updateRow = (key: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.rowKey === key ? { ...r, ...patch } : r)));
  };

  const updateLevelMode = (stage: Stage, level_number: number, mode: 'ANY' | 'ALL') => {
    setRows((prev) => prev.map((r) =>
      r.stage === stage && r.level_number === level_number ? { ...r, approval_mode: mode } : r
    ));
  };

  const removeRow = (key: string) => setRows((prev) => prev.filter((r) => r.rowKey !== key));

  const rowErrors = useMemo<RowError[]>(() => {
    const errs: RowError[] = [];
    const seenEmailPerLevel = new Map<string, number>();
    rows.forEach((r, idx) => {
      const rowNum = idx + 1;
      const name = r.approver_name.trim();
      if (!name) errs.push({ rowKey: r.rowKey, level_number: r.level_number, message: `${STAGE_LABELS[r.stage]} · Name required` });
      else if (name.length > 100) errs.push({ rowKey: r.rowKey, level_number: r.level_number, message: `${STAGE_LABELS[r.stage]} · Name too long` });
      const email = r.approver_email.trim();
      if (!email) errs.push({ rowKey: r.rowKey, level_number: r.level_number, message: `${STAGE_LABELS[r.stage]} · Email required` });
      else if (email.length > 255 || !EMAIL_RE.test(email)) errs.push({ rowKey: r.rowKey, level_number: r.level_number, message: `${STAGE_LABELS[r.stage]} · Invalid email` });
      else {
        const key = `${r.stage}::${r.level_number}::${email.toLowerCase()}`;
        if (seenEmailPerLevel.has(key)) errs.push({ rowKey: r.rowKey, level_number: r.level_number, message: `${STAGE_LABELS[r.stage]} · Duplicate email` });
        seenEmailPerLevel.set(key, rowNum);
      }
    });
    return errs;
  }, [rows]);

  const errorRowKeys = useMemo(() => new Set(rowErrors.map((e) => e.rowKey)), [rowErrors]);
  const canSave = !!tenantId && rows.length > 0 && rowErrors.length === 0 && !saving;
  const totalApprovers = rows.filter((r) => r.approver_email.trim() && r.approver_name.trim()).length;

  // Build canonical save plan: every stage is independent and supports multiple
  // levels. Within a stage we preserve the user's chosen level ordering (L1, L2…)
  // and assign a globally unique level_number across the whole chain so the
  // existing "lowest pending level acts first" logic continues to work.
  const buildSavePlan = () => {
    const plan: { level_number: number; stage: Stage; approval_mode: 'ANY' | 'ALL'; rows: Row[]; stage_level: number }[] = [];
    let counter = 1;
    STAGE_ORDER.forEach((stage) => {
      const stageRowsLocal = rows.filter((r) => r.stage === stage);
      if (stageRowsLocal.length === 0) return;
      const groups = new Map<number, Row[]>();
      stageRowsLocal.forEach((r) => {
        const arr = groups.get(r.level_number) ?? [];
        arr.push(r); groups.set(r.level_number, arr);
      });
      const sortedKeys = [...groups.keys()].sort((a, b) => a - b);
      sortedKeys.forEach((k) => {
        const group = groups.get(k)!;
        plan.push({
          level_number: counter++,
          stage_level: k,
          stage,
          approval_mode: group[0].approval_mode,
          rows: group,
        });
      });
    });
    return plan;
  };

  const savePlan = useMemo(buildSavePlan, [rows]);

  const saveAll = async () => {
    if (!canSave) {
      toast({ title: 'Cannot save', description: 'Fix the highlighted issues first.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      // Step 1: park existing levels out of the way (level_number + 10000) so renumbering
      // never collides with rows that still occupy the target slots.
      const { data: existingLevels, error: fetchErr } = await supabase
        .from('approval_matrix_levels')
        .select('id, level_number')
        .eq('tenant_id', tenantId);
      if (fetchErr) throw new Error(`Could not reserve level numbers: ${fetchErr.message}`);
      for (const lv of existingLevels ?? []) {
        const { error: upErr } = await supabase
          .from('approval_matrix_levels')
          .update({ level_number: 10000 + lv.level_number })
          .eq('id', lv.id);
        if (upErr) throw new Error(`Could not reserve level numbers: ${upErr.message}`);
      }

      const keptLevelIds: string[] = [];
      let savedApprovers = 0;
      for (const grp of savePlan) {
        const first = grp.rows[0];
        let levelId = first.level_id;
        const levelPayload: any = {
          tenant_id: tenantId,
          level_number: grp.level_number,
          level_name: `${formatStageLevel(grp.stage, grp.stage_level)} · ${STAGE_LABELS[grp.stage]}`,
          designation: null,
          approval_mode: grp.approval_mode,
          stage: grp.stage,
          requires_msme: grp.stage === 'CEO_OFFICE',
        };
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
        const approverRows = grp.rows.map((r) => ({
          level_id: levelId!,
          user_id: null,
          approver_name: r.approver_name.trim(),
          approver_email: r.approver_email.trim().toLowerCase(),
          added_by: user?.id,
        }));
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
        await supabase.from('approval_matrix_levels').delete().in('id', toDelete);
      }

      await supabase.from('audit_logs').insert({
        action: 'approval_matrix_saved',
        user_id: user?.id,
        details: { tenant_id: tenantId, level_count: savePlan.length, row_count: rows.length },
      });

      setLastSaveResult({ levels: savePlan.length, approvers: savedApprovers, at: Date.now() });
      toast({ title: 'Approval matrix saved', description: `${savePlan.length} level(s), ${savedApprovers} approver(s)` });
      await Promise.all([loadMatrix(tenantId), loadDbState(tenantId)]);
    } catch (e: any) {
      console.error('[ApprovalMatrix] Save failed:', e);
      toast({ title: 'Save failed', description: e?.message ?? 'Unknown error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const testWriteAccess = async () => {
    if (!tenantId) return;
    setTestingWrite(true);
    try {
      const sentinel = {
        tenant_id: tenantId,
        level_number: 9999,
        level_name: '__sentinel_test__',
        designation: null,
        approval_mode: 'ANY',
      };
      const { data, error } = await supabase.from('approval_matrix_levels').insert(sentinel).select('id').single();
      if (error) throw error;
      const { error: delErr } = await supabase.from('approval_matrix_levels').delete().eq('id', data.id);
      if (delErr) throw delErr;
      toast({ title: 'Write access OK', description: 'Insert + delete succeeded for this tenant.' });
    } catch (e: any) {
      toast({ title: 'Write access FAILED', description: e?.message ?? 'Check console', variant: 'destructive' });
    } finally {
      setTestingWrite(false);
    }
  };

  const resolveUserIds = async () => {
    if (!tenantId) return;
    setResolvingUsers(true);
    try {
      // Pull all approver rows for levels in this tenant that are missing user_id.
      const { data: levels, error: lErr } = await supabase
        .from('approval_matrix_levels').select('id').eq('tenant_id', tenantId);
      if (lErr) throw lErr;
      const levelIds = (levels ?? []).map((l: any) => l.id);
      if (levelIds.length === 0) {
        toast({ title: 'Nothing to resolve', description: 'No levels saved for this tenant yet.' });
        return;
      }
      const { data: rows, error: rErr } = await supabase
        .from('approval_matrix_approvers')
        .select('id, approver_email, user_id')
        .in('level_id', levelIds)
        .is('user_id', null);
      if (rErr) throw rErr;

      const emails = [...new Set((rows ?? [])
        .map((r: any) => (r.approver_email ?? '').trim().toLowerCase())
        .filter((e: string) => !!e))];
      if (emails.length === 0) {
        toast({ title: 'All approvers already linked', description: 'Every saved approver row has a user_id.' });
        return;
      }

      const { data: profiles, error: pErr } = await supabase
        .from('profiles').select('id, email').in('email', emails);
      if (pErr) throw pErr;
      const emailToId = new Map<string, string>();
      (profiles ?? []).forEach((p: any) => {
        if (p.email) emailToId.set(p.email.toLowerCase(), p.id);
      });

      let linked = 0;
      for (const r of rows ?? []) {
        const e = (r.approver_email ?? '').trim().toLowerCase();
        const uid = emailToId.get(e);
        if (!uid) continue;
        const { error } = await supabase
          .from('approval_matrix_approvers').update({ user_id: uid }).eq('id', r.id);
        if (!error) linked++;
      }
      toast({
        title: 'Resolve complete',
        description: `${linked} of ${rows?.length ?? 0} approver row(s) linked to existing users.`,
      });
    } catch (e: any) {
      toast({ title: 'Resolve failed', description: e?.message ?? 'Unknown error', variant: 'destructive' });
    } finally {
      setResolvingUsers(false);
    }
  };

  const handleTenantChange = (next: string) => {
    if (isDirty && next !== tenantId) setPendingTenantId(next);
    else setTenantId(next);
  };

  const confirmTenantSwitch = () => {
    if (pendingTenantId) { setTenantId(pendingTenantId); setPendingTenantId(null); }
  };

  const renderRowsTable = () => {
    // Every stage now supports multiple independent levels (L1, L2, L3…)
    const showLevelColumn = true;
    const showModeColumn = true;

    return (
      <div className="border rounded-md overflow-x-auto">
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow>
              {showLevelColumn && <TableHead className="w-24">Level #</TableHead>}
              <TableHead className="w-64">Approver Name</TableHead>
              <TableHead className="w-72">Email</TableHead>
              {showModeColumn && <TableHead className="w-32">Mode</TableHead>}
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
              ))
            ) : stageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                  No approver configured for {STAGE_LABELS[activeStage]}. Click <strong>+ Add Approver</strong> to start.
                </TableCell>
              </TableRow>
            ) : (
              stageRows.map((r) => {
                const hasError = errorRowKeys.has(r.rowKey);
                const nameInvalid = !r.approver_name.trim();
                const emailVal = r.approver_email.trim();
                const emailInvalid = !emailVal || !EMAIL_RE.test(emailVal);
                return (
                  <TableRow key={r.rowKey} className={cn(hasError && 'bg-destructive/5')}>
                    {showLevelColumn && (
                      <TableCell>
                        <Select
                          value={String(r.level_number)}
                          onValueChange={(v) => updateRow(r.rowKey, { level_number: Number(v) })}
                        >
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {activeStageLevels.map((n) => (
                              <SelectItem key={n} value={String(n)}>L{n}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    )}
                    <TableCell>
                      <Input
                        value={r.approver_name}
                        maxLength={100}
                        placeholder="e.g. Jane Doe"
                        className={cn('h-8', nameInvalid && 'border-destructive')}
                        onChange={(e) => updateRow(r.rowKey, { approver_name: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="email"
                        value={r.approver_email}
                        maxLength={255}
                        placeholder="e.g. jane@company.com"
                        className={cn('h-8', emailInvalid && 'border-destructive')}
                        onChange={(e) => updateRow(r.rowKey, { approver_email: e.target.value })}
                      />
                    </TableCell>
                    {showModeColumn && (
                      <TableCell>
                        <Select
                          value={r.approval_mode}
                          onValueChange={(v) => updateLevelMode(r.stage, r.level_number, v as 'ANY' | 'ALL')}
                        >
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ANY">ANY one</SelectItem>
                            <SelectItem value="ALL">ALL must</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    )}
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => removeRow(r.rowKey)} className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between p-3 border-t bg-muted/20">
          <div className="text-xs text-muted-foreground">
            Add multiple levels (L1, L2, L3…) and multiple approvers per level. Lower level acts first within this stage.
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={addLevel}>
              <Plus className="h-4 w-4 mr-1" /> Add Level
            </Button>
            <Button size="sm" variant="outline" onClick={addRow}>
              <Plus className="h-4 w-4 mr-1" /> Add Approver
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end justify-between">
        {!externallyControlled ? (
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
        ) : !tenantId ? (
          <div className="text-sm text-muted-foreground">
            Select a tenant from <strong>Tenant Scope</strong> above to configure the Approval Matrix.
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            Tenant: <strong className="text-foreground">{currentTenant?.name ?? '—'}</strong>
            {tenantUserCounts[tenantId] != null && (
              <span className="ml-2">· {tenantUserCounts[tenantId]} user{tenantUserCounts[tenantId] === 1 ? '' : 's'}</span>
            )}
          </div>
        )}
        <div className="flex gap-2 items-center flex-wrap">
          {isDirty && !loading && <Badge variant="destructive" className="animate-pulse">Unsaved changes</Badge>}
          <Button variant="outline" size="sm" onClick={testWriteAccess} disabled={!tenantId || testingWrite}>
            {testingWrite ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FlaskConical className="h-4 w-4 mr-1" />}
            Test write access
          </Button>
          <Button variant="outline" size="sm" onClick={resolveUserIds} disabled={!tenantId || resolvingUsers}>
            {resolvingUsers ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FlaskConical className="h-4 w-4 mr-1" />}
            Resolve Users
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

      {lastSaveResult && (
        <div className="flex items-center gap-2 p-3 rounded-md border border-green-500/40 bg-green-500/10 text-sm">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span>
            <strong>Saved · {lastSaveResult.levels} level{lastSaveResult.levels === 1 ? '' : 's'} · {lastSaveResult.approvers} approver{lastSaveResult.approvers === 1 ? '' : 's'}</strong>{' '}
            persisted to database.
          </span>
        </div>
      )}

      {/* Diagnostics */}
      {tenantId && !loading && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {rowErrors.length === 0 && rows.length > 0 ? (
                <><CheckCircle2 className="h-4 w-4 text-green-600" /> Diagnostics — all rows valid</>
              ) : (
                <><AlertTriangle className={cn('h-4 w-4', rowErrors.length > 0 ? 'text-destructive' : 'text-muted-foreground')} /> Diagnostics</>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>Rows: <strong className="text-foreground">{rows.length}</strong></span>
              <span>Levels: <strong className="text-foreground">{savePlan.length}</strong></span>
              <span>Approvers: <strong className="text-foreground">{totalApprovers}</strong></span>
              <span>Issues: <strong className={cn(rowErrors.length > 0 ? 'text-destructive' : 'text-foreground')}>{rowErrors.length}</strong></span>
            </div>
            {rowErrors.length > 0 ? (
              <ul className="text-xs space-y-1 mt-2 max-h-32 overflow-auto">
                {rowErrors.map((e, i) => <li key={i} className="text-destructive">• {e.message}</li>)}
              </ul>
            ) : rows.length === 0 ? (
              <p className="text-xs text-muted-foreground">Add at least one approver to begin.</p>
            ) : (
              <p className="text-xs text-muted-foreground">Ready to save. Click <strong>Save All</strong> to persist.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Chain preview — canonical stage order */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Approval Chain (Vendor Submitted → SAP Sync)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline">Vendor Submitted</Badge>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            {STAGE_ORDER.flatMap((stage) => {
              const groupsForStage = savePlan.filter((g) => g.stage === stage);
              const isCeo = stage === 'CEO_OFFICE';
              if (groupsForStage.length === 0) {
                return [(
                  <span key={stage} className="flex items-center gap-2">
                    <Badge variant="outline" className="opacity-50">
                      {STAGE_LABELS[stage]} · not configured{isCeo ? ' (MSME only)' : ''}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </span>
                )];
              }
              return groupsForStage.map((g) => (
                <span key={`${stage}-${g.level_number}`} className="flex items-center gap-2">
                  <Badge>
                    L{g.stage_level} · {STAGE_LABELS[g.stage]} · {g.rows.length} approver{g.rows.length > 1 ? 's' : ''}
                    {isCeo ? ' (MSME only)' : ''}
                  </Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </span>
              ));
            })}
            <Badge variant="secondary">SAP Sync</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Stage tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Approvers by Stage</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeStage} onValueChange={(v) => setActiveStage(v as Stage)}>
            <TabsList className="grid grid-cols-5 w-full">
              {STAGE_ORDER.map((s) => (
                <TabsTrigger key={s} value={s} className="text-xs">
                  {STAGE_LABELS[s]}
                  {stageCounts[s] > 0 && (
                    <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px]">{stageCounts[s]}</Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
            {STAGE_ORDER.map((s) => (
              <TabsContent key={s} value={s} className="mt-4">
                {s === 'CEO_OFFICE' && (
                  <div className="mb-3 text-xs text-muted-foreground p-2 rounded bg-muted/40 border">
                    CEO Office runs <strong>only for MSME-registered vendors</strong>.
                  </div>
                )}
                {renderRowsTable()}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

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
