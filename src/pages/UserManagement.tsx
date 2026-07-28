import { formatDate, formatDateTime } from '@/lib/dateFormat';
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
import { Search, Building2, Users, Plus, ShieldCheck, Pencil, Trash2, Settings, GitBranch, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TenantCombobox } from '@/components/admin/TenantCombobox';
import { useTenantUserCounts } from '@/hooks/useTenant';
import type { AppRole } from '@/components/admin/ChangeRoleDialog';

import { CreateUserDialog } from '@/components/admin/CreateUserDialog';
import { EditUserDialog, EditUserData } from '@/components/admin/EditUserDialog';
import { ReplaceUserDialog } from '@/components/admin/ReplaceUserDialog';
import { DeleteUserDialog } from '@/components/admin/DeleteUserDialog';
import { CustomRoleDialog, CustomRoleData } from '@/components/admin/CustomRoleDialog';
import { CustomRolePermissionsMatrix } from '@/components/admin/CustomRolePermissionsMatrix';
import { ApprovalMatrixConfig } from '@/components/admin/ApprovalMatrixConfig';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import RolePermissions from '@/pages/RolePermissions';

interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  status: 'active' | 'inactive';
  last_login_attempt_at: string | null;
  role: AppRole | null;
  tenants: { id: string; name: string }[];
  customRoles: { id: string; name: string }[];
}

interface LoginAttemptRow {
  id: string;
  user_id: string | null;
  email: string;
  attempt_status: string;
  attempted_at: string;
}

interface Tenant { id: string; name: string; }
interface CustomRoleOpt { id: string; name: string; is_active: boolean; tenant_id?: string | null; }
interface CustomRoleRow extends CustomRoleData { id: string; user_count: number; created_at: string; tenant_id?: string | null; }

const ALL_ROLES: AppRole[] = ['vendor', 'finance', 'purchase', 'approver', 'customer_admin', 'admin', 'sharvi_admin'];
const ALL_TENANTS = '__all__';

