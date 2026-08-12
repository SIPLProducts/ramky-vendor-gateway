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
  /** Multi-select selection. `null` = all tenants. Kept in sync with `activeTenantId`. */
  activeTenantIds: string[] | null;
  setActiveTenantIds: (ids: string[] | null) => void;
  isSuperAdmin: boolean;
  /** SAP Team — sees all tenants (needed for sync). */
  isCrossTenantReviewer: boolean;
  /** True when the user has the SCM CO custom role. */
  isScmManager: boolean;
  /** True when the user is a stage approver (SCM Head / Finance 1 / Finance 2 / CEO Office / Finance Approval). */
  isStageApprover: boolean;
  /** True when the user is a Buyer (built-in 'purchase' role or 'Buyer' custom role). */
  isBuyerRole: boolean;
  /**
   * Vendor ids visible to an SCM CO via buyer_scm_mappings.
   * `null` = not applicable. `[]` = SCM CO with no mapped buyers.
   */
  scmManagerVendorIds: string[] | null;
  /**
   * Vendor ids visible to a stage approver or buyer based on routed/invited vendors.
   * `null` = not applicable.
   */
  scopedVendorIds: string[] | null;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

const STORAGE_KEY = 'lovable.activeTenantId';

// Only SAP Team retains blanket cross-tenant read access (needed for sync). All other stage
// approvers (SCM Head, Finance 1/2, Finance Approval, CEO Office) are now scoped to vendors
// routed to them via buyer_approval_flows.
const CROSS_TENANT_ROLE_NAMES = new Set(['sap team']);
const ADMIN_CUSTOM_ROLE_NAMES = new Set(['admin', 'sharvi admin', 'customer admin']);
const STAGE_APPROVER_ROLE_NAMES = new Set(
  ['scm head', 'finance 1', 'finance 2', 'finance approval', 'ceo office'],
);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, userRole } = useAuth();
  const isBuiltInAdmin = userRole === 'sharvi_admin' || userRole === 'admin';

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
  const isCustomAdmin = useMemo(
    () => customRoleNames.some((n) => ADMIN_CUSTOM_ROLE_NAMES.has(n)),
    [customRoleNames],
  );
  const isSuperAdmin = isBuiltInAdmin || isCustomAdmin;
  const isScmManager = useMemo(
    () => customRoleNames.some((n) => n === 'scm co'),
    [customRoleNames],
  );
  const isStageApprover = useMemo(
    () => customRoleNames.some((n) => STAGE_APPROVER_ROLE_NAMES.has(n)),
    [customRoleNames],
  );
  const isBuyerRole = useMemo(
    () => userRole === 'purchase' || customRoleNames.some((n) => n === 'buyer'),
    [userRole, customRoleNames],
  );

  // SCM CO vendor scoping (vendors invited by a mapped buyer OR routed via buyer_approval_flows).
  const { data: scmManagerVendorIds = null } = useQuery({
    queryKey: ['scm-manager-vendor-ids', user?.id],
    queryFn: async (): Promise<string[]> => {
      if (!user?.id) return [];
      const buyerIds = new Set<string>();

      const { data: mappings, error: mErr } = await supabase
        .from('buyer_scm_mappings')
        .select('buyer_user_id')
        .eq('scm_manager_user_id', user.id);
      if (mErr) throw mErr;
      (mappings ?? []).forEach((m: any) => m.buyer_user_id && buyerIds.add(m.buyer_user_id));

      const { data: flows, error: fErr } = await supabase
        .from('buyer_approval_flows')
        .select('buyer_user_id')
        .eq('scm_manager_user_id', user.id);
      if (fErr) throw fErr;
      (flows ?? []).forEach((f: any) => f.buyer_user_id && buyerIds.add(f.buyer_user_id));

      if (buyerIds.size === 0) return [];
      const { data: invites, error: iErr } = await supabase
        .from('vendor_invitations')
        .select('vendor_id')
        .in('created_by', Array.from(buyerIds))
        .not('vendor_id', 'is', null);
      if (iErr) throw iErr;
      return Array.from(new Set((invites ?? []).map((r: any) => r.vendor_id))).filter(Boolean);
    },
    enabled: !!user?.id && isScmManager && !isCrossTenantReviewer && !isSuperAdmin,
    staleTime: 60 * 1000,
  });


  // Stage-approver & buyer vendor scoping.
  // - Buyer: vendors they invited (created_by = me).
  // - Stage approver: vendors routed to them via buyer_approval_flows.
  const needsScopedIds =
    !!user?.id && !isSuperAdmin && !isCrossTenantReviewer && (isStageApprover || isBuyerRole);

  const { data: scopedVendorIds = null } = useQuery({
    queryKey: ['scoped-vendor-ids', user?.id, isStageApprover, isBuyerRole],
    queryFn: async (): Promise<string[]> => {
      if (!user?.id) return [];
      const ids = new Set<string>();

      if (isBuyerRole) {
        const { data, error } = await supabase
          .from('vendor_invitations')
          .select('vendor_id')
          .eq('created_by', user.id)
          .not('vendor_id', 'is', null);
        if (error) throw error;
        (data ?? []).forEach((r: any) => r.vendor_id && ids.add(r.vendor_id));
      }

      if (isStageApprover) {
        const { data: flows, error: fErr } = await supabase
          .from('buyer_approval_flows')
          .select('buyer_user_id')
          .or(
            [
              `scm_head_user_id.eq.${user.id}`,
              `finance_1_user_id.eq.${user.id}`,
              `finance_2_user_id.eq.${user.id}`,
              `ceo_office_user_id.eq.${user.id}`,
            ].join(','),
          );
        if (fErr) throw fErr;
        const buyerIds = Array.from(
          new Set((flows ?? []).map((f: any) => f.buyer_user_id).filter(Boolean)),
        );
        if (buyerIds.length > 0) {
          const { data: invites, error: iErr } = await supabase
            .from('vendor_invitations')
            .select('vendor_id')
            .in('created_by', buyerIds)
            .not('vendor_id', 'is', null);
          if (iErr) throw iErr;
          (invites ?? []).forEach((r: any) => r.vendor_id && ids.add(r.vendor_id));
        }
      }

      return Array.from(ids);
    },
    enabled: needsScopedIds,
    staleTime: 60 * 1000,
  });

  // Multi-tenant selection. `null` = all. Persists as CSV.
  const [activeTenantIds, setActiveTenantIdsState] = useState<string[] | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored || stored === 'null' || stored === '__all__') return null;
    if (stored.includes(',')) {
      const arr = stored.split(',').map((s) => s.trim()).filter(Boolean);
      return arr.length > 0 ? arr : null;
    }
    return [stored];
  });

  const activeTenantId = useMemo<string | null>(
    () => (activeTenantIds && activeTenantIds.length === 1 ? activeTenantIds[0] : null),
    [activeTenantIds],
  );

  const persistSelection = (ids: string[] | null) => {
    if (typeof window === 'undefined') return;
    if (!ids || ids.length === 0) {
      localStorage.setItem(STORAGE_KEY, '__all__');
    } else if (ids.length === 1) {
      localStorage.setItem(STORAGE_KEY, ids[0]);
    } else {
      localStorage.setItem(STORAGE_KEY, ids.join(','));
    }
  };

  // Admins see every active tenant. SAP Team is now scoped to the tenants assigned to
  // them in User Management (with a fallback to all tenants when nothing is assigned).
  const seesAllTenants = isSuperAdmin;

  const { data: myTenants = [], isLoading } = useQuery({
    queryKey: ['my-tenants', user?.id, seesAllTenants, isCrossTenantReviewer],
    queryFn: async (): Promise<TenantOption[]> => {
      if (!user?.id) return [];

      const loadAll = async (): Promise<TenantOption[]> => {
        const { data, error } = await supabase
          .from('tenants')
          .select('id, name, code')
          .eq('is_active', true)
          .order('name');
        if (error) throw error;
        return data || [];
      };

      if (seesAllTenants) return loadAll();

      const { data, error } = await supabase
        .from('user_tenants')
        .select('tenant_id, is_default, tenants!inner(id, name, code, is_active)')
        .eq('user_id', user.id);
      if (error) throw error;

      const assigned = (data || [])
        .map((row: any) => row.tenants)
        .filter((t: any) => t && t.is_active)
        .map((t: any) => ({ id: t.id, name: t.name, code: t.code }));

      // SAP Team without explicit assignments keeps full visibility (sync must not break).
      if (assigned.length === 0 && isCrossTenantReviewer) return loadAll();
      return assigned;
    },
    enabled: !!user?.id,
  });


  const myTenantIds = useMemo(() => myTenants.map((t) => t.id), [myTenants]);

  useEffect(() => {
    if (isLoading || !user?.id) return;

    if (seesAllTenants) {
      // Drop any selections that no longer exist.
      if (activeTenantIds) {
        const filtered = activeTenantIds.filter((id) => myTenantIds.includes(id));
        if (filtered.length !== activeTenantIds.length) {
          const next = filtered.length > 0 ? filtered : null;
          setActiveTenantIdsState(next);
          if (typeof window !== 'undefined') {
            if (next) persistSelection(next);
            else localStorage.removeItem(STORAGE_KEY);
          }
        }
      }
      return;
    }

    if (myTenantIds.length === 0) {
      if (activeTenantIds) setActiveTenantIdsState(null);
      return;
    }
    if (!activeTenantIds) {
      // Default to all assigned tenants when nothing is explicitly chosen.
      // Historical single-tenant users still see just their tenant naturally.
      return;
    }
    const filtered = activeTenantIds.filter((id) => myTenantIds.includes(id));
    if (filtered.length !== activeTenantIds.length) {
      const next = filtered.length > 0 ? filtered : null;
      setActiveTenantIdsState(next);
      persistSelection(next);
    }
  }, [isLoading, user?.id, seesAllTenants, myTenantIds, activeTenantIds]);

  const setActiveTenantIds = useCallback((ids: string[] | null) => {
    const next = ids && ids.length > 0 ? ids : null;
    setActiveTenantIdsState(next);
    persistSelection(next);
  }, []);

  const setActiveTenantId = useCallback((id: string | null) => {
    const next = id ? [id] : null;
    setActiveTenantIdsState(next);
    persistSelection(next);
  }, []);

  const value = useMemo<TenantContextValue>(
    () => ({
      myTenants, myTenantIds, activeTenantId, setActiveTenantId,
      activeTenantIds, setActiveTenantIds,
      isSuperAdmin, isCrossTenantReviewer, isScmManager, isStageApprover, isBuyerRole,
      scmManagerVendorIds: isScmManager && !isCrossTenantReviewer && !isSuperAdmin
        ? (scmManagerVendorIds ?? [])
        : null,
      scopedVendorIds: needsScopedIds ? (scopedVendorIds ?? []) : null,
      isLoading,
    }),
    [myTenants, myTenantIds, activeTenantId, setActiveTenantId,
     activeTenantIds, setActiveTenantIds,
     isSuperAdmin, isCrossTenantReviewer, isScmManager, isStageApprover, isBuyerRole,
     scmManagerVendorIds, scopedVendorIds, needsScopedIds, isLoading],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenantContext() {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    return {
      myTenants: [], myTenantIds: [], activeTenantId: null, setActiveTenantId: () => {},
      activeTenantIds: null, setActiveTenantIds: () => {},
      isSuperAdmin: false, isCrossTenantReviewer: false, isScmManager: false,
      isStageApprover: false, isBuyerRole: false,
      scmManagerVendorIds: null, scopedVendorIds: null, isLoading: false,
    } as TenantContextValue;
  }
  return ctx;
}

