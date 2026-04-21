import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, X, Search } from 'lucide-react';

interface Profile { id: string; full_name: string | null; email: string; }

interface Props {
  selectedUserIds: string[];
  onChange: (ids: string[]) => void;
  tenantId?: string | null;
}

export function ApproverPicker({ selectedUserIds, onChange, tenantId }: Props) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      let userIds: string[] | null = null;
      if (tenantId) {
        const { data } = await supabase.from('user_tenants').select('user_id').eq('tenant_id', tenantId);
        userIds = (data ?? []).map((u) => u.user_id);
      }
      let q = supabase.from('profiles').select('id, full_name, email').order('full_name');
      if (userIds && userIds.length > 0) q = q.in('id', userIds);
      const { data } = await q;
      setProfiles(data ?? []);
    })();
  }, [tenantId]);

  const byId = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profiles.filter((p) => {
      if (selectedUserIds.includes(p.id)) return false;
      if (!q) return true;
      return (p.full_name?.toLowerCase().includes(q) || p.email.toLowerCase().includes(q));
    });
  }, [profiles, search, selectedUserIds]);

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {selectedUserIds.map((id) => {
        const p = byId.get(id);
        return (
          <Badge key={id} variant="secondary" className="gap-1 pr-1">
            {p?.full_name ?? p?.email ?? id.slice(0, 8)}
            <button
              type="button"
              onClick={() => onChange(selectedUserIds.filter((x) => x !== id))}
              className="hover:bg-destructive/20 rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        );
      })}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 px-2">
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start">
          <div className="relative mb-2">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 h-8"
            />
          </div>
          <div className="max-h-64 overflow-y-auto space-y-0.5">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2 text-center">No users found</p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="w-full text-left p-2 rounded hover:bg-accent text-sm"
                  onClick={() => { onChange([...selectedUserIds, p.id]); setSearch(''); }}
                >
                  <div className="font-medium">{p.full_name ?? '—'}</div>
                  <div className="text-xs text-muted-foreground">{p.email}</div>
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
