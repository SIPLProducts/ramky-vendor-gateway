import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Search } from 'lucide-react';
import { useAllProfilesWithRoles } from '@/hooks/useTenant';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  tenantName?: string;
}

export function AssignUsersToTenantDialog({ open, onOpenChange, tenantId, tenantName }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: profiles = [], isLoading } = useAllProfilesWithRoles();

  const { data: existingLinks = [] } = useQuery({
    queryKey: ['user-tenants-for', tenantId, open],
    queryFn: async () => {
      if (!tenantId) return [] as string[];
      const { data, error } = await supabase
        .from('user_tenants')
        .select('user_id')
        .eq('tenant_id', tenantId);
      if (error) throw error;
      return (data ?? []).map((d) => d.user_id);
    },
    enabled: open && !!tenantId,
  });

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setSelected(new Set(existingLinks));
  }, [open, existingLinks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) => (p.full_name ?? '').toLowerCase().includes(q) || p.email.toLowerCase().includes(q),
    );
  }, [profiles, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const before = new Set(existingLinks);
      const after = selected;
      const toAdd = [...after].filter((id) => !before.has(id));
      const toRemove = [...before].filter((id) => !after.has(id));

      if (toAdd.length > 0) {
        const { error } = await supabase
          .from('user_tenants')
          .insert(toAdd.map((user_id) => ({ user_id, tenant_id: tenantId })));
        if (error) throw error;
      }
      if (toRemove.length > 0) {
        const { error } = await supabase
          .from('user_tenants')
          .delete()
          .eq('tenant_id', tenantId)
          .in('user_id', toRemove);
        if (error) throw error;
      }

      await queryClient.invalidateQueries({ queryKey: ['tenant-users-with-roles'] });
      await queryClient.invalidateQueries({ queryKey: ['user-tenants-for', tenantId] });
      await queryClient.invalidateQueries({ queryKey: ['tenant-user-counts'] });

      toast({ title: 'Users updated', description: `${toAdd.length} added, ${toRemove.length} removed.` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Failed to save', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assign Users{tenantName ? ` · ${tenantName}` : ''}</DialogTitle>
          <DialogDescription>
            Check the users who should belong to this tenant. They will then be eligible as approvers.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="border rounded-md max-h-[24rem] overflow-y-auto divide-y">
          {isLoading ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-center text-muted-foreground">No users match your search.</div>
          ) : (
            filtered.map((p) => {
              const checked = selected.has(p.id);
              return (
                <label
                  key={p.id}
                  className="flex items-center gap-3 p-3 hover:bg-accent cursor-pointer"
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggle(p.id)} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{p.full_name ?? '—'}</div>
                    <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                  </div>
                  {p.role && (
                    <Badge variant="outline" className="text-[10px] shrink-0">{p.role}</Badge>
                  )}
                </label>
              );
            })
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          {selected.size} selected · {existingLinks.length} currently assigned
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Assignments'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
