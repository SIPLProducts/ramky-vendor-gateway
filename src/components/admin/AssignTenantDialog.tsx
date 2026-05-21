import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';

interface Tenant { id: string; name: string; }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenants: Tenant[];
  currentTenantIds: string[];
  userName: string;
  onConfirm: (tenantIds: string[]) => Promise<void>;
}

export function AssignTenantDialog({ open, onOpenChange, tenants, currentTenantIds, userName, onConfirm }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const available = tenants.filter((t) => !currentTenantIds.includes(t.id));
  const options = available.map((t) => ({ value: t.id, label: t.name }));

  useEffect(() => {
    if (!open) setSelectedIds([]);
  }, [open]);

  const handleSave = async () => {
    if (selectedIds.length === 0) return;
    setSaving(true);
    try {
      await onConfirm(selectedIds);
      setSelectedIds([]);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Tenants</DialogTitle>
          <DialogDescription>Add tenant access for {userName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <div className="flex items-center justify-between">
            <Label>Tenants</Label>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">
                {selectedIds.length} / {available.length} selected
              </span>
              <button
                type="button"
                className="text-primary hover:underline disabled:opacity-50"
                disabled={available.length === 0 || selectedIds.length === available.length}
                onClick={() => setSelectedIds(available.map((t) => t.id))}
              >
                Select all
              </button>
              <button
                type="button"
                className="text-muted-foreground hover:underline disabled:opacity-50"
                disabled={selectedIds.length === 0}
                onClick={() => setSelectedIds([])}
              >
                Clear
              </button>
            </div>
          </div>
          {available.length === 0 ? (
            <div className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              No tenants available to assign
            </div>
          ) : (
            <MultiSelect
              options={options}
              selected={selectedIds}
              onChange={setSelectedIds}
              placeholder="Select tenants…"
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || selectedIds.length === 0}>
            {saving
              ? 'Saving…'
              : `Assign${selectedIds.length > 0 ? ` ${selectedIds.length} tenant${selectedIds.length === 1 ? '' : 's'}` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