/**
 * Returns the query filter to apply for the current user.
 * Precedence:
 *  1. Super admin / SAP Team → no restriction.
 *  2. Stage approver or Buyer (non-admin) → `vendorIds` from routed/invited list.
 *  3. SCM CO → `vendorIds` from buyer-mapped invites.
 *  4. Single active tenant → that tenant.
 *  5. Default → all assigned tenants.
 */
export function useTenantFilter(): {
  tenantIds: string[] | null;
  activeTenantId: string | null;
  vendorIds: string[] | null;
} {
  const {
    myTenantIds, activeTenantId, isSuperAdmin, isCrossTenantReviewer,
    isScmManager, isStageApprover, isBuyerRole,
    scmManagerVendorIds, scopedVendorIds,
  } = useTenantContext();

  // 1. Admin / SAP Team — everything.
  if (isSuperAdmin || isCrossTenantReviewer) {
    if (activeTenantId) return { tenantIds: [activeTenantId], activeTenantId, vendorIds: null };
    return { tenantIds: null, activeTenantId: null, vendorIds: null };
  }

  // 2. Stage approvers — scope by routed vendor ids.
  if (isStageApprover && !isBuyerRole) {
    return { tenantIds: null, activeTenantId: null, vendorIds: scopedVendorIds ?? [] };
  }

  // 2b. Buyers — scope by invited vendor ids AND by tenant selection.
  if (isBuyerRole) {
    const tenants = activeTenantId ? [activeTenantId] : (myTenantIds.length ? myTenantIds : null);
    return { tenantIds: tenants, activeTenantId, vendorIds: scopedVendorIds ?? [] };
  }

  // 3. SCM CO scoping.
  if (isScmManager) {
    return { tenantIds: null, activeTenantId: null, vendorIds: scmManagerVendorIds ?? [] };
  }

  // 4/5. Tenant scoping.
  if (activeTenantId) return { tenantIds: [activeTenantId], activeTenantId, vendorIds: null };
  return { tenantIds: myTenantIds, activeTenantId: null, vendorIds: null };
}
