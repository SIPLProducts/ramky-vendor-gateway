import { createContext, useContext, useEffect, useState, useMemo, useCallback, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface TenantOption {
  id: string;
  name: string;
  code: string;
}

interface TenantContextValue {
  myTenants: TenantOption[];
  myTenantIds: string[];
  activeTenantId: string | null; // null = "all" (super admin only)
  setActiveTenantId: (id: string | null) => void;
  isSuperAdmin: boolean;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

const STORAGE_KEY = 'lovable.activeTenantId';

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, userRole } = useAuth();
  const isSuperAdmin = userRole === 'sharvi_admin' || userRole === 'admin';

  const [activeTenantId, setActiveTenantIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEY) || null;
  });

  // Load tenants the user belongs to (for super admins, load all active tenants)
  const { data: myTenants = [], isLoading } = useQuery({
    queryKey: ['my-tenants', user?.id, isSuperAdmin],
    queryFn: async (): Promise<TenantOption[]> => {
      if (!user?.id) return [];

      if (isSuperAdmin) {
        const { data, error } = await supabase
          .from('tenants')
          .select('id, name, code')
          .eq('is_active', true)
          .order('name');
        if (error) throw error;
        return data || [];
      }

      const { data, error } = await supabase
        .from('user_tenants')
        .select('tenant_id, is_default, tenants!inner(id, name, code, is_active)')
        .eq('user_id', user.id);
      if (error) throw error;

      return (data || [])
        .map((row: any) => row.tenants)
        .filter((t: any) => t && t.is_active)
        .map((t: any) => ({ id: t.id, name: t.name, code: t.code }));
    },
    enabled: !!user?.id,
  });

  const myTenantIds = useMemo(() => myTenants.map((t) => t.id), [myTenants]);

  // Initialize active tenant once tenants load
  useEffect(() => {
    if (isLoading || !user?.id) return;

    if (isSuperAdmin) {
      // Super admin: validate stored id, otherwise null = all
      if (activeTenantId && !myTenantIds.includes(activeTenantId)) {
        setActiveTenantIdState(null);
      }
      return;
    }

    // Non super admin: must have an active tenant if any are available
    if (myTenantIds.length === 0) {
      setActiveTenantIdState(null);
      return;
    }
    if (!activeTenantId || !myTenantIds.includes(activeTenantId)) {
      setActiveTenantIdState(myTenantIds[0]);
    }
  }, [isLoading, user?.id, isSuperAdmin, myTenantIds, activeTenantId]);

  const setActiveTenantId = useCallback(
    (id: string | null) => {
      setActiveTenantIdState(id);
      if (typeof window !== 'undefined') {
        if (id) localStorage.setItem(STORAGE_KEY, id);
        else localStorage.removeItem(STORAGE_KEY);
      }
    },
    [],
  );

  const value = useMemo<TenantContextValue>(
    () => ({ myTenants, myTenantIds, activeTenantId, setActiveTenantId, isSuperAdmin, isLoading }),
    [myTenants, myTenantIds, activeTenantId, setActiveTenantId, isSuperAdmin, isLoading],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenantContext() {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    // Provide safe defaults if used outside provider (e.g. on public pages)
    return {
      myTenants: [],
      myTenantIds: [],
      activeTenantId: null,
      setActiveTenantId: () => {},
      isSuperAdmin: false,
      isLoading: false,
    } as TenantContextValue;
  }
  return ctx;
}

/**
 * Returns the tenant filter to apply to queries.
 * - If activeTenantId is set, returns [activeTenantId].
 * - Else returns all tenant ids the user belongs to.
 * - For super admins with no active tenant, returns null (no filter / all tenants).
 */
export function useTenantFilter(): { tenantIds: string[] | null; activeTenantId: string | null } {
  const { myTenantIds, activeTenantId, isSuperAdmin } = useTenantContext();
  if (activeTenantId) return { tenantIds: [activeTenantId], activeTenantId };
  if (isSuperAdmin) return { tenantIds: null, activeTenantId: null };
  return { tenantIds: myTenantIds, activeTenantId: null };
}
