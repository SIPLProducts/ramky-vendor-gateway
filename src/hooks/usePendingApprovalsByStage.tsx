import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type ApprovalStage = 'BUYER' | 'SCM_MANAGER' | 'SCM_HEAD' | 'FINANCE_1' | 'FINANCE_2' | 'CEO_OFFICE';

export interface StageApprovalItem {
  progressId: string;
  vendorId: string;
  vendorName: string;
  submittedAt: string | null;
  isMsme: boolean;
  isInternational?: boolean;
  levelNumber: number;
  levelName: string;
  approvalMode: string;
  stage: ApprovalStage;
  blockedByPrevious: boolean;
  vendorCompany?: string | null;
  invitationCompany?: string | null;
  companyMismatch?: boolean;
  buyerName?: string | null;
  buyerEmail?: string | null;
  mappedScmManagers?: Array<{ name: string | null; email: string | null }>;
  rejectionComments?: string | null;
  rejectionFromStage?: string | null;
  rejectionAt?: string | null;
}


/**
 * Returns vendors currently waiting at the given stage where the logged-in user
 * is configured as an approver. The `blockedByPrevious` flag is computed
 * server-side via a service-role edge function so RLS on
 * `vendor_approval_progress` cannot hide earlier rows in the chain.
 */
export function usePendingApprovalsByStage(stage: ApprovalStage) {
  const { user } = useAuth();
  const [items, setItems] = useState<StageApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'list-pending-approvals-by-stage',
        { body: { stage } },
      );
      if (error) throw error;
      setItems((data?.items ?? []) as StageApprovalItem[]);
    } catch (err) {
      console.error('list-pending-approvals-by-stage failed', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, stage]);

  useEffect(() => { load(); }, [load]);

  return { items, loading, refresh: load };
}
