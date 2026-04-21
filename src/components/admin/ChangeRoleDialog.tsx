import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const ROLES = ['vendor', 'finance', 'purchase', 'approver', 'customer_admin', 'admin', 'sharvi_admin'] as const;
export type AppRole = typeof ROLES[number];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentRole: AppRole | null;
  userName: string;
  onConfirm: (role: AppRole) => Promise<void>;
}

export function ChangeRoleDialog({ open, onOpenChange, currentRole, userName, onConfirm }: Props) {
  const [role, setRole] = useState<AppRole>(currentRole ?? 'vendor');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onConfirm(role);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Role</DialogTitle>
          <DialogDescription>Update role for {userName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label>Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || role === currentRole}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
