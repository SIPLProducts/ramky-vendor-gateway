import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenantFilter, useTenantContext } from '@/hooks/useTenantContext';
import { useToast } from '@/hooks/use-toast';
import { useOfflineCache } from '@/hooks/useOfflineCache';
import { useEffect } from 'react';
import type { Database } from '@/integrations/supabase/types';

// Types from database
type VendorStatus = Database['public']['Enums']['vendor_status'];
type VendorRow = Database['public']['Tables']['vendors']['Row'];
type VendorInsert = Database['public']['Tables']['vendors']['Insert'];
type VendorUpdate = Database['public']['Tables']['vendors']['Update'];
type ValidationRow = Database['public']['Tables']['vendor_validations']['Row'];

// Fetch all vendors (for admin/finance/purchase) with offline support
export function useVendors(statuses?: VendorStatus[]) {
  const { tenantIds, activeTenantId } = useTenantFilter();
  const cacheKey = statuses ? `vendors_${statuses.join('_')}` : 'vendors_all';
  const { isOnline, cachedData, saveToCache, getCacheAge } = useOfflineCache<VendorRow[]>({
    key: cacheKey,
    ttl: 12 * 60 * 60 * 1000 // 12 hours
  });

  const query = useQuery({
    queryKey: ['vendors', statuses, activeTenantId, tenantIds],
    queryFn: async () => {
      let q = supabase
        .from('vendors')
        .select('*')
        .order('updated_at', { ascending: false });

      if (statuses && statuses.length > 0) {
        q = q.in('status', statuses);
      }

      if (activeTenantId) {
        q = q.eq('tenant_id', activeTenantId);
      } else if (tenantIds !== null) {
        // Restricted user: filter to their tenants. Empty list -> no results.
        if (tenantIds.length === 0) return [] as VendorRow[];
        q = q.in('tenant_id', tenantIds);
      }
      // tenantIds === null && !activeTenantId -> super admin viewing all tenants

      const { data, error } = await q;
      if (error) throw error;
      return data as VendorRow[];
    },
    enabled: isOnline,
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    if (query.data && isOnline) {
      saveToCache(query.data);
    }
  }, [query.data, isOnline, saveToCache]);

  const data = isOnline ? query.data : (cachedData || query.data);

  return {
    ...query,
    data,
    isOffline: !isOnline,
    cacheAge: getCacheAge(),
  };
}

// Fetch single vendor
export function useVendor(vendorId: string | undefined) {
  return useQuery({
    queryKey: ['vendor', vendorId],
    queryFn: async () => {
      if (!vendorId) return null;
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', vendorId)
        .maybeSingle();
      if (error) throw error;
      return data as VendorRow | null;
    },
    enabled: !!vendorId,
  });
}

// Fetch current user's vendor
export function useMyVendor() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-vendor', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data as VendorRow | null;
    },
    enabled: !!user?.id,
  });
}

// Fetch Purchase / SCM approval trail (vendor_approval_progress + level + approver profile)
export interface ApprovalTrailRow {
  id: string;
  level_number: number;
  level_name: string;
  status: string;
  acted_at: string | null;
  comments: string | null;
  approver_name: string | null;
  approver_email: string | null;
}

export function useVendorApprovalTrail(vendorId: string | undefined) {
  return useQuery({
    queryKey: ['vendor-approval-trail', vendorId],
    queryFn: async (): Promise<ApprovalTrailRow[]> => {
      if (!vendorId) return [];
      const { data: progress, error } = await supabase
        .from('vendor_approval_progress')
        .select('id, level_id, level_number, status, acted_at, acted_by, comments')
        .eq('vendor_id', vendorId)
        .order('level_number', { ascending: false });
      if (error) throw error;
      if (!progress || progress.length === 0) return [];

      const levelIds = Array.from(new Set(progress.map(p => p.level_id)));
      const userIds = Array.from(new Set(progress.map(p => p.acted_by).filter(Boolean) as string[]));

      const [{ data: levels }, { data: profiles }] = await Promise.all([
        supabase.from('approval_matrix_levels').select('id, level_name').in('id', levelIds),
        userIds.length
          ? supabase.from('profiles').select('id, full_name, email').in('id', userIds)
          : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string }[] }),
      ]);

      const lMap = new Map((levels ?? []).map(l => [l.id, l.level_name]));
      const pMap = new Map((profiles ?? []).map(p => [p.id, p]));

      return progress.map(p => {
        const prof = p.acted_by ? pMap.get(p.acted_by) : null;
        return {
          id: p.id,
          level_number: p.level_number,
          level_name: lMap.get(p.level_id) ?? '—',
          status: p.status,
          acted_at: p.acted_at,
          comments: p.comments,
          approver_name: prof?.full_name ?? null,
          approver_email: prof?.email ?? null,
        };
      });
    },
    enabled: !!vendorId,
  });
}

