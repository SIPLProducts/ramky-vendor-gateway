import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
  const cacheKey = statuses ? `vendors_${statuses.join('_')}` : 'vendors_all';
  const { isOnline, cachedData, saveToCache, getCacheAge } = useOfflineCache<VendorRow[]>({ 
    key: cacheKey,
    ttl: 12 * 60 * 60 * 1000 // 12 hours
  });

  const query = useQuery({
    queryKey: ['vendors', statuses],
    queryFn: async () => {
      let q = supabase
        .from('vendors')
        .select('*')
        .order('updated_at', { ascending: false });

      if (statuses && statuses.length > 0) {
        q = q.in('status', statuses);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as VendorRow[];
    },
    enabled: isOnline, // Only fetch when online
    staleTime: 2 * 60 * 1000, // Consider data stale after 2 minutes
  });

  // Cache data when successfully fetched
  useEffect(() => {
    if (query.data && isOnline) {
      saveToCache(query.data);
    }
  }, [query.data, isOnline, saveToCache]);

  // Return cached data when offline
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
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (vendorData: Omit<VendorInsert, 'user_id'>) => {
      const { data, error } = await supabase
        .from('vendors')
        .insert({
          ...vendorData,
          user_id: user?.id,
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
      const statusMap: Record<string, VendorStatus> = {
        approve: 'purchase_review',
        reject: 'finance_rejected',
        clarify: 'finance_review',
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
          ? 'Vendor forwarded to Purchase team'
          : variables.action === 'reject'
          ? 'Vendor registration rejected'
          : 'Clarification request sent',
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

// Purchase approval mutation
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
        approve: 'sap_synced',
        reject: 'purchase_rejected',
      };

      const updateData: VendorUpdate = {
        status: statusMap[action],
        purchase_reviewed_by: user?.id,
        purchase_reviewed_at: new Date().toISOString(),
        purchase_comments: comments,
      };

      if (action === 'approve') {
        updateData.sap_vendor_code = `SAP-VND-${Date.now().toString().slice(-8)}`;
        updateData.sap_synced_at = new Date().toISOString();
      }

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
        details: { comments, sap_vendor_code: updateData.sap_vendor_code },
      });

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast({
        title: variables.action === 'approve' ? 'Approved & Synced' : 'Rejected',
        description: variables.action === 'approve' 
          ? 'Vendor synced to SAP successfully'
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

// Vendor statistics with offline support
export function useVendorStats() {
  const { isOnline, cachedData, saveToCache, getCacheAge } = useOfflineCache<any>({ 
    key: 'vendor_stats',
    ttl: 6 * 60 * 60 * 1000 // 6 hours
  });

  const query = useQuery({
    queryKey: ['vendor-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('status');
      
      if (error) throw error;

      const stats = {
        total: data.length,
        pendingFinance: data.filter(v => v.status === 'finance_review').length,
        pendingPurchase: data.filter(v => v.status === 'purchase_review').length,
        approved: data.filter(v => v.status === 'sap_synced').length,
        validationFailed: data.filter(v => v.status === 'validation_failed').length,
        draft: data.filter(v => v.status === 'draft').length,
        submitted: data.filter(v => v.status === 'submitted').length,
        pendingVerification: data.filter(v => ['submitted', 'validation_pending'].includes(v.status)).length,
        activeVendors: data.filter(v => ['sap_synced', 'purchase_approved', 'finance_approved'].includes(v.status)).length,
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
