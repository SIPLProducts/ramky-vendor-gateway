import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface Tenant { id: string; name: string; }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenants: Tenant[];
  currentTenantIds: string[];
  userName: string;
  onConfirm: (tenantId: string) => Promise<void>;
}

export function AssignTenantDialog({ open, onOpenChange, tenants, currentTenantIds, userName, onConfirm }: Props) {
  const [tenantId, setTenantId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const available = tenants.filter((t) => !currentTenantIds.includes(t.id));

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      await onConfirm(tenantId);
      setTenantId('');
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Tenant</DialogTitle>
          <DialogDescription>Add tenant access for {userName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label>Tenant</Label>
          <Select value={tenantId} onValueChange={setTenantId}>
            <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
            <SelectContent>
              {available.length === 0 ? (
                <div className="px-2 py-3 text-sm text-muted-foreground">No tenants available</div>
              ) : (
                available.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)
              )}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !tenantId}>
            {saving ? 'Saving…' : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
