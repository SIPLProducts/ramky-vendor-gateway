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
import { useToast } from '@/hooks/use-toast';
import { Search, UserCog, Building2, Users, Plus, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ChangeRoleDialog, AppRole } from '@/components/admin/ChangeRoleDialog';
import { AssignTenantDialog } from '@/components/admin/AssignTenantDialog';
import { CreateUserDialog } from '@/components/admin/CreateUserDialog';

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
interface CustomRoleOpt { id: string; name: string; is_active: boolean; }

const ALL_ROLES: AppRole[] = ['vendor', 'finance', 'purchase', 'approver', 'customer_admin', 'admin', 'sharvi_admin'];

export default function UserManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRoleOpt[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [roleDialog, setRoleDialog] = useState<UserRow | null>(null);
  const [tenantDialog, setTenantDialog] = useState<UserRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();

  const loadData = async () => {
    setLoading(true);
    try {
      const [profilesRes, rolesRes, userTenantsRes, tenantsRes, customRolesRes, userCustomRes] = await Promise.all([
        supabase.from('profiles').select('id, email, full_name, created_at').order('created_at', { ascending: false }),
        supabase.from('user_roles').select('user_id, role'),
        supabase.from('user_tenants').select('user_id, tenant_id'),
        supabase.from('tenants').select('id, name').eq('is_active', true).order('name'),
        supabase.from('custom_roles').select('id, name, is_active').order('name'),
        supabase.from('user_custom_roles').select('user_id, custom_role_id'),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;
      if (userTenantsRes.error) throw userTenantsRes.error;
      if (tenantsRes.error) throw tenantsRes.error;
      if (customRolesRes.error) throw customRolesRes.error;
      if (userCustomRes.error) throw userCustomRes.error;

      const tenantMap = new Map<string, Tenant>((tenantsRes.data ?? []).map((t) => [t.id, t]));
      const customRoleMap = new Map<string, CustomRoleOpt>((customRolesRes.data ?? []).map((c) => [c.id, c]));
      const roleMap = new Map<string, AppRole>((rolesRes.data ?? []).map((r) => [r.user_id, r.role as AppRole]));
      const utByUser = new Map<string, string[]>();
      (userTenantsRes.data ?? []).forEach((ut) => {
        const arr = utByUser.get(ut.user_id) ?? [];
        arr.push(ut.tenant_id);
        utByUser.set(ut.user_id, arr);
      });
      const cuByUser = new Map<string, string[]>();
      (userCustomRes.data ?? []).forEach((uc) => {
        const arr = cuByUser.get(uc.user_id) ?? [];
        arr.push(uc.custom_role_id);
        cuByUser.set(uc.user_id, arr);
      });

      setTenants(tenantsRes.data ?? []);
      setCustomRoles(customRolesRes.data ?? []);
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (!q) return true;
      return (u.email?.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q));
    });
  }, [users, search, roleFilter]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    users.forEach((u) => { if (u.role) counts[u.role] = (counts[u.role] ?? 0) + 1; });
    return { total: users.length, counts };
  }, [users]);

  const handleChangeRole = async (newRole: AppRole, newTenantIds: string[]) => {
    if (!roleDialog) return;
    if (roleDialog.id === user?.id && newRole !== roleDialog.role) {
      toast({ title: 'Action blocked', description: 'You cannot change your own role.', variant: 'destructive' });
      return;
    }
    try {
      // Role update (only if changed)
      if (newRole !== roleDialog.role) {
        const { error: delErr } = await supabase.from('user_roles').delete().eq('user_id', roleDialog.id);
        if (delErr) throw delErr;
        const { error: insErr } = await supabase.from('user_roles').insert({ user_id: roleDialog.id, role: newRole });
        if (insErr) throw insErr;

        await supabase.from('audit_logs').insert({
          action: 'role_changed',
          user_id: user?.id,
          details: { target_user_id: roleDialog.id, target_email: roleDialog.email, old_role: roleDialog.role, new_role: newRole },
        });
      }

      // Tenant sync — diff and apply
      const currentIds = roleDialog.tenants.map((t) => t.id);
      const toAdd = newTenantIds.filter((id) => !currentIds.includes(id));
      const toRemove = currentIds.filter((id) => !newTenantIds.includes(id));
      if (toRemove.length > 0) {
        const { error } = await supabase.from('user_tenants')
          .delete().eq('user_id', roleDialog.id).in('tenant_id', toRemove);
        if (error) throw error;
      }
      if (toAdd.length > 0) {
        const rows = toAdd.map((tid) => ({ user_id: roleDialog.id, tenant_id: tid }));
        const { error } = await supabase.from('user_tenants').insert(rows);
        if (error) throw error;
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Users className="h-6 w-6" /> User Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage application users, roles, and tenant assignments.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/admin/role-permissions')}>
            <Shield className="h-4 w-4 mr-2" /> Role Permissions
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Create User
          </Button>
        </div>
      </div>

      {/* Stats */}
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

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Users</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
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
                  <TableHead>Tenants</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No users found
                    </TableCell>
                  </TableRow>
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
                          {u.tenants.length === 0 ? (
                            <span className="text-muted-foreground text-xs">None</span>
                          ) : (
                            u.tenants.map((t) => (
                              <Badge
                                key={t.id}
                                variant="outline"
                                className="cursor-pointer hover:bg-destructive/10"
                                onClick={() => handleRemoveTenant(u.id, t.id)}
                                title="Click to remove"
                              >
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRoleDialog(u)}
                            disabled={u.id === user?.id}
                            title={u.id === user?.id ? 'Cannot change own role' : 'Change role'}
                          >
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

      {roleDialog && (
        <ChangeRoleDialog
          open={!!roleDialog}
          onOpenChange={(o) => !o && setRoleDialog(null)}
          currentRole={roleDialog.role}
          userName={roleDialog.full_name ?? roleDialog.email}
          tenants={tenants}
          currentTenantIds={roleDialog.tenants.map((t) => t.id)}
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
        onCreated={loadData}
      />
    </div>
  );
}
