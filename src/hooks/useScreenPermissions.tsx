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

      // 2. Custom roles assigned to this user (load first so we know whether to skip approver placeholder perms)
      const { data: assigns, error: aErr } = await supabase
        .from('user_custom_roles')
        .select('custom_role_id')
        .eq('user_id', user.id);
      if (aErr) console.error(aErr);
      const roleIds = (assigns ?? []).map((a) => a.custom_role_id);

      // 1. Built-in role permissions — skip when user has custom roles AND built-in role is the
      //    'approver' placeholder (assigned automatically when creating a user with a custom role).
      //    Otherwise approver's matrix permissions would leak on top of the custom role.
      const skipBuiltIn = userRole === 'approver' && roleIds.length > 0;
      if (userRole && !skipBuiltIn) {
        const { data, error } = await supabase
          .from('role_screen_permissions')
          .select('screen_key, can_access')
          .eq('role', userRole);
        if (error) console.error(error);
        else (data ?? []).filter((r) => r.can_access).forEach((r) => merged.add(r.screen_key));
      }

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

      // 3. Anyone assigned as an approver in the matrix can see "My Approvals"
      //    Match by user_id OR by approver_email (case-insensitive) for free-text approvers
      const email = (user.email ?? '').toLowerCase();
      const { data: apprRows } = await supabase
        .from('approval_matrix_approvers')
        .select('id')
        .or(
          email
            ? `user_id.eq.${user.id},approver_email.ilike.${email}`
            : `user_id.eq.${user.id}`
        )
        .limit(1);
      if (apprRows && apprRows.length > 0) merged.add('my_approvals');

      if (!cancelled) {
        setAllowed(merged);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, userRole]);

  return { allowed, loading, can: (key: string) => allowed.has(key) };
}
