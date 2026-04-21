import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { SCREENS } from '@/pages/RolePermissions';

interface Props {
  customRoleId: string;
}

export function CustomRolePermissionsMatrix({ customRoleId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

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
      setPerms(map);
      setLoading(false);
    })();
  }, [customRoleId]);

  const toggle = async (screenKey: string, next: boolean) => {
    setPerms((prev) => ({ ...prev, [screenKey]: next }));
    const { error } = await supabase
      .from('custom_role_screen_permissions')
      .upsert({ custom_role_id: customRoleId, screen_key: screenKey, can_access: next }, { onConflict: 'custom_role_id,screen_key' });
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      setPerms((prev) => ({ ...prev, [screenKey]: !next }));
      return;
    }
    await supabase.from('audit_logs').insert({
      action: 'custom_role_permission_changed',
      user_id: user?.id,
      details: { custom_role_id: customRoleId, screen_key: screenKey, can_access: next },
    });
  };

  if (loading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {SCREENS.map((s) => (
        <label key={s.key} className="flex items-center gap-2 p-2 border rounded-md cursor-pointer hover:bg-muted/50">
          <Checkbox checked={!!perms[s.key]} onCheckedChange={(v) => toggle(s.key, !!v)} />
          <span className="text-sm">{s.label}</span>
        </label>
      ))}
    </div>
  );
}
