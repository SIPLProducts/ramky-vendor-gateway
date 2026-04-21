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

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentRole: AppRole | null;
  userName: string;
  onConfirm: (role: AppRole, tenantIds: string[]) => Promise<void>;
  tenants?: Tenant[];
  currentTenantIds?: string[];
}

export function ChangeRoleDialog({
  open, onOpenChange, currentRole, userName, onConfirm,
  tenants = [], currentTenantIds = [],
}: Props) {
  const [role, setRole] = useState<AppRole>(currentRole ?? 'vendor');
  const [tenantIds, setTenantIds] = useState<string[]>(currentTenantIds);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setRole(currentRole ?? 'vendor');
      setTenantIds(currentTenantIds);
    }
  }, [open, currentRole, currentTenantIds.join(',')]);

  const toggleTenant = (id: string) => {
    setTenantIds((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onConfirm(role, tenantIds);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const sameRole = role === currentRole;
  const sameTenants = tenantIds.length === currentTenantIds.length &&
    tenantIds.every((id) => currentTenantIds.includes(id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Role &amp; Tenants</DialogTitle>
          <DialogDescription>Update role and tenant access for {userName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {tenants.length > 0 && (
            <div className="space-y-2">
              <Label>Tenant Access</Label>
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
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
          <Button onClick={handleSave} disabled={saving || (sameRole && sameTenants)}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
