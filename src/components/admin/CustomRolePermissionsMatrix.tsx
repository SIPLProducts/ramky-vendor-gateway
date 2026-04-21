import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { SCREENS } from '@/pages/RolePermissions';
import { Loader2, Save } from 'lucide-react';

interface Props {
  customRoleId: string;
  onDirtyChange?: (dirty: boolean) => void;
  onSaved?: () => void;
  onCancel?: () => void;
}

export function CustomRolePermissionsMatrix({ customRoleId, onDirtyChange, onSaved, onCancel }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('custom_role_screen_permissions')
        .select('screen_key, can_access')
        .eq('custom_role_id', customRoleId);
      if (error) {
        toast({ title: 'Failed to load permissions', description: error.message, variant: 'destructive' });
      }
      const map: Record<string, boolean> = {};
      SCREENS.forEach((s) => { map[s.key] = false; });
      (data ?? []).forEach((r) => { map[r.screen_key] = r.can_access; });
      setSaved(map);
      setDraft(map);
      setLoading(false);
    })();
  }, [customRoleId]);

  const dirty = useMemo(
    () => SCREENS.some((s) => !!draft[s.key] !== !!saved[s.key]),
    [draft, saved],
  );

  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  const toggle = (screenKey: string, next: boolean) => {
    setDraft((prev) => ({ ...prev, [screenKey]: next }));
  };

  const handleCancel = () => {
    setDraft(saved);
    onCancel?.();
  };

  const handleSave = async () => {
    const changes = SCREENS
      .filter((s) => !!draft[s.key] !== !!saved[s.key])
      .map((s) => ({ screen_key: s.key, can_access: !!draft[s.key] }));

    if (changes.length === 0) return;

    setSaving(true);
    const rows = changes.map((c) => ({
      custom_role_id: customRoleId,
      screen_key: c.screen_key,
      can_access: c.can_access,
    }));

    const { error } = await supabase
      .from('custom_role_screen_permissions')
      .upsert(rows, { onConflict: 'custom_role_id,screen_key' });

    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      setSaving(false);
      return;
    }

    await supabase.from('audit_logs').insert({
      action: 'custom_role_permissions_bulk_updated',
      user_id: user?.id,
      details: { custom_role_id: customRoleId, changes },
    });

    setSaved({ ...draft });
    setSaving(false);
    toast({ title: 'Permissions saved', description: `${changes.length} change(s) applied.` });
    onSaved?.();
  };

  if (loading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between min-h-[24px]">
        <p className="text-xs text-muted-foreground">
          Tick the screens this role can access, then click Save.
        </p>
        {dirty && (
          <Badge variant="secondary" className="text-xs">
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-primary inline-block" />
            Unsaved changes
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto pr-1">
        {SCREENS.map((s) => (
          <label
            key={s.key}
            className="flex items-center gap-2 p-2 border rounded-md cursor-pointer hover:bg-muted/50"
          >
            <Checkbox
              checked={!!draft[s.key]}
              onCheckedChange={(v) => toggle(s.key, !!v)}
              disabled={saving}
            />
            <span className="text-sm">{s.label}</span>
          </label>
        ))}
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="outline" onClick={handleCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!dirty || saving}>
          {saving
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</>
            : <><Save className="h-4 w-4 mr-2" /> Save changes</>}
        </Button>
      </div>
    </div>
  );
}