// Re-invoke route-vendor-approval to (re)seed approval progress for a vendor
export function useReRouteApproval() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (vendorId: string) => {
      const { data, error } = await supabase.functions.invoke('route-vendor-approval', {
        body: { vendor_id: vendorId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vendorId) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-approval-trail', vendorId] });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['stuck-approval-vendors'] });
      toast({
        title: 'Approval re-routed',
        description: 'Approval progress refreshed from the configured matrix.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Re-route failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Count of vendors stuck in purchase_review with NO approval progress rows.
// Used by the admin dashboard widget to surface missing matrix configuration.
export function useStuckApprovalVendors() {
  const { tenantIds, activeTenantId } = useTenantFilter();
  return useQuery({
    queryKey: ['stuck-approval-vendors', activeTenantId, tenantIds],
    queryFn: async () => {
      let q = supabase.from('vendors').select('id, tenant_id').eq('status', 'purchase_review');
      if (activeTenantId) q = q.eq('tenant_id', activeTenantId);
      else if (tenantIds !== null) {
        if (tenantIds.length === 0) return 0;
        q = q.in('tenant_id', tenantIds);
      }
      const { data: vendors, error } = await q;
      if (error) throw error;
      if (!vendors || vendors.length === 0) return 0;

      const ids = vendors.map(v => v.id);
      const { data: progress, error: pErr } = await supabase
        .from('vendor_approval_progress')
        .select('vendor_id')
        .in('vendor_id', ids);
      if (pErr) throw pErr;
      const withProgress = new Set((progress ?? []).map(p => p.vendor_id));
      return vendors.filter(v => !withProgress.has(v.id)).length;
    },
    staleTime: 60 * 1000,
  });
}

// Fetch vendor validations
export function useVendorValidations(vendorId: string | undefined) {
  return useQuery({
    queryKey: ['vendor-validations', vendorId],
    queryFn: async () => {
      if (!vendorId) return [];
      const { data, error } = await supabase
        .from('vendor_validations')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as ValidationRow[];
    },
    enabled: !!vendorId,
  });
}

// Create vendor mutation
export function useCreateVendor() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { activeTenantId, myTenantIds } = useTenantContext();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (vendorData: Omit<VendorInsert, 'user_id'>) => {
      const fallbackTenant = activeTenantId ?? myTenantIds[0] ?? null;
      const { data, error } = await supabase
        .from('vendors')
        .insert({
          ...vendorData,
          user_id: user?.id,
          tenant_id: vendorData.tenant_id ?? fallbackTenant,
        } as VendorInsert)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['my-vendor'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Update vendor mutation
export function useUpdateVendor() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...vendorData }: VendorUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('vendors')
        .update(vendorData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vendor', data.id] });
      queryClient.invalidateQueries({ queryKey: ['my-vendor'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Finance approval mutation
export function useFinanceAction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      vendorId,
      action,
      comments,
    }: {
      vendorId: string;
      action: 'approve' | 'reject' | 'clarify';
      comments: string;
    }) => {
      // For clarify action, use the dedicated edge function
      if (action === 'clarify') {
        const { data, error } = await supabase.functions.invoke('request-vendor-clarification', {
          body: {
            vendorId,
            comment: comments,
            reviewerName: user?.email || 'Finance Team',
          },
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Failed to send clarification request');

        // Log audit
        await supabase.from('audit_logs').insert({
          vendor_id: vendorId,
          user_id: user?.id,
          action: 'finance_clarify',
          details: { comments, email_sent_to: data.vendorEmail },
        });

        return { id: vendorId, status: 'draft' as VendorStatus };
      }

      // New flow: Finance acts AFTER Purchase matrix completes.
      // Finance approve -> purchase_approved (ready for SAP sync)
      // Finance reject -> finance_rejected
      const statusMap: Record<string, VendorStatus> = {
        approve: 'purchase_approved',
        reject: 'finance_rejected',
      };

      const updateData: VendorUpdate = {
        status: statusMap[action],
        finance_reviewed_by: user?.id,
        finance_reviewed_at: new Date().toISOString(),
        finance_comments: comments,
      };

      const { data, error } = await supabase
        .from('vendors')
        .update(updateData)
        .eq('id', vendorId)
        .select()
        .single();

      if (error) throw error;

      // Log audit
      await supabase.from('audit_logs').insert({
        vendor_id: vendorId,
        user_id: user?.id,
        action: `finance_${action}`,
        details: { comments },
      });

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast({
        title: variables.action === 'approve' ? 'Approved' : variables.action === 'reject' ? 'Rejected' : 'Clarification Requested',
        description: variables.action === 'approve'
          ? 'Vendor approved by Finance — ready for SAP sync'
          : variables.action === 'reject'
            ? 'Vendor registration rejected'
            : 'Clarification email sent to vendor. Status changed to draft.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Purchase approval mutation (approve only - no SAP sync)
export function usePurchaseAction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      vendorId,
      action,
      comments,
    }: {
      vendorId: string;
      action: 'approve' | 'reject';
      comments: string;
    }) => {
      const statusMap: Record<string, VendorStatus> = {
        approve: 'purchase_approved',
        reject: 'purchase_rejected',
      };

      const updateData: VendorUpdate = {
        status: statusMap[action],
        purchase_reviewed_by: user?.id,
        purchase_reviewed_at: new Date().toISOString(),
        purchase_comments: comments,
      };

      const { data, error } = await supabase
        .from('vendors')
        .update(updateData)
        .eq('id', vendorId)
        .select()
        .single();

      if (error) throw error;

      // Log audit
      await supabase.from('audit_logs').insert({
        vendor_id: vendorId,
        user_id: user?.id,
        action: `purchase_${action}`,
        details: { comments },
      });

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });

      toast({
        title: variables.action === 'approve' ? '✅ Approved' : 'Rejected',
        description: variables.action === 'approve'
          ? 'Vendor approved and ready for SAP sync'
          : 'Vendor registration rejected',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// SAP Sync mutation (separate from purchase approval)
export function useSAPSync() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ vendorId }: { vendorId: string }) => {
      console.log('Calling SAP sync edge function for vendor:', vendorId);

      // Call SAP sync edge function (which calls Cloudflare Worker)
      const { data: sapResult, error: sapError } = await supabase.functions.invoke(
        'sync-vendor-to-sap',
        {
          body: { vendorId },
        }
      );

      console.log('SAP sync response:', { sapResult, sapError });

      if (sapError) {
        console.error('SAP sync error:', sapError);
        throw new Error(`SAP sync failed: ${sapError.message}`);
      }

      if (!sapResult) {
        throw new Error('No response from SAP sync function');
      }

      if (!sapResult.success) {
        console.error('SAP sync failed:', sapResult);
        throw new Error(sapResult.message || 'SAP sync failed');
      }

      console.log('SAP sync successful:', sapResult);

      // Log audit with SAP details
      await supabase.from('audit_logs').insert({
        vendor_id: vendorId,
        user_id: user?.id,
        action: 'sap_sync',
        details: {
          sap_vendor_code: sapResult.sapVendorCode,
          sap_response: sapResult.sapResponse
        },
      });

      // Fetch updated vendor
      const { data: vendor, error: fetchError } = await supabase
        .from('vendors')
        .select()
        .eq('id', vendorId)
        .single();

      if (fetchError) throw fetchError;

      return { vendor, sapResponse: sapResult };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-stats'] });

      toast({
        title: '✅ Synced to SAP',
        description: `SAP Vendor Code: ${result.sapResponse?.sapVendorCode || 'N/A'}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'SAP Sync Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Vendor statistics with offline support
export function useVendorStats() {
  const { tenantIds, activeTenantId } = useTenantFilter();
  const { isOnline, cachedData, saveToCache, getCacheAge } = useOfflineCache<any>({
    key: 'vendor_stats',
    ttl: 6 * 60 * 60 * 1000 // 6 hours
  });

  const query = useQuery({
    queryKey: ['vendor-stats', activeTenantId, tenantIds],
    queryFn: async () => {
      let q = supabase.from('vendors').select('status, tenant_id');

      if (activeTenantId) {
        q = q.eq('tenant_id', activeTenantId);
      } else if (tenantIds !== null) {
        if (tenantIds.length === 0) {
          return {
            total: 0, pendingFinance: 0, pendingPurchase: 0, pendingSAPSync: 0,
            approved: 0, validationFailed: 0, draft: 0, submitted: 0,
            pendingVerification: 0, activeVendors: 0, byCompany: {},
          };
        }
        q = q.in('tenant_id', tenantIds);
      }

      const { data, error } = await q;
      if (error) throw error;

      const stats = {
        total: data.length,
        pendingFinance: data.filter(v => v.status === 'finance_review').length,
        pendingPurchase: data.filter(v => v.status === 'purchase_review').length,
        pendingSAPSync: data.filter(v => v.status === 'purchase_approved').length,
        approved: data.filter(v => v.status === 'sap_synced').length,
        validationFailed: data.filter(v => v.status === 'validation_failed').length,
        draft: data.filter(v => v.status === 'draft').length,
        submitted: data.filter(v => v.status === 'submitted').length,
        pendingVerification: data.filter(v => ['submitted', 'validation_pending'].includes(v.status)).length,
        activeVendors: data.filter(v => ['sap_synced', 'purchase_approved', 'finance_approved'].includes(v.status)).length,
        byCompany: data.reduce((acc, v) => {
          const tenantId = v.tenant_id || 'unassigned';
          if (!acc[tenantId]) {
            acc[tenantId] = { total: 0, pending: 0, approved: 0, rejected: 0 };
          }
          acc[tenantId].total++;
          if (['finance_review', 'purchase_review', 'validation_pending'].includes(v.status)) {
            acc[tenantId].pending++;
          }
          if (['sap_synced', 'purchase_approved', 'finance_approved'].includes(v.status)) {
            acc[tenantId].approved++;
          }
          if (['finance_rejected', 'purchase_rejected', 'validation_failed'].includes(v.status)) {
            acc[tenantId].rejected++;
          }
          return acc;
        }, {} as Record<string, { total: number; pending: number; approved: number; rejected: number }>),
      };

      return stats;
    },
    enabled: isOnline,
    staleTime: 60 * 1000, // 1 minute
  });

  // Cache stats when fetched
  useEffect(() => {
    if (query.data && isOnline) {
      saveToCache(query.data);
    }
  }, [query.data, isOnline, saveToCache]);

  const data = isOnline ? query.data : (cachedData || query.data);

  return {
    ...query,
    data,
    isOffline: !isOnline,
    cacheAge: getCacheAge(),
  };
}

// Fetch buyer companies
export function useBuyerCompanies() {
  return useQuery({
    queryKey: ['buyer-companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data;
    },
  });
}

// Audit logs
export function useAuditLogs(vendorId?: string) {
  return useQuery({
    queryKey: ['audit-logs', vendorId],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (vendorId) {
        query = query.eq('vendor_id', vendorId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

// Export types for use in components
export type { VendorRow, VendorInsert, VendorUpdate, ValidationRow, VendorStatus };
