import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Search, UserCog, Building2, Users, Plus, ShieldCheck, Pencil, Trash2, Settings, GitBranch } from 'lucide-react';
import { ChangeRoleDialog, AppRole } from '@/components/admin/ChangeRoleDialog';
import { AssignTenantDialog } from '@/components/admin/AssignTenantDialog';
import { CreateUserDialog } from '@/components/admin/CreateUserDialog';
import { CustomRoleDialog, CustomRoleData } from '@/components/admin/CustomRoleDialog';
import { CustomRolePermissionsMatrix } from '@/components/admin/CustomRolePermissionsMatrix';
import { ApprovalMatrixConfig } from '@/components/admin/ApprovalMatrixConfig';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import RolePermissions from '@/pages/RolePermissions';

interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  role: AppRole | null;
  tenants: { id: string; name: string }[];
  customRoles: { id: string; name: string }[];
}

interface Tenant { id: string; name: string; }
interface CustomRoleOpt { id: string; name: string; is_active: boolean; tenant_id?: string | null; }
interface CustomRoleRow extends CustomRoleData { id: string; user_count: number; created_at: string; tenant_id?: string | null; }

const ALL_ROLES: AppRole[] = ['vendor', 'finance', 'purchase', 'approver', 'customer_admin', 'admin', 'sharvi_admin'];
const ALL_TENANTS = '__all__';

