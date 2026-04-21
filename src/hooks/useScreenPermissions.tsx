import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useScreenPermissions() {
  const { user, userRole } = useAuth();
  const [allowed, setAllowed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) { setAllowed(new Set()); setLoading(false); return; }
    (async () => {
      setLoading(true);
      const merged = new Set<string>();

      // 1. Built-in role permissions
      if (userRole) {
        const { data, error } = await supabase
          .from('role_screen_permissions')
          .select('screen_key, can_access')
          .eq('role', userRole);
        if (error) console.error(error);
        else (data ?? []).filter((r) => r.can_access).forEach((r) => merged.add(r.screen_key));
      }

      // 2. Custom roles assigned to this user
      const { data: assigns, error: aErr } = await supabase
        .from('user_custom_roles')
        .select('custom_role_id')
        .eq('user_id', user.id);
      if (aErr) console.error(aErr);
      const roleIds = (assigns ?? []).map((a) => a.custom_role_id);

      if (roleIds.length > 0) {
        const { data: perms, error: pErr } = await supabase
          .from('custom_role_screen_permissions')
          .select('screen_key, can_access, custom_role_id, custom_roles!inner(is_active)')
          .in('custom_role_id', roleIds);
        if (pErr) console.error(pErr);
        (perms ?? []).forEach((p: any) => {
          if (p.can_access && p.custom_roles?.is_active) merged.add(p.screen_key);
        });
      }

      if (!cancelled) {
        setAllowed(merged);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, userRole]);

  return { allowed, loading, can: (key: string) => allowed.has(key) };
}
