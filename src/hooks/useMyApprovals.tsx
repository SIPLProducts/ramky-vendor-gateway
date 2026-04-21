import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface MyApprovalItem {
  progressId: string;
  vendorId: string;
  vendorName: string;
  submittedAt: string | null;
  levelNumber: number;
  levelName: string;
  approvalMode: string;
}

export function useMyApprovals() {
  const { user } = useAuth();
  const [items, setItems] = useState<MyApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // 1. Levels where I am an approver
    const { data: myLevels } = await supabase
      .from('approval_matrix_approvers')
      .select('level_id')
      .eq('user_id', user.id);
    const levelIds = (myLevels ?? []).map((l) => l.level_id);
    if (levelIds.length === 0) { setItems([]); setLoading(false); return; }

    // 2. Pending progress at those levels
    const { data: progress } = await supabase
      .from('vendor_approval_progress')
      .select('id, vendor_id, level_id, level_number, status')
      .in('level_id', levelIds)
      .eq('status', 'pending');

    if (!progress || progress.length === 0) { setItems([]); setLoading(false); return; }

    // 3. Verify it's the active level for each vendor (no lower-numbered pending exists)
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

    const [{ data: vendors }, { data: levels }] = await Promise.all([
      supabase.from('vendors').select('id, legal_name, trade_name, submitted_at').in('id', activeProgress.map((p) => p.vendor_id)),
      supabase.from('approval_matrix_levels').select('id, level_name, approval_mode').in('id', activeProgress.map((p) => p.level_id)),
    ]);
    const vMap = new Map((vendors ?? []).map((v) => [v.id, v]));
    const lMap = new Map((levels ?? []).map((l) => [l.id, l]));

    setItems(
      activeProgress.map((p) => {
        const v = vMap.get(p.vendor_id);
        const l = lMap.get(p.level_id);
        return {
          progressId: p.id,
          vendorId: p.vendor_id,
          vendorName: v?.legal_name ?? v?.trade_name ?? p.vendor_id.slice(0, 8),
          submittedAt: v?.submitted_at ?? null,
          levelNumber: p.level_number,
          levelName: l?.level_name ?? '—',
          approvalMode: l?.approval_mode ?? 'ANY',
        };
      })
    );
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  return { items, loading, refresh: load };
}
