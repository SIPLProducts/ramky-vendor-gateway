import { useEffect, useMemo, useState } from 'react';
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
import { Plus, Save, Trash2, ArrowRight, ChevronsUpDown, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTenants, useTenantUsersWithRoles, useTenantUserCounts, type TenantUserWithRole } from '@/hooks/useTenant';
import { AssignUsersToTenantDialog } from './AssignUsersToTenantDialog';
import { UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Row {
  rowKey: string; // local UI id
  level_id?: string; // existing level id (if hydrated)
  level_number: number;
  level_name: string;
  designation: string;
  approval_mode: 'ANY' | 'ALL';
  user_id: string | null;
}

const newRowKey = () => Math.random().toString(36).slice(2, 10);

export function ApprovalMatrixConfig() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: tenants = [] } = useTenants();
  const activeTenants = useMemo(() => tenants.filter((t) => t.is_active), [tenants]);

  const [tenantId, setTenantId] = useState<string>('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { data: tenantUsers = [], isLoading: usersLoading } = useTenantUsersWithRoles(tenantId || null);
  const { data: tenantUserCounts = {} } = useTenantUserCounts();
  const userById = useMemo(() => new Map(tenantUsers.map((u) => [u.user_id, u])), [tenantUsers]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const currentTenant = activeTenants.find((t) => t.id === tenantId);

  useEffect(() => {
    if (activeTenants.length > 0 && !tenantId) {
      setTenantId(activeTenants[0].id);
    }
  }, [activeTenants, tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    loadMatrix(tenantId);
  }, [tenantId]);

  const loadMatrix = async (tid: string) => {
    setLoading(true);
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
    setLoading(false);
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

  // When user changes level_name / designation / mode for a row, propagate to all rows of same level_number
  const updateLevelMeta = (level_number: number, patch: Partial<Pick<Row, 'level_name' | 'designation' | 'approval_mode'>>) => {
    setRows((prev) => prev.map((r) => (r.level_number === level_number ? { ...r, ...patch } : r)));
  };

  const removeRow = (key: string) => setRows((prev) => prev.filter((r) => r.rowKey !== key));

  // Group rows for chain preview & save
  const grouped = useMemo(() => {
    const map = new Map<number, Row[]>();
    rows.forEach((r) => {
      const arr = map.get(r.level_number) ?? [];
      arr.push(r);
      map.set(r.level_number, arr);
    });
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]); // desc
  }, [rows]);

  const validate = (): string | null => {
    if (rows.length === 0) return 'Add at least one approver row';
    const seenPairs = new Set<string>();
    for (const r of rows) {
      if (!tenantId) return 'Select a tenant';
      if (!r.level_number || r.level_number < 1) return 'Each row needs a valid Level #';
      if (!r.level_name.trim()) return `Level ${r.level_number} needs a name`;
      if (!r.user_id) return `A row at Level ${r.level_number} has no approver selected`;
      const key = `${r.level_number}::${r.user_id}`;
      if (seenPairs.has(key)) return `Duplicate approver at Level ${r.level_number}`;
      seenPairs.add(key);
    }
    return null;
  };

  const saveAll = async () => {
    const err = validate();
    if (err) {
      toast({ title: 'Cannot save', description: err, variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      // For each level group, upsert level + replace approvers
      const keptLevelIds: string[] = [];
      for (const [levelNumber, group] of grouped) {
        const first = group[0];
        let levelId = first.level_id;

        // Check consistency within group; if mismatched, use first row values
        const levelPayload = {
          tenant_id: tenantId,
          level_number: levelNumber,
          level_name: first.level_name,
          designation: first.designation || null,
          approval_mode: first.approval_mode,
        };

        if (levelId) {
          const { error } = await supabase
            .from('approval_matrix_levels')
            .update(levelPayload)
            .eq('id', levelId);
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

        // Replace approvers
        await supabase.from('approval_matrix_approvers').delete().eq('level_id', levelId);
        const approverRows = group
          .filter((r) => r.user_id)
          .map((r) => ({ level_id: levelId!, user_id: r.user_id!, added_by: user?.id }));
        if (approverRows.length > 0) {
          const { error } = await supabase.from('approval_matrix_approvers').insert(approverRows);
          if (error) throw error;
        }
      }

      // Delete levels no longer present
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
        details: { tenant_id: tenantId, level_count: grouped.length, row_count: rows.length },
      });

      toast({ title: 'Approval matrix saved' });
      await loadMatrix(tenantId);
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end justify-between">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Tenant</label>
          <Select value={tenantId} onValueChange={setTenantId}>
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={addRow} disabled={!tenantId}>
            <Plus className="h-4 w-4 mr-1" /> Add Row
          </Button>
          <Button onClick={saveAll} disabled={saving || !tenantId}>
            <Save className="h-4 w-4 mr-1" /> {saving ? 'Saving...' : 'Save All'}
          </Button>
        </div>
      </div>

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

      {/* Missing-users banner (promoted to top of card) */}
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
                {loading || usersLoading ? (
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
                    return (
                      <TableRow key={r.rowKey}>
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
                            className="h-8"
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
                            value={r.user_id}
                            excludeIds={rows
                              .filter((x) => x.rowKey !== r.rowKey && x.level_number === r.level_number && x.user_id)
                              .map((x) => x.user_id!) }
                            onSelect={(uid) => updateRow(r.rowKey, { user_id: uid })}
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

          {tenantId && !usersLoading && tenantUsers.length === 0 && (
            <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground p-3 rounded-md border border-dashed">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
              <div>
                No users are assigned to this tenant yet. Assign users via <strong>User Management</strong> before configuring approvers.
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface ComboProps {
  users: TenantUserWithRole[];
  value: string | null;
  excludeIds: string[];
  onSelect: (userId: string) => void;
}

function ApproverCombobox({ users, value, excludeIds, onSelect }: ComboProps) {
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
          className={cn('h-8 w-full justify-between font-normal', !selected && 'text-muted-foreground')}
        >
          <span className="truncate">
            {selected ? (selected.full_name ?? selected.email) : 'Select approver…'}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 ml-2 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[20rem] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search by name or email…" />
          <CommandList>
            <CommandEmpty>No users found.</CommandEmpty>
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
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
