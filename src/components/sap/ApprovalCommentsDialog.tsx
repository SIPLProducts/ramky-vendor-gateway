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
  level_number: number;
  status: string;
  stage: string;
  comments: string | null;
  rejection_comments: string | null;
  rejection_from_stage: string | null;
  acted_at: string | null;
  acted_by_name: string | null;
}

export function ApprovalCommentsDialog({ open, onOpenChange, vendorId, vendorName, referenceNumber }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !vendorId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: progress } = await supabase
        .from('vendor_approval_progress')
        .select('id, level_number, status, stage, acted_at, acted_by, comments, rejection_comments, rejection_from_stage')
        .eq('vendor_id', vendorId)
        .order('level_number', { ascending: true });

      const userIds = (progress ?? []).map((p: any) => p.acted_by).filter(Boolean) as string[];
      const { data: profiles } = userIds.length > 0
        ? await supabase.from('profiles').select('id, full_name, email').in('id', userIds)
        : { data: [] as any[] };
      const pMap = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name ?? p.email]));

      if (cancelled) return;
      setRows((progress ?? []).map((p: any) => ({
        id: p.id,
        level_number: p.level_number,
        status: p.status,
        stage: p.stage ?? 'SCM_MANAGER',
        comments: p.comments,
        rejection_comments: p.rejection_comments,
        rejection_from_stage: p.rejection_from_stage,
        acted_at: p.acted_at,
        acted_by_name: p.acted_by ? (pMap.get(p.acted_by) ?? null) : null,
      })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, vendorId]);

  const statusVariant = (s: string): 'secondary' | 'destructive' | 'outline' =>
    s === 'approved' ? 'secondary' : s === 'rejected' ? 'destructive' : 'outline';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Approval Comments History</DialogTitle>
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
            No approval activity recorded yet.
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Approval Stage</TableHead>
                  <TableHead>Approver Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Comments</TableHead>
                  <TableHead className="whitespace-nowrap">Date &amp; Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const comment = r.comments
                    || (r.rejection_comments
                        ? `Returned from ${r.rejection_from_stage ?? 'next stage'}: ${r.rejection_comments}`
                        : null);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {formatStageLevelHistory(r.stage as ApprovalStage, r.level_number)}
                      </TableCell>
                      <TableCell>{r.acted_by_name ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-pre-wrap text-sm">{comment ?? '—'}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatIst(r.acted_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
