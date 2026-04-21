import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

const ROLES = ['vendor', 'finance', 'purchase', 'approver', 'customer_admin', 'admin', 'sharvi_admin'] as const;
export type AppRole = typeof ROLES[number];

interface Tenant { id: string; name: string; }
interface CustomRoleOpt { id: string; name: string; is_active: boolean; }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentRole: AppRole | null;
  userName: string;
  onConfirm: (role: AppRole, tenantIds: string[], customRoleIds: string[]) => Promise<void>;
  tenants?: Tenant[];
  currentTenantIds?: string[];
  customRoles?: CustomRoleOpt[];
  currentCustomRoleIds?: string[];
}

export function ChangeRoleDialog({
  open, onOpenChange, currentRole, userName, onConfirm,
  tenants = [], currentTenantIds = [],
  customRoles = [], currentCustomRoleIds = [],
}: Props) {
  // Single value: built-in AppRole OR "custom:<id>"
  const initialSelected = currentCustomRoleIds[0]
    ? `custom:${currentCustomRoleIds[0]}`
    : (currentRole ?? 'vendor');
  const [selectedRole, setSelectedRole] = useState<string>(initialSelected);
  const [tenantIds, setTenantIds] = useState<string[]>(currentTenantIds);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedRole(
        currentCustomRoleIds[0]
          ? `custom:${currentCustomRoleIds[0]}`
          : (currentRole ?? 'vendor')
      );
      setTenantIds(currentTenantIds);
    }
  }, [open, currentRole, currentTenantIds.join(','), currentCustomRoleIds.join(',')]);

  const toggleTenant = (id: string) => {
    setTenantIds((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const isCustom = selectedRole.startsWith('custom:');
      const customRoleId = isCustom ? selectedRole.slice('custom:'.length) : null;
      const builtInRole: AppRole = isCustom ? 'vendor' : (selectedRole as AppRole);
      await onConfirm(builtInRole, tenantIds, customRoleId ? [customRoleId] : []);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Change Role &amp; Access</DialogTitle>
          <DialogDescription>Update role and tenant access for {userName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
              <SelectContent>
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Built-in Roles</div>
                {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
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
          </div>

          {tenants.length > 0 && (
            <div className="space-y-2">
              <Label>Tenant Access</Label>
              <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                {tenants.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={tenantIds.includes(t.id)} onCheckedChange={() => toggleTenant(t.id)} />
                    <span className="text-sm">{t.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
