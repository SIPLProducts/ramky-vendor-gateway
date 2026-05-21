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
  activeTenantId: string | null; // null = "all"
  setActiveTenantId: (id: string | null) => void;
  isSuperAdmin: boolean;
  /** SCM Head, Finance 1/2, Finance Approval, CEO Office, SAP Team — see all tenants. */
  isCrossTenantReviewer: boolean;
  /** True when the user has the SCM Manager custom role. */
  isScmManager: boolean;
  /**
   * Vendor ids visible to an SCM Manager via buyer_scm_mappings.
   * `null` = not applicable (not an SCM-Manager-only user).
   * `[]`   = SCM Manager with no mapped buyers (sees nothing).
   */
  scmManagerVendorIds: string[] | null;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

const STORAGE_KEY = 'lovable.activeTenantId';

const CROSS_TENANT_ROLE_NAMES = new Set(
  ['scm head', 'finance 1', 'finance 2', 'finance approval', 'ceo office', 'sap team'],
);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, userRole } = useAuth();
  const isSuperAdmin = userRole === 'sharvi_admin' || userRole === 'admin';

  // Load custom-role names assigned to the user.
  const { data: customRoleNames = [] } = useQuery({
    queryKey: ['my-custom-role-names', user?.id],
    queryFn: async (): Promise<string[]> => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('user_custom_roles')
        .select('custom_roles!inner(name, is_active)')
        .eq('user_id', user.id);
      if (error) throw error;
      return (data || [])
        .map((r: any) => r?.custom_roles)
        .filter((c: any) => c && c.is_active)
        .map((c: any) => String(c.name).toLowerCase());
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const isCrossTenantReviewer = useMemo(
    () => customRoleNames.some((n) => CROSS_TENANT_ROLE_NAMES.has(n)),
    [customRoleNames],
  );
  const isScmManager = useMemo(
    () => customRoleNames.some((n) => n === 'scm manager'),
    [customRoleNames],
  );

  // SCM Manager vendor scoping (vendors invited by a mapped buyer).
  const { data: scmManagerVendorIds = null } = useQuery({
    queryKey: ['scm-manager-vendor-ids', user?.id],
    queryFn: async (): Promise<string[]> => {
      if (!user?.id) return [];
      const { data: mappings, error: mErr } = await supabase
        .from('buyer_scm_mappings')
        .select('buyer_user_id')
        .eq('scm_manager_user_id', user.id);
      if (mErr) throw mErr;
      const buyerIds = (mappings ?? []).map((m: any) => m.buyer_user_id).filter(Boolean);
      if (buyerIds.length === 0) return [];
      const { data: invites, error: iErr } = await supabase
        .from('vendor_invitations')
        .select('vendor_id')
        .in('created_by', buyerIds)
        .not('vendor_id', 'is', null);
      if (iErr) throw iErr;
      return Array.from(new Set((invites ?? []).map((r: any) => r.vendor_id))).filter(Boolean);
    },
    enabled: !!user?.id && isScmManager && !isCrossTenantReviewer && !isSuperAdmin,
    staleTime: 60 * 1000,
  });

  const [activeTenantId, setActiveTenantIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && stored !== 'null' ? stored : null;
  });

  const seesAllTenants = isSuperAdmin || isCrossTenantReviewer;

  // Load tenants the user belongs to (super admins & cross-tenant reviewers see ALL active tenants).
  const { data: myTenants = [], isLoading } = useQuery({
    queryKey: ['my-tenants', user?.id, seesAllTenants],
    queryFn: async (): Promise<TenantOption[]> => {
      if (!user?.id) return [];

      if (seesAllTenants) {
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

  useEffect(() => {
    if (isLoading || !user?.id) return;

    if (seesAllTenants) {
      // Default to "All" (null). Honor a stored id only if it's still valid.
      if (activeTenantId && !myTenantIds.includes(activeTenantId)) {
        setActiveTenantIdState(null);
        if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY);
      }
      return;
    }

    if (myTenantIds.length === 0) {
      setActiveTenantIdState(null);
      return;
    }
    if (!activeTenantId || !myTenantIds.includes(activeTenantId)) {
      setActiveTenantIdState(myTenantIds[0]);
    }
  }, [isLoading, user?.id, seesAllTenants, myTenantIds, activeTenantId]);

  const setActiveTenantId = useCallback((id: string | null) => {
    setActiveTenantIdState(id);
    if (typeof window !== 'undefined') {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const value = useMemo<TenantContextValue>(
    () => ({
      myTenants, myTenantIds, activeTenantId, setActiveTenantId,
      isSuperAdmin, isCrossTenantReviewer, isScmManager,
      scmManagerVendorIds: isScmManager && !isCrossTenantReviewer && !isSuperAdmin
        ? (scmManagerVendorIds ?? [])
        : null,
      isLoading,
    }),
    [myTenants, myTenantIds, activeTenantId, setActiveTenantId, isSuperAdmin,
     isCrossTenantReviewer, isScmManager, scmManagerVendorIds, isLoading],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenantContext() {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    return {
      myTenants: [], myTenantIds: [], activeTenantId: null, setActiveTenantId: () => {},
      isSuperAdmin: false, isCrossTenantReviewer: false, isScmManager: false,
      scmManagerVendorIds: null, isLoading: false,
    } as TenantContextValue;
  }
  return ctx;
}

/**
 * Returns the query filter to apply for the current user.
 * - `tenantIds: [id]` when a single tenant is selected.
 * - `tenantIds: null` for super admins / cross-tenant reviewers viewing "All".
 * - `tenantIds: string[]` for normal users limited to their assigned tenants.
 * - `vendorIds: string[]` for SCM Managers — scope to vendors invited by their mapped buyers
 *   (takes precedence over tenant filtering). Empty array = no visible vendors.
 */
export function useTenantFilter(): {
  tenantIds: string[] | null;
  activeTenantId: string | null;
  vendorIds: string[] | null;
} {
  const {
    myTenantIds, activeTenantId, isSuperAdmin, isCrossTenantReviewer,
    isScmManager, scmManagerVendorIds,
  } = useTenantContext();

  // SCM Manager (without higher cross-tenant role): scope by buyer-mapped vendor ids.
  if (isScmManager && !isCrossTenantReviewer && !isSuperAdmin) {
    return { tenantIds: null, activeTenantId: null, vendorIds: scmManagerVendorIds ?? [] };
  }
  if (activeTenantId) return { tenantIds: [activeTenantId], activeTenantId, vendorIds: null };
  if (isSuperAdmin || isCrossTenantReviewer) return { tenantIds: null, activeTenantId: null, vendorIds: null };
  return { tenantIds: myTenantIds, activeTenantId: null, vendorIds: null };
}
