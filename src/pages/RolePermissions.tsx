import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Shield } from 'lucide-react';
import { AppRole } from '@/components/admin/ChangeRoleDialog';

const BUILTIN_ROLES: AppRole[] = ['vendor', 'finance', 'purchase', 'approver', 'customer_admin', 'admin', 'sharvi_admin'];

interface CustomRoleCol { id: string; name: string; }

export const SCREENS: { key: string; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'vendors', label: 'All Vendors' },
  { key: 'vendor_registration', label: 'Vendor Registration' },
  { key: 'finance_review', label: 'Finance Review' },
  { key: 'purchase_approval', label: 'Purchase Approval' },
  { key: 'sap_sync', label: 'SAP Sync' },
  { key: 'gst_compliance', label: 'GST Compliance' },
  { key: 'scheduled_checks', label: 'Scheduled Checks' },
  { key: 'audit_logs', label: 'Audit Logs' },
  { key: 'user_management', label: 'User Management' },
  { key: 'role_permissions', label: 'Role Permissions' },
  { key: 'admin_configuration', label: 'Admin Configuration' },
  { key: 'sharvi_admin_console', label: 'Sharvi Admin Console' },
  { key: 'vendor_invitations', label: 'Vendor Invitations' },
  { key: 'custom_roles', label: 'Custom Roles' },
  { key: 'support', label: 'Help & Support' },
];

type Matrix = Record<string, Record<string, boolean>>; // role -> screen -> can_access

export default function RolePermissions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [matrix, setMatrix] = useState<Matrix>({});
  const [customRoles, setCustomRoles] = useState<CustomRoleCol[]>([]);

  const load = async () => {
    setLoading(true);
    const [permsRes, customRolesRes, customPermsRes] = await Promise.all([
      supabase.from('role_screen_permissions').select('role, screen_key, can_access'),
      supabase.from('custom_roles').select('id, name').order('name'),
      supabase.from('custom_role_screen_permissions').select('custom_role_id, screen_key, can_access'),
    ]);
    if (permsRes.error) {
      toast({ title: 'Failed to load', description: permsRes.error.message, variant: 'destructive' });
      setLoading(false); return;
    }
    if (customRolesRes.error) {
      toast({ title: 'Failed to load custom roles', description: customRolesRes.error.message, variant: 'destructive' });
    }
    const m: Matrix = {};
    BUILTIN_ROLES.forEach((r) => { m[r] = {}; SCREENS.forEach((s) => { m[r][s.key] = false; }); });
    (customRolesRes.data ?? []).forEach((cr) => {
      const key = `custom:${cr.id}`;
      m[key] = {};
      SCREENS.forEach((s) => { m[key][s.key] = false; });
    });
    (permsRes.data ?? []).forEach((row) => {
      if (!m[row.role]) m[row.role] = {};
      m[row.role][row.screen_key] = row.can_access;
    });
    (customPermsRes.data ?? []).forEach((row) => {
      const key = `custom:${row.custom_role_id}`;
      if (!m[key]) m[key] = {};
      m[key][row.screen_key] = row.can_access;
    });
    setCustomRoles(customRolesRes.data ?? []);
    setMatrix(m);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggle = async (roleKey: string, screenKey: string, next: boolean) => {
    const isCustom = roleKey.startsWith('custom:');
    if (!isCustom && roleKey === 'sharvi_admin' && screenKey === 'role_permissions' && !next) {
      toast({ title: 'Blocked', description: 'Cannot remove sharvi_admin access to Role Permissions (lockout protection)', variant: 'destructive' });
      return;
    }
    setMatrix((prev) => ({ ...prev, [roleKey]: { ...prev[roleKey], [screenKey]: next } }));
    let error: any = null;
    if (isCustom) {
      const customRoleId = roleKey.slice('custom:'.length);
      const res = await supabase.from('custom_role_screen_permissions')
        .upsert({ custom_role_id: customRoleId, screen_key: screenKey, can_access: next }, { onConflict: 'custom_role_id,screen_key' });
      error = res.error;
    } else {
      const res = await supabase.from('role_screen_permissions')
        .upsert({ role: roleKey as AppRole, screen_key: screenKey, can_access: next }, { onConflict: 'role,screen_key' });
      error = res.error;
    }
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      setMatrix((prev) => ({ ...prev, [roleKey]: { ...prev[roleKey], [screenKey]: !next } }));
      return;
    }
    await supabase.from('audit_logs').insert({
      action: isCustom ? 'custom_role_screen_permission_changed' : 'role_screen_permission_changed',
      user_id: user?.id,
      details: { role: roleKey, screen_key: screenKey, can_access: next },
    });
  };

  const allColumns: { key: string; label: string; isCustom: boolean }[] = [
    ...BUILTIN_ROLES.map((r) => ({ key: r as string, label: r.replace('_', ' '), isCustom: false })),
    ...customRoles.map((c) => ({ key: `custom:${c.id}`, label: c.name, isCustom: true })),
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Shield className="h-6 w-6" /> Role &amp; Screen Permissions
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Control which screens each role (built-in and custom) can access. Changes apply immediately.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Permissions Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left p-3 sticky left-0 bg-card border-b font-medium text-sm">Screen</th>
                    {allColumns.map((c) => (
                      <th key={c.key} className="p-3 border-b text-center text-xs font-medium capitalize">
                        <div className="flex flex-col items-center gap-1">
                          <span>{c.label}</span>
                          {c.isCustom && <span className="text-[9px] text-primary font-normal normal-case">custom</span>}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SCREENS.map((s, idx) => (
                    <tr key={s.key} className={idx % 2 ? 'bg-muted/30' : ''}>
                      <td className="p-3 sticky left-0 bg-inherit text-sm font-medium border-b">{s.label}</td>
                      {allColumns.map((c) => (
                        <td key={c.key} className="p-3 text-center border-b">
                          <Checkbox
                            checked={!!matrix[c.key]?.[s.key]}
                            onCheckedChange={(v) => toggle(c.key, s.key, !!v)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
