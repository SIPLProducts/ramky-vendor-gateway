import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, ShieldCheck, Settings } from 'lucide-react';
import { CustomRoleDialog, CustomRoleData } from '@/components/admin/CustomRoleDialog';
import { CustomRolePermissionsMatrix } from '@/components/admin/CustomRolePermissionsMatrix';

interface CustomRoleRow extends CustomRoleData {
  id: string;
  user_count: number;
  created_at: string;
}

export default function CustomRoles() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<CustomRoleRow[]>([]);
  const [editing, setEditing] = useState<CustomRoleData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [permsRole, setPermsRole] = useState<CustomRoleRow | null>(null);

  const load = async () => {
    setLoading(true);
    const [rolesRes, assignsRes] = await Promise.all([
      supabase.from('custom_roles').select('*').order('created_at', { ascending: false }),
      supabase.from('user_custom_roles').select('custom_role_id'),
    ]);
    if (rolesRes.error) {
      toast({ title: 'Failed to load', description: rolesRes.error.message, variant: 'destructive' });
      setLoading(false); return;
    }
    const counts = new Map<string, number>();
    (assignsRes.data ?? []).forEach((a) => counts.set(a.custom_role_id, (counts.get(a.custom_role_id) ?? 0) + 1));
    setRoles((rolesRes.data ?? []).map((r) => ({ ...r, user_count: counts.get(r.id) ?? 0 })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data: CustomRoleData) => {
    try {
      if (data.id) {
        const { error } = await supabase
          .from('custom_roles')
          .update({ name: data.name, description: data.description, is_active: data.is_active })
          .eq('id', data.id);
        if (error) throw error;
        await supabase.from('audit_logs').insert({
          action: 'custom_role_updated', user_id: user?.id,
          details: { id: data.id, name: data.name },
        });
        toast({ title: 'Role updated' });
      } else {
        const { data: created, error } = await supabase
          .from('custom_roles')
          .insert({ name: data.name, description: data.description, is_active: data.is_active, created_by: user?.id })
          .select().single();
        if (error) throw error;
        await supabase.from('audit_logs').insert({
          action: 'custom_role_created', user_id: user?.id,
          details: { id: created.id, name: data.name },
        });
        toast({ title: 'Role created' });
      }
      await load();
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
      throw err;
    }
  };

  const handleDelete = async (role: CustomRoleRow) => {
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
      action: 'custom_role_deleted', user_id: user?.id,
      details: { id: role.id, name: role.name },
    });
    toast({ title: 'Role deleted' });
    await load();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6" /> Custom Roles
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define custom roles with specific screen access. Assign them to users alongside their built-in role.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Create Role
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All Custom Roles</CardTitle></CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                  ))
                ) : roles.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No custom roles yet. Click "Create Role" to add one.
                  </TableCell></TableRow>
                ) : (
                  roles.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
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
                          <Button variant="ghost" size="sm" onClick={() => { setEditing(r); setDialogOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(r)} className="text-destructive">
                            <Trash2 className="h-4 w-4" />
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

      <CustomRoleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSave={handleSave}
      />

      <Dialog open={!!permsRole} onOpenChange={(o) => !o && setPermsRole(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Screen Permissions — {permsRole?.name}</DialogTitle>
            <DialogDescription>
              Check the screens users with this role should be able to access. Changes save automatically.
            </DialogDescription>
          </DialogHeader>
          {permsRole && <CustomRolePermissionsMatrix customRoleId={permsRole.id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
