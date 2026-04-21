import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock, Circle } from 'lucide-react';

interface Props { vendorId: string; }

interface Row {
  id: string;
  level_number: number;
  status: string;
  acted_at: string | null;
  comments: string | null;
  level_name: string;
  acted_by_name: string | null;
}

export function ApprovalTimeline({ vendorId }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: progress } = await supabase
        .from('vendor_approval_progress')
        .select('id, level_id, level_number, status, acted_at, acted_by, comments')
        .eq('vendor_id', vendorId)
        .order('level_number', { ascending: false });

      if (!progress || progress.length === 0) { setRows([]); setLoading(false); return; }

      const levelIds = progress.map((p) => p.level_id);
      const userIds = progress.map((p) => p.acted_by).filter(Boolean) as string[];

      const [{ data: levels }, { data: profiles }] = await Promise.all([
        supabase.from('approval_matrix_levels').select('id, level_name').in('id', levelIds),
        userIds.length > 0
          ? supabase.from('profiles').select('id, full_name, email').in('id', userIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const lMap = new Map((levels ?? []).map((l) => [l.id, l.level_name]));
      const pMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? p.email]));

      setRows(progress.map((p) => ({
        id: p.id,
        level_number: p.level_number,
        status: p.status,
        acted_at: p.acted_at,
        comments: p.comments,
        level_name: lMap.get(p.level_id) ?? '—',
        acted_by_name: p.acted_by ? (pMap.get(p.acted_by) ?? null) : null,
      })));
      setLoading(false);
    })();
  }, [vendorId]);

  if (loading) return null;
  if (rows.length === 0) return null;

  // Find active (lowest pending)
  const activeLevel = rows.filter((r) => r.status === 'pending').reduce((min, r) => Math.min(min, r.level_number), Infinity);

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Approval Progress</CardTitle></CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {rows.map((r) => {
            const isActive = r.level_number === activeLevel && r.status === 'pending';
            const Icon = r.status === 'approved' ? CheckCircle2
              : r.status === 'rejected' ? XCircle
              : isActive ? Clock : Circle;
            const color = r.status === 'approved' ? 'text-green-600'
              : r.status === 'rejected' ? 'text-destructive'
              : isActive ? 'text-amber-500' : 'text-muted-foreground';
            return (
              <li key={r.id} className="flex items-start gap-3">
                <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">L{r.level_number}</Badge>
                    <span className="font-medium text-sm">{r.level_name}</span>
                    <Badge variant={r.status === 'approved' ? 'secondary' : r.status === 'rejected' ? 'destructive' : 'outline'}>
                      {r.status}
                    </Badge>
                  </div>
                  {r.acted_by_name && (
                    <p className="text-xs text-muted-foreground mt-1">
                      by {r.acted_by_name} · {r.acted_at ? new Date(r.acted_at).toLocaleString() : ''}
                    </p>
                  )}
                  {r.comments && <p className="text-xs mt-1 italic">"{r.comments}"</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
