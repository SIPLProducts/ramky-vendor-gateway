import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ApprovalStage = 'BUYER' | 'SCM_MANAGER' | 'SCM_HEAD' | 'FINANCE_1' | 'FINANCE_2' | 'CEO_OFFICE';

export interface ApprovalChainRow {
  id: string;
  level_number: number;
  status: 'pending' | 'approved' | 'rejected';
  stage: ApprovalStage;
}

/**
 * Live view of a vendor's approval chain. Combines an initial fetch with a
 * realtime subscription on `vendor_approval_progress` so the UI reflects the
 * current approver in real time.
 */
export function useVendorApprovalChain(vendorId: string | null | undefined) {
  const [rows, setRows] = useState<ApprovalChainRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!vendorId) {
      setRows([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('vendor_approval_progress')
      .select('id, level_number, status, approval_matrix_levels!inner(stage)')
      .eq('vendor_id', vendorId)
      .order('level_number', { ascending: true });

    if (error) {
      console.error('useVendorApprovalChain load failed', error);
      setRows([]);
    } else {
      setRows(
        (data ?? []).map((r: any) => ({
          id: r.id,
          level_number: r.level_number,
          status: r.status,
          stage: r.approval_matrix_levels?.stage as ApprovalStage,
        })),
      );
    }
    setLoading(false);
  }, [vendorId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!vendorId) return;
    const channel = supabase
      .channel(`vendor-approval-${vendorId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vendor_approval_progress', filter: `vendor_id=eq.${vendorId}` },
        () => { load(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [vendorId, load]);

  return { rows, loading, refresh: load };
}
