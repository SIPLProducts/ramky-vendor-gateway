import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock, Circle } from 'lucide-react';
import { formatStageLevel, type ApprovalStage } from '@/lib/approvalLabels';

interface Props { vendorId: string; }

interface Row {
  id: string;
  level_number: number;
  status: string;
  stage: string;
  acted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  comments: string | null;
  acted_by_name: string | null;
  rejection_comments: string | null;
  rejection_from_stage: string | null;
  rejection_at: string | null;
}

function daysBetween(from: string | null, to: string | null): number | null {
  if (!from) return null;
  const start = new Date(from).getTime();
  const end = to ? new Date(to).getTime() : Date.now();
  const days = (end - start) / 86_400_000;
  return Math.max(0, Math.round(days * 10) / 10);
}

export function ApprovalTimeline({ vendorId }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: progress } = await supabase
        .from('vendor_approval_progress')
        .select('id, level_number, status, stage, acted_at, acted_by, comments, started_at, completed_at, rejection_comments, rejection_from_stage, rejection_at')
        .eq('vendor_id', vendorId)
        .order('level_number', { ascending: false });

      if (!progress || progress.length === 0) { setRows([]); setLoading(false); return; }

      const userIds = progress.map((p: any) => p.acted_by).filter(Boolean) as string[];
      const { data: profiles } = userIds.length > 0
        ? await supabase.from('profiles').select('id, full_name, email').in('id', userIds)
        : { data: [] as any[] };
      const pMap = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name ?? p.email]));

      setRows(progress.map((p: any) => ({
        id: p.id,
        level_number: p.level_number,
        status: p.status,
        stage: p.stage ?? 'SCM_MANAGER',
        acted_at: p.acted_at,
        started_at: p.started_at,
        completed_at: p.completed_at,
        comments: p.comments,
        acted_by_name: p.acted_by ? (pMap.get(p.acted_by) ?? null) : null,
        rejection_comments: p.rejection_comments ?? null,
        rejection_from_stage: p.rejection_from_stage ?? null,
        rejection_at: p.rejection_at ?? null,
      })));
      setLoading(false);
    })();
  }, [vendorId]);

  if (loading) return null;
  if (rows.length === 0) return null;

  const activeLevel = rows.filter((r) => r.status === 'pending').reduce((min, r) => Math.min(min, r.level_number), Infinity);

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Approval Progress</CardTitle></CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">
          Only stages configured in this vendor's approval matrix are shown. Skipped stages are not listed.
        </p>
        <ol className="space-y-3">

          {rows.map((r) => {
            const isActive = r.level_number === activeLevel && r.status === 'pending';
            const Icon = r.status === 'approved' ? CheckCircle2
              : r.status === 'rejected' ? XCircle
              : isActive ? Clock : Circle;
            const color = r.status === 'approved' ? 'text-green-600'
              : r.status === 'rejected' ? 'text-destructive'
              : isActive ? 'text-amber-500' : 'text-muted-foreground';
            const days = daysBetween(r.started_at, r.completed_at);
            return (
              <li key={r.id} className="flex items-start gap-3">
                <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{formatStageLevel(r.stage as ApprovalStage, r.level_number)}</span>
                    <Badge variant={r.status === 'approved' ? 'secondary' : r.status === 'rejected' ? 'destructive' : 'outline'}>
                      {r.status}
                    </Badge>
                    {days !== null && (
                      <Badge variant="outline" className="text-xs">
                        {days} day{days === 1 ? '' : 's'}{r.status === 'pending' ? ' so far' : ''}
                      </Badge>
                    )}
                  </div>
                  {r.acted_by_name && (
                    <p className="text-xs text-muted-foreground mt-1">
                      by {r.acted_by_name} · {r.acted_at ? new Date(r.acted_at).toLocaleString() : ''}
                    </p>
                  )}
                  {r.status === 'rejected' && r.comments && (
                    <p className="text-xs mt-1 italic text-destructive">Rejected: "{r.comments}"</p>
                  )}
                  {r.status !== 'rejected' && r.rejection_comments && (
                    <p className="text-xs mt-1 italic text-amber-700">
                      Returned from {r.rejection_from_stage ?? 'next stage'}: "{r.rejection_comments}"
                    </p>
                  )}
                  {r.status !== 'rejected' && !r.rejection_comments && r.comments && (
                    <p className="text-xs mt-1 italic">"{r.comments}"</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
