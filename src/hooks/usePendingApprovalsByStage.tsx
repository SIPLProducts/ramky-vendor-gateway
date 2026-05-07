import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type ApprovalStage = 'SCM_MANAGER' | 'SCM_HEAD' | 'FINANCE_1' | 'FINANCE_2' | 'CEO_OFFICE';

export interface StageApprovalItem {
  progressId: string;
  vendorId: string;
  vendorName: string;
  submittedAt: string | null;
  isMsme: boolean;
  levelNumber: number;
  levelName: string;
  approvalMode: string;
  stage: ApprovalStage;
  blockedByPrevious: boolean;
}

/**
 * Returns vendors currently waiting at the given stage where the logged-in user
 * is configured as an approver. Mirrors useMyApprovals but with a stage filter.
 */
export function usePendingApprovalsByStage(stage: ApprovalStage) {
  const { user } = useAuth();
  const [items, setItems] = useState<StageApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // 1. Levels at this stage where I am an approver (by user_id OR email)
    const email = (user.email ?? '').toLowerCase();
    const { data: myLevels } = await supabase
      .from('approval_matrix_approvers')
      .select('level_id, approval_matrix_levels!inner(id, stage, level_name, approval_mode)')
      .or(
        email
          ? `user_id.eq.${user.id},approver_email.ilike.${email}`
          : `user_id.eq.${user.id}`
      );

    const stageLevelIds = (myLevels ?? [])
      .filter((row: any) => row.approval_matrix_levels?.stage === stage)
      .map((row: any) => row.level_id);

    if (stageLevelIds.length === 0) { setItems([]); setLoading(false); return; }

    const levelMeta = new Map<string, any>();
    (myLevels ?? []).forEach((row: any) => {
      if (row.approval_matrix_levels?.stage === stage) {
        levelMeta.set(row.level_id, row.approval_matrix_levels);
      }
    });

    // 2. Pending progress at those levels
    const { data: progress } = await supabase
      .from('vendor_approval_progress')
      .select('id, vendor_id, level_id, level_number, status')
      .in('level_id', stageLevelIds)
      .eq('status', 'pending');

    if (!progress || progress.length === 0) { setItems([]); setLoading(false); return; }

    // 3. Make sure it's the active (lowest pending) level for each vendor
    const vendorIds = [...new Set(progress.map((p) => p.vendor_id))];
    const { data: allProgress } = await supabase
      .from('vendor_approval_progress')
      .select('vendor_id, level_number, status')
      .in('vendor_id', vendorIds);

    const activeLevelByVendor = new Map<string, number>();
    (allProgress ?? []).forEach((p) => {
      if (p.status === 'pending') {
        const cur = activeLevelByVendor.get(p.vendor_id);
        if (cur === undefined || p.level_number < cur) activeLevelByVendor.set(p.vendor_id, p.level_number);
      }
    });
    const activeProgress = progress.filter((p) => activeLevelByVendor.get(p.vendor_id) === p.level_number);
    if (activeProgress.length === 0) { setItems([]); setLoading(false); return; }

    const { data: vendors } = await supabase
      .from('vendors')
      .select('id, legal_name, trade_name, submitted_at, is_msme_registered')
      .in('id', activeProgress.map((p) => p.vendor_id));
    const vMap = new Map((vendors ?? []).map((v: any) => [v.id, v]));

    setItems(activeProgress.map((p) => {
      const v: any = vMap.get(p.vendor_id);
      const lvl = levelMeta.get(p.level_id);
      return {
        progressId: p.id,
        vendorId: p.vendor_id,
        vendorName: v?.legal_name ?? v?.trade_name ?? p.vendor_id.slice(0, 8),
        submittedAt: v?.submitted_at ?? null,
        isMsme: !!v?.is_msme_registered,
        levelNumber: p.level_number,
        levelName: lvl?.level_name ?? '—',
        approvalMode: lvl?.approval_mode ?? 'ANY',
        stage,
      };
    }));
    setLoading(false);
  }, [user?.id, stage]);

  useEffect(() => { load(); }, [load]);

  return { items, loading, refresh: load };
}
