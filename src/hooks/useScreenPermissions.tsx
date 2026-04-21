import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useScreenPermissions() {
  const { userRole } = useAuth();
  const [allowed, setAllowed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!userRole) { setAllowed(new Set()); setLoading(false); return; }
    (async () => {
      const { data, error } = await supabase
        .from('role_screen_permissions')
        .select('screen_key, can_access')
        .eq('role', userRole);
      if (cancelled) return;
      if (error) { console.error(error); setAllowed(new Set()); }
      else setAllowed(new Set((data ?? []).filter((r) => r.can_access).map((r) => r.screen_key)));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userRole]);

  return { allowed, loading, can: (key: string) => allowed.has(key) };
}
