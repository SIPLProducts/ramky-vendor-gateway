import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import type { AppRole } from './ChangeRoleDialog';

const ALL_ROLES: AppRole[] = ['vendor', 'finance', 'purchase', 'approver', 'customer_admin', 'admin', 'sharvi_admin'];

interface Tenant { id: string; name: string; }
interface CustomRoleOpt { id: string; name: string; is_active: boolean; }

export interface EditUserData {
  id: string;
  full_name: string | null;
  status: 'active' | 'inactive';
  email: string;
  role: AppRole | null;
  tenantIds: string[];
  customRoleIds: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  user: EditUserData | null;
  tenants: Tenant[];
  customRoles: CustomRoleOpt[];
  disableRoleAndAccess?: boolean;
  onSave: (patch: {
    full_name: string;
    status: 'active' | 'inactive';
    role: AppRole;
    tenantIds: string[];
    customRoleIds: string[];
  }) => Promise<void>;
}

export function EditUserDialog({
  open, onOpenChange, user, tenants, customRoles, disableRoleAndAccess = false, onSave,
}: Props) {
  const [fullName, setFullName] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [selectedRole, setSelectedRole] = useState<string>('vendor');
  const [tenantIds, setTenantIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && user) {
      setFullName(user.full_name ?? '');
      setStatus(user.status);
      setSelectedRole(
        user.customRoleIds[0]
          ? `custom:${user.customRoleIds[0]}`
          : (user.role ?? 'vendor')
      );
      setTenantIds(user.tenantIds);
    }
  }, [open, user]);

  const toggleTenant = (id: string) => {
    setTenantIds((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const isCustom = selectedRole.startsWith('custom:');
      const customRoleId = isCustom ? selectedRole.slice('custom:'.length) : null;
      const builtInRole: AppRole = isCustom ? 'vendor' : (selectedRole as AppRole);
      await onSave({
        full_name: fullName.trim(),
        status,
        role: builtInRole,
        tenantIds,
        customRoleIds: customRoleId ? [customRoleId] : [],
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update name, status{disableRoleAndAccess ? '' : ', role and tenant access'}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={user?.email ?? ''} disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Full Name</Label>
            <Input id="edit-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as 'active' | 'inactive')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            {status === 'inactive' && (
              <p className="text-xs text-muted-foreground">
                Inactive users cannot log in. Their login attempts are logged for review.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole} disabled={disableRoleAndAccess}>
              <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
              <SelectContent>
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Built-in Roles</div>
                {ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                {customRoles.length > 0 && (
                  <>
                    <div className="px-2 py-1 mt-1 text-xs font-medium text-muted-foreground border-t">Custom Roles</div>
                    {customRoles.map((c) => (
                      <SelectItem key={c.id} value={`custom:${c.id}`} disabled={!c.is_active}>
                        {c.name}{!c.is_active && ' (inactive)'}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
            {disableRoleAndAccess && (
              <p className="text-xs text-muted-foreground">You cannot change your own role or access.</p>
            )}
          </div>

          {tenants.length > 0 && (
            <div className="space-y-1.5">
              <Label>Tenant Access</Label>
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                {tenants.map((t) => (
                  <label key={t.id} className={`flex items-center gap-2 ${disableRoleAndAccess ? 'opacity-60' : 'cursor-pointer'}`}>
                    <Checkbox
                      checked={tenantIds.includes(t.id)}
                      onCheckedChange={() => toggleTenant(t.id)}
                      disabled={disableRoleAndAccess}
                    />
                    <span className="text-sm">{t.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
