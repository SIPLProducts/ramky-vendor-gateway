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
type VendorInvitedBy = { name: string | null; email: string | null } | null;
export type VendorRow = Database['public']['Tables']['vendors']['Row'] & {
  invited_by?: VendorInvitedBy;
  original_invited_by?: VendorInvitedBy;
};

type VendorInsert = Database['public']['Tables']['vendors']['Insert'];
type VendorUpdate = Database['public']['Tables']['vendors']['Update'];
type ValidationRow = Database['public']['Tables']['vendor_validations']['Row'];

// Fetch all vendors (for admin/finance/purchase) with offline support
export function useVendors(statuses?: VendorStatus[]) {
  const { tenantIds, activeTenantId, vendorIds } = useTenantFilter();
  const cacheKey = statuses ? `vendors_${statuses.join('_')}` : 'vendors_all';
  const { isOnline, cachedData, saveToCache, getCacheAge } = useOfflineCache<VendorRow[]>({
    key: cacheKey,
    ttl: 12 * 60 * 60 * 1000 // 12 hours
  });

  const query = useQuery({
    queryKey: ['vendors', statuses, activeTenantId, tenantIds, vendorIds],
    queryFn: async () => {
      let q = supabase
        .from('vendors')
        .select('*')
        .order('updated_at', { ascending: false });

      if (statuses && statuses.length > 0) {
        q = q.in('status', statuses);
      }

      if (vendorIds !== null) {
        // SCM CO scoping: restrict to vendors invited by mapped buyers.
        if (vendorIds.length === 0) return [] as VendorRow[];
        q = q.in('id', vendorIds);
      } else if (activeTenantId) {
        q = q.eq('tenant_id', activeTenantId);
      } else if (tenantIds !== null) {
        if (tenantIds.length === 0) return [] as VendorRow[];
        q = q.in('tenant_id', tenantIds);
      }
      // Otherwise -> super admin / cross-tenant reviewer: see everything.

      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as VendorRow[];

      // Attach "invited by" buyer (most recent invitation per vendor).
      if (rows.length > 0) {
        const ids = rows.map((r) => r.id);
        const { data: invites } = await supabase
          .from('vendor_invitations')
          .select('vendor_id, created_by, email, created_at')
          .in('vendor_id', ids)
          .order('created_at', { ascending: false });
        const latest = new Map<string, { created_by: string | null; email: string | null }>();
        (invites ?? []).forEach((inv: any) => {
          if (inv.vendor_id && !latest.has(inv.vendor_id)) {
            latest.set(inv.vendor_id, { created_by: inv.created_by, email: inv.email });
          }
        });
        const buyerIds = Array.from(
          new Set(Array.from(latest.values()).map((v) => v.created_by).filter(Boolean) as string[]),
        );
        const profMap = new Map<string, { name: string | null; email: string | null }>();
        if (buyerIds.length > 0) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', buyerIds);
          (profs ?? []).forEach((p: any) =>
            profMap.set(p.id, { name: p.full_name ?? null, email: p.email ?? null }),
          );
        }
        rows.forEach((r: any) => {
          const inv = latest.get(r.id);
          if (!inv) { r.invited_by = null; return; }
          const prof = inv.created_by ? profMap.get(inv.created_by) : null;
          r.invited_by = prof
            ? { name: prof.name, email: prof.email }
            : { name: null, email: inv.email };
        });
      }

      return rows;
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
  // Set when this row was reopened after a downstream rejection — carries the
  // remarks entered by the rejecting approver so any later viewer (previous
  // approver, buyer, vendor, audit) can see why it bounced back.
  rejection_comments: string | null;
  rejection_from_stage: string | null;
  rejection_at: string | null;
}

export function useVendorApprovalTrail(vendorId: string | undefined) {
  return useQuery({
    queryKey: ['vendor-approval-trail', vendorId],
    queryFn: async (): Promise<ApprovalTrailRow[]> => {
      if (!vendorId) return [];
      const { data: progress, error } = await supabase
        .from('vendor_approval_progress')
        .select('id, level_id, level_number, status, acted_at, acted_by, comments, rejection_comments, rejection_from_stage, rejection_at')
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

      return progress.map((p: any) => {
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
          rejection_comments: p.rejection_comments ?? null,
          rejection_from_stage: p.rejection_from_stage ?? null,
          rejection_at: p.rejection_at ?? null,
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
  const { tenantIds, activeTenantId, vendorIds } = useTenantFilter();
  return useQuery({
    queryKey: ['stuck-approval-vendors', activeTenantId, tenantIds, vendorIds],
    queryFn: async () => {
      let q = supabase.from('vendors').select('id, tenant_id').eq('status', 'purchase_review');
      if (vendorIds !== null) {
        if (vendorIds.length === 0) return 0;
        q = q.in('id', vendorIds);
      } else if (activeTenantId) q = q.eq('tenant_id', activeTenantId);
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
        .maybeSingle();

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
    mutationFn: async ({ vendorId, overrides }: { vendorId: string; overrides?: Record<string, any> }) => {
      console.log('[useSAPSync] start', { vendorId, overrides });

      // Build the full SAP payload on the client so it appears in the browser Network tab
      let sapPayload: any;
      let uploadsCount = 0;
      let skipped: any;
      try {
        const { buildSapPayload } = await import('@/lib/sapPayloadBuilder');
        const built = await buildSapPayload(vendorId, overrides || {});
        sapPayload = built.payload;
        uploadsCount = built.uploadsCount;
        skipped = built.skipped;
        console.log('[useSAPSync] payload built', {
          topLevelKeys: Object.keys(sapPayload[0] || {}).length,
          uploadsCount,
          skipped,
        });
      } catch (buildErr: any) {
        console.error('[useSAPSync] payload build failed', buildErr);
        throw new Error(
          `Could not build SAP payload: ${buildErr?.message || buildErr}. ` +
          `Check the active "Create vendor in SAP" config in SAP API Settings.`,
        );
      }

      // Send fully resolved payload to edge function
      console.log('[useSAPSync] invoking edge function sync-vendor-to-sap');
      const { data: sapResult, error: sapError } = await supabase.functions.invoke(
        'sync-vendor-to-sap',
        {
          body: { vendorId, overrides, sapPayload },
        }
      );

      console.log('[useSAPSync] edge function response', { sapResult, sapError });

      if (sapError) {
        console.error('[useSAPSync] edge function error', sapError);
        throw new Error(`SAP sync failed: ${sapError.message || JSON.stringify(sapError)}`);
      }

      if (!sapResult) {
        throw new Error('No response from SAP sync function. Check edge function logs.');
      }


      if (!sapResult.success) {
        console.error('SAP sync failed:', sapResult);
        const err: any = new Error(sapResult.message || 'SAP sync failed');
        err.sapResponse = sapResult.sapResponse;
        err.sapResult = sapResult;
        throw err;
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

// Bulk SAP sync mutation for multiple vendors at once
export function useMultipleSAPSync() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ vendorIds, overrides }: { vendorIds: string[]; overrides?: Record<string, any> }) => {
      const { buildSapPayload } = await import('@/lib/sapPayloadBuilder');
      // Build per-vendor rows and concatenate into one array
      const rows: any[] = [];
      for (const vid of vendorIds) {
        const { payload } = await buildSapPayload(vid, overrides || {});
        rows.push(...payload);
      }

      const { data, error } = await supabase.functions.invoke('sync-vendors-to-sap-bulk', {
        body: { vendorIds, overrides, sapPayload: rows },
      });
      if (error) throw new Error(`Bulk SAP sync failed: ${error.message}`);
      if (!data) throw new Error('No response from bulk SAP sync function');
      return data;
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-stats'] });
      toast({
        title: result.success ? '✅ Bulk SAP Sync' : 'Bulk SAP Sync',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Bulk SAP Sync Failed', description: error.message, variant: 'destructive' });
    },
  });
}

// DMS Sync mutation (single or multiple vendors)
export function useDMSSync() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ vendorIds }: { vendorIds: string[] }) => {
      // Build the full SAP DMS payload in the browser so the exact
      // { BP_LIFNR, FILE_UPLOAD: [{ FILE, FILE_PATH, FILE_NAME }, ...] }
      // is visible under Network → sync-vendor-to-dms → Payload.
      const { toDmsPath, blobToBase64 } = await import('@/lib/dmsPath');

      const aggregated: any[] = [];
      let anySuccess = false;

      for (const vendorId of vendorIds) {
        const { data: vendor, error: vErr } = await supabase
          .from('vendors')
          .select('id, sap_vendor_code')
          .eq('id', vendorId)
          .maybeSingle();

        if (vErr || !vendor) {
          aggregated.push({
            BP_LIFNR: '',
            success: false,
            message: vErr?.message || 'Vendor not found',
            attemptedCount: 0,
            uploadedCount: 0,
            failedCount: 0,
            skipped: [],
            failedDocuments: [],
          });
          continue;
        }

        if (!vendor.sap_vendor_code) {
          aggregated.push({
            BP_LIFNR: '',
            success: false,
            message: 'Vendor not yet synced to SAP (missing BP_LIFNR)',
            attemptedCount: 0,
            uploadedCount: 0,
            failedCount: 0,
            skipped: [],
            failedDocuments: [],
          });
          continue;
        }

        const { data: docs, error: dErr } = await supabase
          .from('vendor_documents')
          .select('file_name, file_path')
          .eq('vendor_id', vendorId);

        if (dErr) {
          aggregated.push({
            BP_LIFNR: vendor.sap_vendor_code,
            success: false,
            message: `Failed to load documents: ${dErr.message}`,
            attemptedCount: 0,
            uploadedCount: 0,
            failedCount: 0,
            skipped: [],
            failedDocuments: [],
          });
          continue;
        }

        const fileUpload: { FILE: string; FILE_PATH: string; FILE_NAME: string }[] = [];
        const failedDocuments: any[] = [];
        const skipped: string[] = [];

        for (const d of docs || []) {
          const fileName = d.file_name || 'document';
          if (!d.file_path) {
            skipped.push(`${fileName} (missing file path)`);
            continue;
          }
          try {
            const { data: blob, error: dlErr } = await supabase.storage
              .from('vendor-documents')
              .download(d.file_path);
            if (dlErr || !blob) {
              failedDocuments.push({
                fileName,
                filePath: toDmsPath(d.file_path),
                message: `Download failed: ${dlErr?.message || 'unknown error'}`,
              });
              continue;
            }
            const b64 = await blobToBase64(blob);
            fileUpload.push({
              FILE: b64,
              FILE_PATH: toDmsPath(d.file_path),
              FILE_NAME: fileName,
            });
          } catch (e: any) {
            failedDocuments.push({
              fileName,
              filePath: toDmsPath(d.file_path),
              message: e?.message || 'Download error',
            });
          }
        }

        const payload = { BP_LIFNR: vendor.sap_vendor_code, FILE_UPLOAD: fileUpload };

        const { data, error } = await supabase.functions.invoke('sync-vendor-to-dms', {
          body: { vendorId, payload },
        });

        if (error) {
          aggregated.push({
            BP_LIFNR: vendor.sap_vendor_code,
            success: false,
            message: error.message,
            attemptedCount: fileUpload.length,
            uploadedCount: 0,
            failedCount: fileUpload.length,
            skipped,
            failedDocuments,
            dmsPayload: payload,
          });
          continue;
        }

        const results = Array.isArray((data as any)?.results) ? (data as any).results : [];
        const first = results[0] || {};
        if (first.success) anySuccess = true;
        aggregated.push({
          ...first,
          BP_LIFNR: first.BP_LIFNR || vendor.sap_vendor_code,
          skipped: [...(first.skipped || []), ...skipped],
          failedDocuments: [...(first.failedDocuments || []), ...failedDocuments],
          dmsPayload: first.dmsPayload || payload,
        });
      }

      const successCount = aggregated.filter((r) => r.success).length;
      return {
        success: anySuccess || successCount > 0,
        message: `${successCount}/${vendorIds.length} vendor(s) uploaded to DMS`,
        results: aggregated,
      };
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-stats'] });
      toast({
        title: result.success ? '✅ DMS Sync' : 'DMS Sync',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });
    },
    onError: (error: Error) => {
      toast({ title: 'DMS Sync Failed', description: error.message, variant: 'destructive' });
    },
  });
}

// Vendor statistics with offline support
export function useVendorStats() {
  const { tenantIds, activeTenantId, vendorIds } = useTenantFilter();
  const { isOnline, cachedData, saveToCache, getCacheAge } = useOfflineCache<any>({
    key: 'vendor_stats',
    ttl: 6 * 60 * 60 * 1000 // 6 hours
  });

  const query = useQuery({
    queryKey: ['vendor-stats', activeTenantId, tenantIds, vendorIds],
    queryFn: async () => {
      let q = supabase.from('vendors').select('status, tenant_id');

      if (vendorIds !== null) {
        if (vendorIds.length === 0) {
          return {
            total: 0, pendingFinance: 0, pendingPurchase: 0, pendingSAPSync: 0,
            approved: 0, validationFailed: 0, draft: 0, submitted: 0,
            pendingVerification: 0, activeVendors: 0, byCompany: {},
          };
        }
        q = q.in('id', vendorIds);
      } else if (activeTenantId) {
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
        pendingSAPSync: data.filter(v => ['pending_sap_sync', 'purchase_approved'].includes(v.status)).length,
        approved: data.filter(v => v.status === 'sap_synced').length,
        validationFailed: data.filter(v => v.status === 'validation_failed').length,
        draft: data.filter(v => v.status === 'draft').length,
        submitted: data.filter(v => v.status === 'submitted').length,
        pendingVerification: data.filter(v => ['submitted', 'validation_pending'].includes(v.status)).length,
        activeVendors: data.filter(v => ['sap_synced', 'pending_sap_sync', 'purchase_approved', 'finance_approved'].includes(v.status)).length,
        byCompany: data.reduce((acc, v) => {
          const tenantId = v.tenant_id || 'unassigned';
          if (!acc[tenantId]) {
            acc[tenantId] = { total: 0, pending: 0, approved: 0, rejected: 0 };
          }
          acc[tenantId].total++;
          if (['finance_review', 'purchase_review', 'validation_pending'].includes(v.status)) {
            acc[tenantId].pending++;
          }
          if (['sap_synced', 'pending_sap_sync', 'purchase_approved', 'finance_approved'].includes(v.status)) {
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

// SCM Matrix action — routes the SCM Approve/Reject through process-approval-action edge function.
// Resolves the current user's active pending progress row for the vendor and invokes the function.
export function useScmMatrixAction() {
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
      if (!user) throw new Error('Not authenticated');
      const userEmail = (user.email ?? '').toLowerCase();

      // 1) Load all pending progress rows for this vendor
      const { data: progressRows, error: pErr } = await supabase
        .from('vendor_approval_progress')
        .select('id, level_id, level_number, status')
        .eq('vendor_id', vendorId)
        .eq('status', 'pending')
        .order('level_number', { ascending: true });
      if (pErr) throw pErr;
      if (!progressRows || progressRows.length === 0) {
        throw new Error('No pending SCM approval levels for this vendor.');
      }

      // 2) Active level is the lowest-numbered pending row
      const activeLevel = progressRows[0];

      // 3) Confirm current user is an approver for this level (user_id OR email)
      const { data: approvers, error: aErr } = await supabase
        .from('approval_matrix_approvers')
        .select('user_id, approver_email')
        .eq('level_id', activeLevel.level_id);
      if (aErr) throw aErr;
      const isApprover = (approvers ?? []).some(
        (a) =>
          a.user_id === user.id ||
          (a.approver_email && a.approver_email.toLowerCase() === userEmail)
      );
      if (!isApprover) {
        throw new Error('You are not the active SCM approver for this vendor.');
      }

      // 4) Invoke edge function
      const { data, error } = await supabase.functions.invoke('process-approval-action', {
        body: { progress_id: activeLevel.id, action, comments },
      });
      // Surface the actual error message from the edge function body, not the generic "non-2xx".
      if (error) {
        let detailedMessage = error.message;
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.json();
            if (body?.error) detailedMessage = body.error;
          } else if (ctx && typeof ctx.text === 'function') {
            const text = await ctx.text();
            if (text) detailedMessage = text;
          }
        } catch (_) {
          // ignore parse errors, fall back to original message
        }
        throw new Error(detailedMessage);
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-stats'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-progress'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-approval-trail'] });
      
      toast({
        title: variables.action === 'approve' ? '✅ Approved' : 'Rejected',
        description:
          variables.action === 'approve'
            ? 'Recorded at the active SCM matrix level.'
            : 'Vendor rejected at SCM stage.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Action failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Export types for use in components
export type { VendorInsert, VendorUpdate, ValidationRow, VendorStatus };
