import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { formatStageLevelHistory, type ApprovalStage } from '@/lib/approvalLabels';
import { formatDateTime } from '@/lib/dateFormat';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  vendorId: string | null;
  vendorName?: string;
  referenceNumber?: string;
}

interface Row {
  id: string;
  level_number: number | null;
  action: string;
  stage: string;
  comments: string;
  acted_at: string | null;
  acted_by_name: string | null;
}

const ACTION_LABEL: Record<string, string> = {
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  pending: 'Pending',
  resubmitted: 'Resubmitted',
};

const actionVariant = (a: string): 'secondary' | 'destructive' | 'outline' | 'default' => {
  if (a === 'approved' || a === 'resubmitted') return 'secondary';
  if (a === 'rejected') return 'destructive';
  return 'outline';
};

export function ApprovalCommentsDialog({ open, onOpenChange, vendorId, vendorName, referenceNumber }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !vendorId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);

      const [{ data: progress }, { data: vendor }] = await Promise.all([
        supabase
          .from('vendor_approval_progress')
          .select('id, level_number, stage, status, comments, rejection_comments, rejection_from_stage, rejection_from_user, rejection_at, acted_by, acted_at')
          .eq('vendor_id', vendorId)
          .order('acted_at', { ascending: false }),
        supabase
          .from('vendors')
          .select('last_rejection_comments, last_rejection_stage, last_rejected_by, last_rejected_at')
          .eq('id', vendorId)
          .maybeSingle(),
      ]);

      const collected: Row[] = [];

      for (const p of (progress ?? []) as any[]) {
        if (p.comments && String(p.comments).trim().length > 0) {
          collected.push({
            id: p.id,
            level_number: p.level_number ?? null,
            stage: p.stage ?? '',
            action: p.status,
            comments: String(p.comments),
            acted_at: p.acted_at,
            acted_by_name: p.acted_by ?? null,
          });
        }
        if (p.rejection_comments && String(p.rejection_comments).trim().length > 0) {
          collected.push({
            id: `${p.id}-rej`,
            level_number: p.level_number ?? null,
            stage: p.rejection_from_stage ?? p.stage ?? '',
            action: 'rejected',
            comments: String(p.rejection_comments),
            acted_at: p.rejection_at ?? p.acted_at,
            acted_by_name: p.rejection_from_user ?? null,
          });
        }
      }

      const v = vendor as any;
      if (v?.last_rejection_comments && String(v.last_rejection_comments).trim().length > 0) {
        const already = collected.some(
          (r) => r.comments.trim() === String(v.last_rejection_comments).trim(),
        );
        if (!already) {
          collected.push({
            id: 'vendor-last-rejection',
            level_number: null,
            stage: v.last_rejection_stage ?? '',
            action: 'rejected',
            comments: String(v.last_rejection_comments),
            acted_at: v.last_rejected_at ?? null,
            acted_by_name: v.last_rejected_by ?? null,
          });
        }
      }

      // Resolve approver names
      const userIds = Array.from(
        new Set(collected.map((r) => r.acted_by_name).filter(Boolean) as string[]),
      );
      const { data: profiles } = userIds.length > 0
        ? await supabase.from('profiles').select('id, full_name, email').in('id', userIds)
        : { data: [] as any[] };
      const pMap = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name ?? p.email]));

      collected.sort((a, b) => {
        const ta = a.acted_at ? new Date(a.acted_at).getTime() : 0;
        const tb = b.acted_at ? new Date(b.acted_at).getTime() : 0;
        return tb - ta;
      });

      if (cancelled) return;
      setRows(
        collected.map((r) => ({
          ...r,
          acted_by_name: r.acted_by_name ? (pMap.get(r.acted_by_name) ?? null) : null,
        })),
      );
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, vendorId]);

  const latest = rows[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Approval Comments</DialogTitle>
          <DialogDescription>
            {vendorName ?? 'Vendor'}{referenceNumber ? ` — Ref: ${referenceNumber}` : ''}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No comments recorded yet.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/40 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="default">Latest Comment</Badge>
                <span className="text-xs text-muted-foreground">
                  {formatStageLevelHistory(latest.stage as ApprovalStage, latest.level_number ?? 0)}
                  {latest.acted_by_name ? ` · ${latest.acted_by_name}` : ''}
                  {latest.acted_at ? ` · ${formatDateTime(latest.acted_at, '')}` : ''}
                </span>
              </div>
              <div className="whitespace-pre-wrap text-sm">{latest.comments}</div>
            </div>

            <div className="max-h-[50vh] overflow-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Approval Stage</TableHead>
                    <TableHead>Approver Name</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Comments</TableHead>
                    <TableHead className="whitespace-nowrap">Date &amp; Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {formatStageLevelHistory(r.stage as ApprovalStage, r.level_number ?? 0)}
                      </TableCell>
                      <TableCell>{r.acted_by_name ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={actionVariant(r.action)}>
                          {ACTION_LABEL[r.action] ?? r.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-pre-wrap text-sm">{r.comments}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDateTime(r.acted_at, '—')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