export default function UserManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRoleOpt[]>([]);
  const [customRoleRows, setCustomRoleRows] = useState<CustomRoleRow[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [scopeTenantId, setScopeTenantId] = useState<string>(ALL_TENANTS);
  const [roleDialog, setRoleDialog] = useState<UserRow | null>(null);
  const [tenantDialog, setTenantDialog] = useState<UserRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingCustomRole, setEditingCustomRole] = useState<CustomRoleData | null>(null);
  const [customRoleDialogOpen, setCustomRoleDialogOpen] = useState(false);
  const [permsRole, setPermsRole] = useState<CustomRoleRow | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [profilesRes, rolesRes, userTenantsRes, tenantsRes, customRolesRes, userCustomRes] = await Promise.all([
        supabase.from('profiles').select('id, email, full_name, created_at').order('created_at', { ascending: false }),
        supabase.from('user_roles').select('user_id, role'),
        supabase.from('user_tenants').select('user_id, tenant_id'),
        supabase.from('tenants').select('id, name').eq('is_active', true).order('name'),
        supabase.from('custom_roles').select('*').order('created_at', { ascending: false }),
        supabase.from('user_custom_roles').select('user_id, custom_role_id'),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;
      if (userTenantsRes.error) throw userTenantsRes.error;
      if (tenantsRes.error) throw tenantsRes.error;
      if (customRolesRes.error) throw customRolesRes.error;
      if (userCustomRes.error) throw userCustomRes.error;

      const tenantMap = new Map<string, Tenant>((tenantsRes.data ?? []).map((t) => [t.id, t]));
      const customRoleMap = new Map<string, CustomRoleOpt>((customRolesRes.data ?? []).map((c: any) => [c.id, c]));
      const roleMap = new Map<string, AppRole>((rolesRes.data ?? []).map((r) => [r.user_id, r.role as AppRole]));
      const utByUser = new Map<string, string[]>();
      (userTenantsRes.data ?? []).forEach((ut) => {
        const arr = utByUser.get(ut.user_id) ?? [];
        arr.push(ut.tenant_id);
        utByUser.set(ut.user_id, arr);
      });
      const cuByUser = new Map<string, string[]>();
      const countsByRole = new Map<string, number>();
      (userCustomRes.data ?? []).forEach((uc) => {
        const arr = cuByUser.get(uc.user_id) ?? [];
        arr.push(uc.custom_role_id);
        cuByUser.set(uc.user_id, arr);
        countsByRole.set(uc.custom_role_id, (countsByRole.get(uc.custom_role_id) ?? 0) + 1);
      });

      setTenants(tenantsRes.data ?? []);
      setCustomRoles((customRolesRes.data ?? []) as any);
      setCustomRoleRows((customRolesRes.data ?? []).map((r: any) => ({ ...r, user_count: countsByRole.get(r.id) ?? 0 })));
      setUsers(
        (profilesRes.data ?? []).map((p) => ({
          id: p.id,
          email: p.email,
          full_name: p.full_name,
          created_at: p.created_at,
          role: roleMap.get(p.id) ?? null,
          tenants: (utByUser.get(p.id) ?? [])
            .map((tid) => tenantMap.get(tid))
            .filter((t): t is Tenant => !!t),
          customRoles: (cuByUser.get(p.id) ?? [])
            .map((cid) => customRoleMap.get(cid))
            .filter((c): c is CustomRoleOpt => !!c)
            .map((c) => ({ id: c.id, name: c.name })),
        }))
      );
    } catch (err: any) {
      toast({ title: 'Failed to load users', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Custom roles scoped to selected tenant (or global if "All")
  const scopedCustomRoles = useMemo(() => {
    if (scopeTenantId === ALL_TENANTS) return customRoles;
    return customRoles.filter((c) => c.tenant_id === scopeTenantId || !c.tenant_id);
  }, [customRoles, scopeTenantId]);

  const scopedCustomRoleRows = useMemo(() => {
    if (scopeTenantId === ALL_TENANTS) return customRoleRows;
    return customRoleRows.filter((c) => c.tenant_id === scopeTenantId || !c.tenant_id);
  }, [customRoleRows, scopeTenantId]);

  // Users scoped to selected tenant
  const scopedUsers = useMemo(() => {
    if (scopeTenantId === ALL_TENANTS) return users;
    return users.filter((u) => u.tenants.some((t) => t.id === scopeTenantId));
  }, [users, scopeTenantId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedUsers.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (!q) return true;
      return (u.email?.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q));
    });
  }, [scopedUsers, search, roleFilter]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    scopedUsers.forEach((u) => { if (u.role) counts[u.role] = (counts[u.role] ?? 0) + 1; });
    return { total: scopedUsers.length, counts };
  }, [scopedUsers]);

  const handleChangeRole = async (newRole: AppRole, newTenantIds: string[], newCustomRoleIds: string[]) => {
    if (!roleDialog) return;
    if (roleDialog.id === user?.id && newRole !== roleDialog.role) {
      toast({ title: 'Action blocked', description: 'You cannot change your own role.', variant: 'destructive' });
      return;
    }
    try {
      if (newRole !== roleDialog.role) {
        const { error: delErr } = await supabase.from('user_roles').delete().eq('user_id', roleDialog.id);
        if (delErr) throw delErr;
        const { error: insErr } = await supabase.from('user_roles').insert({ user_id: roleDialog.id, role: newRole });
        if (insErr) throw insErr;
        await supabase.from('audit_logs').insert({
          action: 'role_changed', user_id: user?.id,
          details: { target_user_id: roleDialog.id, target_email: roleDialog.email, old_role: roleDialog.role, new_role: newRole },
        });
      }

      const currentIds = roleDialog.tenants.map((t) => t.id);
      const toAdd = newTenantIds.filter((id) => !currentIds.includes(id));
      const toRemove = currentIds.filter((id) => !newTenantIds.includes(id));
      if (toRemove.length > 0) {
        const { error } = await supabase.from('user_tenants').delete().eq('user_id', roleDialog.id).in('tenant_id', toRemove);
        if (error) throw error;
      }
      if (toAdd.length > 0) {
        const rows = toAdd.map((tid) => ({ user_id: roleDialog.id, tenant_id: tid }));
        const { error } = await supabase.from('user_tenants').insert(rows);
        if (error) throw error;
      }

      const currentCustom = roleDialog.customRoles.map((c) => c.id);
      const cToAdd = newCustomRoleIds.filter((id) => !currentCustom.includes(id));
      const cToRemove = currentCustom.filter((id) => !newCustomRoleIds.includes(id));
      if (cToRemove.length > 0) {
        const { error } = await supabase.from('user_custom_roles').delete().eq('user_id', roleDialog.id).in('custom_role_id', cToRemove);
        if (error) throw error;
        await supabase.from('audit_logs').insert({
          action: 'custom_roles_unassigned', user_id: user?.id,
          details: { target_user_id: roleDialog.id, custom_role_ids: cToRemove },
        });
      }
      if (cToAdd.length > 0) {
        const rows = cToAdd.map((cid) => ({ user_id: roleDialog.id, custom_role_id: cid, assigned_by: user?.id }));
        const { error } = await supabase.from('user_custom_roles').insert(rows);
        if (error) throw error;
        await supabase.from('audit_logs').insert({
          action: 'custom_roles_assigned', user_id: user?.id,
          details: { target_user_id: roleDialog.id, custom_role_ids: cToAdd },
        });
      }

      toast({ title: 'User updated', description: `${roleDialog.email} → ${newRole}` });
      await loadData();
    } catch (err: any) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
      throw err;
    }
  };

  const handleAssignTenant = async (tenantId: string) => {
    if (!tenantDialog) return;
    try {
      const { error } = await supabase.from('user_tenants').insert({ user_id: tenantDialog.id, tenant_id: tenantId });
      if (error) throw error;
      toast({ title: 'Tenant assigned' });
      await loadData();
    } catch (err: any) {
      toast({ title: 'Assignment failed', description: err.message, variant: 'destructive' });
      throw err;
    }
  };

  const handleRemoveTenant = async (userId: string, tenantId: string) => {
    try {
      const { error } = await supabase.from('user_tenants').delete().eq('user_id', userId).eq('tenant_id', tenantId);
      if (error) throw error;
      toast({ title: 'Tenant removed' });
      await loadData();
    } catch (err: any) {
      toast({ title: 'Remove failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleSaveCustomRole = async (data: CustomRoleData) => {
    try {
      // Bind to selected tenant if one is chosen (else global)
      const tenantBinding = scopeTenantId === ALL_TENANTS ? null : scopeTenantId;
      if (data.id) {
        const { error } = await supabase.from('custom_roles')
          .update({ name: data.name, description: data.description, is_active: data.is_active })
          .eq('id', data.id);
        if (error) throw error;
        await supabase.from('audit_logs').insert({
          action: 'custom_role_updated', user_id: user?.id, details: { id: data.id, name: data.name },
        });
        toast({ title: 'Role updated' });
      } else {
        const { data: created, error } = await supabase.from('custom_roles')
          .insert({ name: data.name, description: data.description, is_active: data.is_active, created_by: user?.id, tenant_id: tenantBinding } as any)
          .select().single();
        if (error) throw error;
        await supabase.from('audit_logs').insert({
          action: 'custom_role_created', user_id: user?.id, details: { id: created.id, name: data.name, tenant_id: tenantBinding },
        });
        toast({ title: 'Role created', description: tenantBinding ? `Scoped to selected tenant` : 'Global role' });
      }
      await loadData();
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
      throw err;
    }
  };

  const handleDeleteCustomRole = async (role: CustomRoleRow) => {
    if (role.user_count > 0) {
      toast({ title: 'Cannot delete', description: `Unassign ${role.user_count} user(s) first`, variant: 'destructive' });
      return;
    }
    if (!confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('custom_roles').delete().eq('id', role.id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
      return;
    }
    await supabase.from('audit_logs').insert({
      action: 'custom_role_deleted', user_id: user?.id, details: { id: role.id, name: role.name },
    });
    toast({ title: 'Role deleted' });
    await loadData();
  };

  const tenantLabel = scopeTenantId === ALL_TENANTS
    ? 'All Tenants (Global)'
    : tenants.find((t) => t.id === scopeTenantId)?.name ?? '';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Users className="h-6 w-6" /> User Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage users, custom roles, screen permissions and approval matrix — scoped per tenant.
          </p>
        </div>
        <Card className="min-w-[280px]">
          <CardContent className="p-3 flex items-center gap-3">
            <Building2 className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Tenant Scope</p>
              <Select value={scopeTenantId} onValueChange={setScopeTenantId}>
                <SelectTrigger className="h-8 mt-0.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_TENANTS}>All Tenants (Global)</SelectItem>
                  {tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users"><Users className="h-4 w-4 mr-2" /> Users</TabsTrigger>
          <TabsTrigger value="custom-roles"><ShieldCheck className="h-4 w-4 mr-2" /> Custom Roles</TabsTrigger>
          <TabsTrigger value="role-permissions"><Settings className="h-4 w-4 mr-2" /> Role Permissions</TabsTrigger>
          <TabsTrigger value="approval-matrix"><GitBranch className="h-4 w-4 mr-2" /> Approval Matrix</TabsTrigger>
        </TabsList>

        {/* USERS TAB */}
        <TabsContent value="users" className="space-y-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Badge variant="outline" className="text-xs">
              <Building2 className="h-3 w-3 mr-1" /> {tenantLabel}
            </Badge>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Create User
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total Users</p>
                <p className="text-2xl font-semibold">{stats.total}</p>
              </CardContent>
            </Card>
            {ALL_ROLES.map((r) => (
              <Card key={r}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground capitalize">{r.replace('_', ' ')}</p>
                  <p className="text-2xl font-semibold">{stats.counts[r] ?? 0}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Users</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    {ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Custom Roles</TableHead>
                      <TableHead>Tenants</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                      ))
                    ) : filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        {scopeTenantId === ALL_TENANTS ? 'No users found' : 'No users in this tenant'}
                      </TableCell></TableRow>
                    ) : (
                      filtered.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.full_name ?? '—'}</TableCell>
                          <TableCell>{u.email}</TableCell>
                          <TableCell>
                            {u.role ? <Badge variant="secondary">{u.role}</Badge> : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {u.customRoles.length === 0
                                ? <span className="text-muted-foreground text-xs">—</span>
                                : u.customRoles.map((c) => (
                                    <Badge key={c.id} variant="outline" className="bg-primary/5">{c.name}</Badge>
                                  ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {u.tenants.length === 0 ? (
                                <span className="text-muted-foreground text-xs">None</span>
                              ) : (
                                u.tenants.map((t) => (
                                  <Badge key={t.id} variant="outline" className="cursor-pointer hover:bg-destructive/10"
                                    onClick={() => handleRemoveTenant(u.id, t.id)} title="Click to remove">
                                    {t.name} ×
                                  </Badge>
                                ))
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(u.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => setRoleDialog(u)}
                                disabled={u.id === user?.id}
                                title={u.id === user?.id ? 'Cannot change own role' : 'Change role'}>
                                <UserCog className="h-4 w-4 mr-1" /> Role
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setTenantDialog(u)}>
                                <Building2 className="h-4 w-4 mr-1" /> Tenant
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CUSTOM ROLES TAB */}
        <TabsContent value="custom-roles" className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Badge variant="outline" className="text-xs">
              <Building2 className="h-3 w-3 mr-1" /> {tenantLabel}
            </Badge>
            <Button onClick={() => { setEditingCustomRole(null); setCustomRoleDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Create Role
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Custom Roles {scopeTenantId !== ALL_TENANTS && <span className="text-sm text-muted-foreground font-normal">— scoped to {tenantLabel}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Users</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                      ))
                    ) : scopedCustomRoleRows.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No custom roles {scopeTenantId !== ALL_TENANTS ? 'in this tenant' : 'yet'}. Click "Create Role" to add one.
                      </TableCell></TableRow>
                    ) : (
                      scopedCustomRoleRows.map((r) => {
                        const tName = r.tenant_id ? tenants.find((t) => t.id === r.tenant_id)?.name : null;
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.name}</TableCell>
                            <TableCell>
                              {tName
                                ? <Badge variant="outline" className="bg-primary/5">{tName}</Badge>
                                : <Badge variant="secondary">Global</Badge>}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{r.description ?? '—'}</TableCell>
                            <TableCell>{r.user_count}</TableCell>
                            <TableCell>
                              {r.is_active
                                ? <Badge variant="secondary">Active</Badge>
                                : <Badge variant="outline">Inactive</Badge>}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => setPermsRole(r)}>
                                  <Settings className="h-4 w-4 mr-1" /> Screens
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => { setEditingCustomRole(r); setCustomRoleDialogOpen(true); }}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteCustomRole(r)} className="text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
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
        </TabsContent>

        {/* ROLE PERMISSIONS TAB */}
        <TabsContent value="role-permissions">
          <RolePermissions tenantId={scopeTenantId === ALL_TENANTS ? null : scopeTenantId} tenantLabel={tenantLabel} />
        </TabsContent>

        {/* APPROVAL MATRIX TAB */}
        <TabsContent value="approval-matrix">
          <ApprovalMatrixConfig />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {roleDialog && (
        <ChangeRoleDialog
          open={!!roleDialog}
          onOpenChange={(o) => !o && setRoleDialog(null)}
          currentRole={roleDialog.role}
          userName={roleDialog.full_name ?? roleDialog.email}
          tenants={tenants}
          currentTenantIds={roleDialog.tenants.map((t) => t.id)}
          customRoles={scopedCustomRoles}
          currentCustomRoleIds={roleDialog.customRoles.map((c) => c.id)}
          onConfirm={handleChangeRole}
        />
      )}
      {tenantDialog && (
        <AssignTenantDialog
          open={!!tenantDialog}
          onOpenChange={(o) => !o && setTenantDialog(null)}
          tenants={tenants}
          currentTenantIds={tenantDialog.tenants.map((t) => t.id)}
          userName={tenantDialog.full_name ?? tenantDialog.email}
          onConfirm={handleAssignTenant}
        />
      )}
      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        tenants={tenants}
        customRoles={scopedCustomRoles}
        defaultTenantId={scopeTenantId === ALL_TENANTS ? null : scopeTenantId}
        onCreated={loadData}
      />
      <CustomRoleDialog
        open={customRoleDialogOpen}
        onOpenChange={setCustomRoleDialogOpen}
        initial={editingCustomRole}
        onSave={handleSaveCustomRole}
      />
      <Dialog open={!!permsRole} onOpenChange={(o) => !o && setPermsRole(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Screen Permissions — {permsRole?.name}</DialogTitle>
            <DialogDescription>
              Check the screens users with this role should access. Changes save automatically.
            </DialogDescription>
          </DialogHeader>
          {permsRole && <CustomRolePermissionsMatrix customRoleId={permsRole.id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