export default function UserManagement() {
  const { user } = useAuth();
  const { data: tenantUserCounts = {} } = useTenantUserCounts();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRoleOpt[]>([]);
  const [customRoleRows, setCustomRoleRows] = useState<CustomRoleRow[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [scopeTenantId, setScopeTenantId] = useState<string>(ALL_TENANTS);
  
  const [createOpen, setCreateOpen] = useState(false);
  const [editingCustomRole, setEditingCustomRole] = useState<CustomRoleData | null>(null);
  const [customRoleDialogOpen, setCustomRoleDialogOpen] = useState(false);
  const [permsRole, setPermsRole] = useState<CustomRoleRow | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editUser, setEditUser] = useState<EditUserData | null>(null);
  const [loginAttempts, setLoginAttempts] = useState<LoginAttemptRow[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [replaceCtx, setReplaceCtx] = useState<null | {
    inactiveUser: { id: string; email: string; full_name: string | null; roleLabel: string; tenantNames: string[] };
    pendingPatch: { full_name: string; status: 'active' | 'inactive'; role: AppRole; tenantIds: string[]; customRoleIds: string[] };
  }>(null);

  // Deletion is handled by DeleteUserDialog, which enforces replacement-user selection
  // for anyone with active approval workload before invoking admin-delete-user.


  const fetchAll = async <T,>(
    table: 'user_tenants' | 'user_custom_roles',
    columns: string,
  ): Promise<T[]> => {
    const pageSize = 1000;
    let from = 0;
    const all: T[] = [];
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select(columns)
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const rows = (data ?? []) as T[];
      all.push(...rows);
      if (rows.length < pageSize) break;
      from += pageSize;
    }
    return all;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [profilesRes, rolesRes, userTenantsData, tenantsRes, customRolesRes, userCustomData] = await Promise.all([
        supabase.from('profiles').select('id, email, full_name, created_at, status, last_login_attempt_at').order('created_at', { ascending: false }),
        supabase.from('user_roles').select('user_id, role'),
        fetchAll<{ user_id: string; tenant_id: string }>('user_tenants', 'user_id, tenant_id'),
        supabase.from('tenants').select('id, name, code').eq('is_active', true).order('name'),
        supabase.from('custom_roles').select('*').order('created_at', { ascending: false }),
        fetchAll<{ user_id: string; custom_role_id: string }>('user_custom_roles', 'user_id, custom_role_id'),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;
      if (tenantsRes.error) throw tenantsRes.error;
      if (customRolesRes.error) throw customRolesRes.error;


      const tenantMap = new Map<string, Tenant>((tenantsRes.data ?? []).map((t) => [t.id, t]));
      const customRoleMap = new Map<string, CustomRoleOpt>((customRolesRes.data ?? []).map((c: any) => [c.id, c]));
      const roleMap = new Map<string, AppRole>((rolesRes.data ?? []).map((r) => [r.user_id, r.role as AppRole]));
      const utByUser = new Map<string, string[]>();
      userTenantsData.forEach((ut) => {
        const arr = utByUser.get(ut.user_id) ?? [];
        arr.push(ut.tenant_id);
        utByUser.set(ut.user_id, arr);
      });
      const cuByUser = new Map<string, string[]>();
      const countsByRole = new Map<string, number>();
      userCustomData.forEach((uc) => {
        const arr = cuByUser.get(uc.user_id) ?? [];
        arr.push(uc.custom_role_id);
        cuByUser.set(uc.user_id, arr);
        countsByRole.set(uc.custom_role_id, (countsByRole.get(uc.custom_role_id) ?? 0) + 1);
      });


      setTenants(tenantsRes.data ?? []);
      setCustomRoles((customRolesRes.data ?? []) as any);
      setCustomRoleRows((customRolesRes.data ?? []).map((r: any) => ({ ...r, user_count: countsByRole.get(r.id) ?? 0 })));
      setUsers(
        (profilesRes.data ?? []).map((p: any) => ({
          id: p.id,
          email: p.email,
          full_name: p.full_name,
          created_at: p.created_at,
          status: (p.status ?? 'active') as 'active' | 'inactive',
          last_login_attempt_at: p.last_login_attempt_at ?? null,
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

  const loadLoginAttempts = async () => {
    setAttemptsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('login_attempts')
        .select('id, user_id, email, attempt_status, attempted_at')
        .eq('attempt_status', 'inactive_user')
        .order('attempted_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setLoginAttempts((data ?? []) as LoginAttemptRow[]);
    } catch (err: any) {
      toast({ title: 'Failed to load login attempts', description: err.message, variant: 'destructive' });
    } finally {
      setAttemptsLoading(false);
    }
  };

  const applyEditPatch = async (
    target: EditUserData,
    patch: {
      full_name: string;
      status: 'active' | 'inactive';
      role: AppRole;
      tenantIds: string[];
      customRoleIds: string[];
    },
  ) => {
    const editUser = target;
    const isSelf = editUser.id === user?.id;
    try {
      // 1. profile: name + status
      const { data: updatedProfile, error: profErr } = await (supabase as any).from('profiles').update({
        full_name: patch.full_name || null,
        status: patch.status,
      }).eq('id', editUser.id).select('id, status').maybeSingle();
      if (profErr) throw profErr;
      if (!updatedProfile) {
        throw new Error('Profile update did not apply. Please check admin access and try again.');
      }
      if (updatedProfile.status !== patch.status) {
        throw new Error('Profile status was not updated. Please try again.');
      }

      // 2. role/tenants/custom roles — skipped when editing self
      if (!isSelf) {
        if (patch.role !== editUser.role) {
          const { error: delErr } = await supabase.from('user_roles').delete().eq('user_id', editUser.id);
          if (delErr) throw delErr;
          const { error: insErr } = await supabase.from('user_roles').insert({ user_id: editUser.id, role: patch.role });
          if (insErr) throw insErr;
          await supabase.from('audit_logs').insert({
            action: 'role_changed', user_id: user?.id,
            details: { target_user_id: editUser.id, target_email: editUser.email, old_role: editUser.role, new_role: patch.role },
          });
        }

        const currentTenantIds = editUser.tenantIds;
        const tToAdd = patch.tenantIds.filter((id) => !currentTenantIds.includes(id));
        const tToRemove = currentTenantIds.filter((id) => !patch.tenantIds.includes(id));
        if (tToRemove.length > 0) {
          const { error } = await supabase.from('user_tenants').delete().eq('user_id', editUser.id).in('tenant_id', tToRemove);
          if (error) throw error;
        }
        if (tToAdd.length > 0) {
          const rows = tToAdd.map((tid) => ({ user_id: editUser.id, tenant_id: tid }));
          const { error } = await supabase.from('user_tenants').insert(rows);
          if (error) throw error;
        }

        const currentCustom = editUser.customRoleIds;
        const cToAdd = patch.customRoleIds.filter((id) => !currentCustom.includes(id));
        const cToRemove = currentCustom.filter((id) => !patch.customRoleIds.includes(id));
        if (cToRemove.length > 0) {
          const { error } = await supabase.from('user_custom_roles').delete().eq('user_id', editUser.id).in('custom_role_id', cToRemove);
          if (error) throw error;
          await supabase.from('audit_logs').insert({
            action: 'custom_roles_unassigned', user_id: user?.id,
            details: { target_user_id: editUser.id, custom_role_ids: cToRemove },
          });
        }
        if (cToAdd.length > 0) {
          const rows = cToAdd.map((cid) => ({ user_id: editUser.id, custom_role_id: cid, assigned_by: user?.id }));
          const { error } = await supabase.from('user_custom_roles').insert(rows);
          if (error) throw error;
          await supabase.from('audit_logs').insert({
            action: 'custom_roles_assigned', user_id: user?.id,
            details: { target_user_id: editUser.id, custom_role_ids: cToAdd },
          });
        }
      }

      await supabase.from('audit_logs').insert({
        action: 'user_edited', user_id: user?.id,
        details: {
          target_user_id: editUser.id, target_email: editUser.email,
          full_name: patch.full_name, status: patch.status,
        },
      });

      toast({ title: 'User updated', description: editUser.email });
      await loadData();
    } catch (err: any) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
      throw err;
    }
  };

  const handleSaveEditUser = async (patch: {
    full_name: string;
    status: 'active' | 'inactive';
    role: AppRole;
    tenantIds: string[];
    customRoleIds: string[];
  }) => {
    if (!editUser) return;
    // Intercept transition active -> inactive: require replacement first
    const isTransitionToInactive =
      editUser.status === 'active' &&
      patch.status === 'inactive' &&
      editUser.id !== user?.id;

    if (isTransitionToInactive) {
      const tenantNames = editUser.tenantIds
        .map((id) => tenants.find((t) => t.id === id)?.name)
        .filter((n): n is string => !!n);
      const customName = editUser.customRoleIds
        .map((id) => customRoles.find((c) => c.id === id)?.name)
        .filter((n): n is string => !!n)[0];
      const roleLabel = customName ?? (editUser.role ?? 'unknown');
      setReplaceCtx({
        inactiveUser: {
          id: editUser.id,
          email: editUser.email,
          full_name: editUser.full_name,
          roleLabel,
          tenantNames,
        },
        pendingPatch: patch,
      });
      // Close EditUserDialog and let ReplaceUserDialog drive the rest.
      return;

    }

    await applyEditPatch(editUser, patch);
  };

  const handleReplacementConfirmed = async () => {
    if (!replaceCtx) return;
    try {
      await applyEditPatch(
        {
          id: replaceCtx.inactiveUser.id,
          email: replaceCtx.inactiveUser.email,
          full_name: replaceCtx.inactiveUser.full_name,
          status: 'active',
          role: replaceCtx.pendingPatch.role,
          tenantIds: replaceCtx.pendingPatch.tenantIds,
          customRoleIds: replaceCtx.pendingPatch.customRoleIds,
        },
        replaceCtx.pendingPatch,
      );
      setReplaceCtx(null);
      setEditUser(null);
    } catch {
      // toast shown in applyEditPatch
    }
  };


  useEffect(() => { loadData(); loadLoginAttempts(); }, []);

  // Users / Custom Roles / Role Permissions tabs are ALWAYS global — show everything
  // regardless of the tenant scope picker. The scope picker only narrows
  // Approval Matrix and Buyer ↔ SCM tabs.
  const scopedCustomRoles = customRoles;
  const scopedCustomRoleRows = customRoleRows;
  const scopedUsers = users;

  // Hide "pure vendor" users from the Users tab (vendor role with no custom roles)
  const nonVendorUsers = useMemo(
    () => scopedUsers.filter((u) => !(u.role === 'vendor' && u.customRoles.length === 0)),
    [scopedUsers],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return nonVendorUsers.filter((u) => {
      if (roleFilter !== 'all') {
        if (roleFilter.startsWith('custom:')) {
          const cid = roleFilter.slice('custom:'.length);
          if (!u.customRoles.some((c) => c.id === cid)) return false;
        } else if (roleFilter === 'admin' || roleFilter === 'sharvi_admin') {
          const label = roleFilter === 'admin' ? 'admin' : 'sharvi admin';
          const altLabel = roleFilter === 'admin' ? '' : 'sharvi_admin';
          const matchesBuiltIn = u.role === roleFilter;
          const matchesCustom = u.customRoles.some((c) => {
            const n = c.name.trim().toLowerCase();
            return n === label || (altLabel && n === altLabel);
          });
          if (!matchesBuiltIn && !matchesCustom) return false;
        } else if (u.role !== roleFilter) {
          return false;
        }
      }
      if (!q) return true;
      return (u.email?.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q));
    });
  }, [nonVendorUsers, search, roleFilter]);



  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    nonVendorUsers.forEach((u) => { if (u.role) counts[u.role] = (counts[u.role] ?? 0) + 1; });
    return { total: nonVendorUsers.length, counts };
  }, [nonVendorUsers]);



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
    ? 'All Tenants'
    : tenants.find((t) => t.id === scopeTenantId)?.name ?? '';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Users className="h-6 w-6" /> User Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Users, Custom Roles and Role Permissions are global. Approval Matrix and Buyer ↔ SCM are scoped per tenant.
          </p>
        </div>
        <Card className="min-w-[320px]">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground mb-1">Tenant Scope (Approval Matrix / Buyer ↔ SCM)</p>
            <TenantCombobox
              tenants={tenants}
              value={scopeTenantId === ALL_TENANTS ? null : scopeTenantId}
              onChange={(id) => setScopeTenantId(id ?? ALL_TENANTS)}
              userCounts={tenantUserCounts}
              allowAll
            />
          </CardContent>
        </Card>
      </div>


      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="border-b-0">
          <TabsTrigger
            value="users"
            className="data-[state=active]:border-b-2 data-[state=active]:border-green-500 data-[state=active]:text-green-700 data-[state=active]:font-semibold data-[state=active]:bg-white/80"
          >
            <Users className="h-4 w-4 mr-2" /> Users
          </TabsTrigger>
          <TabsTrigger
            value="custom-roles"
            className="data-[state=active]:border-b-2 data-[state=active]:border-green-500 data-[state=active]:text-green-700 data-[state=active]:font-semibold data-[state=active]:bg-white/80"
          >
            <ShieldCheck className="h-4 w-4 mr-2" /> Custom Roles
          </TabsTrigger>
          <TabsTrigger
            value="role-permissions"
            className="data-[state=active]:border-b-2 data-[state=active]:border-green-500 data-[state=active]:text-green-700 data-[state=active]:font-semibold data-[state=active]:bg-white/80"
          >
            <Settings className="h-4 w-4 mr-2" /> Role Permissions
          </TabsTrigger>
          <TabsTrigger
            value="approval-matrix"
            className="data-[state=active]:border-b-2 data-[state=active]:border-green-500 data-[state=active]:text-green-700 data-[state=active]:font-semibold data-[state=active]:bg-white/80"
          >
            <GitBranch className="h-4 w-4 mr-2" /> Approval Matrix
          </TabsTrigger>
        </TabsList>



        {/* USERS TAB */}
        <TabsContent value="users" className="space-y-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Badge variant="outline" className="text-xs">
              <Building2 className="h-3 w-3 mr-1" /> All Tenants (Global)

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
            <CardHeader className="border-b-2 border-green-500 pb-3"><CardTitle className="text-base">Users</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 mt-[5px]">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                {(() => {
                  const CUSTOM_ORDER = ['Buyer', 'SCM CO', 'SCM Head', 'Finance 1', 'Finance 2', 'CEO Office', 'SAP Team'];
                  const byName = new Map(customRoles.map((c) => [c.name.trim().toLowerCase(), c]));
                  const orderedCustom = CUSTOM_ORDER
                    .map((name) => ({ name, cr: byName.get(name.toLowerCase()) }))
                    .filter((x) => !!x.cr) as { name: string; cr: CustomRoleOpt }[];
                  const builtIn: { value: string; label: string }[] = [
                    { value: 'admin', label: 'Admin' },
                    { value: 'sharvi_admin', label: 'Sharvi Admin' },
                  ];
                  const selectedLabel =
                    roleFilter === 'all'
                      ? 'All Roles'
                      : roleFilter.startsWith('custom:')
                      ? orderedCustom.find((o) => `custom:${o.cr.id}` === roleFilter)?.name ?? 'All Roles'
                      : builtIn.find((b) => b.value === roleFilter)?.label ?? 'All Roles';
                  return (
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue>{selectedLabel}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        {orderedCustom.map(({ name, cr }) => (
                          <SelectItem key={cr.id} value={`custom:${cr.id}`}>{name}</SelectItem>
                        ))}
                        {builtIn.map((b) => (
                          <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                })()}

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
                      <TableHead>Status</TableHead>
                      <TableHead>Last Login Attempt</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}><TableCell colSpan={9}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                      ))
                    ) : filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        No users found
                      </TableCell></TableRow>

                    ) : (
                      filtered.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.full_name ?? '—'}</TableCell>
                          <TableCell>{u.email}</TableCell>
                          <TableCell>
                            {u.role ? (
                              <span className="text-xs capitalize">
                                {u.role === 'sharvi_admin' ? 'Sharvi Admin' : u.role === 'customer_admin' ? 'Customer Admin' : u.role.replace('_', ' ')}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>

                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {u.customRoles.length === 0
                                ? <span className="text-muted-foreground text-xs">—</span>
                                : u.customRoles.map((c) => (
                                    <Badge key={c.id} variant="secondary" className="bg-primary/10">{c.name}</Badge>
                                  ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {u.tenants.length === 0 ? (
                                <span className="text-muted-foreground text-xs">None</span>
                              ) : (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button
                                      type="button"
                                      className="inline-flex items-center gap-1 rounded-full border border-input bg-background px-2.5 py-0.5 text-xs font-semibold transition-colors hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-ring"
                                    >
                                      <Building2 className="h-3 w-3" />
                                      {u.tenants.length} tenant{u.tenants.length === 1 ? '' : 's'}
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent align="start" className="w-72 p-0">
                                    <div className="px-3 py-2 border-b text-xs text-muted-foreground">
                                      Assigned tenants ({u.tenants.length})
                                    </div>
                                    <div className="max-h-80 overflow-y-auto p-1">
                                      {u.tenants.map((t) => (
                                        <div
                                          key={t.id}
                                          className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-sm hover:bg-muted text-sm"
                                        >
                                          <span className="truncate">{t.name}</span>
                                          <button
                                            type="button"
                                            className="text-muted-foreground hover:text-destructive shrink-0"
                                            title="Remove tenant"
                                            onClick={() => handleRemoveTenant(u.id, t.id)}
                                          >
                                            <X className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span
                              className={
                                u.status === 'inactive'
                                  ? 'inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800'
                                  : 'inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800'
                              }
                            >
                              {u.status === 'inactive' ? 'Inactive' : 'Active'}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {u.last_login_attempt_at
                              ? formatDateTime(u.last_login_attempt_at)
                              : '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(u.created_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => setEditUser({
                                  id: u.id, email: u.email,
                                  full_name: u.full_name, status: u.status,
                                  role: u.role,
                                  tenantIds: u.tenants.map((t) => t.id),
                                  customRoleIds: u.customRoles.map((c) => c.id),
                                })}
                                title="Edit user"
                              >
                                <Pencil className="h-4 w-4 mr-1" /> Edit
                              </Button>
                              {u.status === 'inactive' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setReassignCtx({
                                    id: u.id, email: u.email, full_name: u.full_name,
                                    roleLabel: u.customRoles.map((c) => c.name).join(', ') || u.role,
                                    tenantNames: u.tenants.map((t) => t.name),
                                  })}
                                  title="Reassign this user's leftover vendors, approval flows and mappings"
                                >
                                  Reassign work
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                disabled={u.id === user?.id}
                                title={u.id === user?.id ? 'Cannot delete own account' : 'Delete user'}
                                onClick={() => setDeleteUser(u)}
                              >
                                <Trash2 className="h-4 w-4 mr-1" /> Delete
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

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 border-b-2 border-green-500 pb-3">
              <CardTitle className="text-base">Inactive User Login Attempts</CardTitle>

              <Button variant="ghost" size="sm" onClick={loadLoginAttempts} disabled={attemptsLoading}>
                {attemptsLoading ? 'Refreshing…' : 'Refresh'}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md mt-[5px]">

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Login Attempt Date &amp; Time</TableHead>
                      <TableHead>Login Status</TableHead>
                      <TableHead>Last Login Attempt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attemptsLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                      ))
                    ) : loginAttempts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No inactive login attempts recorded.
                        </TableCell>
                      </TableRow>
                    ) : (
                      loginAttempts.map((a) => {
                        const u = users.find((x) => x.id === a.user_id || x.email.toLowerCase() === a.email.toLowerCase());
                        return (
                          <TableRow key={a.id}>
                            <TableCell className="font-medium">{u?.full_name ?? '—'}</TableCell>
                            <TableCell>{a.email}</TableCell>
                            <TableCell className="text-sm">{formatDateTime(a.attempted_at)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="border-destructive text-destructive">Inactive User</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {u?.last_login_attempt_at
                                ? formatDateTime(u.last_login_attempt_at)
                                : '—'}
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

        {/* CUSTOM ROLES TAB */}
        <TabsContent value="custom-roles" className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Badge variant="outline" className="text-xs">
              <Building2 className="h-3 w-3 mr-1" /> All Tenants (Global)
            </Badge>
            <Button onClick={() => { setEditingCustomRole(null); setCustomRoleDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Create Role
            </Button>
          </div>
          <Card>
          <CardHeader className="border-b-2 border-green-500 pb-3">
            <CardTitle className="text-base">
              Custom Roles
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
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                      ))
                    ) : scopedCustomRoleRows.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No custom roles yet. Click "Create Role" to add one.
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
          <RolePermissions tenantId={null} tenantLabel="All Tenants (Global)" />
        </TabsContent>

        {/* APPROVAL MATRIX TAB */}
        <TabsContent value="approval-matrix">
          <ApprovalMatrixConfig tenantId={scopeTenantId === ALL_TENANTS ? null : scopeTenantId} />
        </TabsContent>

      </Tabs>

      {/* Dialogs */}
      <EditUserDialog
        open={!!editUser}
        onOpenChange={(o) => !o && setEditUser(null)}
        user={editUser}
        tenants={tenants}
        customRoles={scopedCustomRoles}
        disableRoleAndAccess={editUser?.id === user?.id}
        onSave={handleSaveEditUser}
      />

      <ReplaceUserDialog
        open={!!replaceCtx}
        onOpenChange={(o) => { if (!o) setReplaceCtx(null); }}
        inactiveUser={replaceCtx?.inactiveUser ?? null}
        onConfirmed={handleReplacementConfirmed}
      />

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

      <DeleteUserDialog
        open={!!deleteUser}
        onOpenChange={(o) => { if (!o) setDeleteUser(null); }}
        targetUser={deleteUser ? { id: deleteUser.id, email: deleteUser.email, full_name: deleteUser.full_name } : null}
        onDeleted={() => { setDeleteUser(null); loadData(); }}
      />

    </div>
  );
}
