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
  from_stage: string | null;
  comments: string | null;
  acted_at: string | null;
  acted_by_name: string | null;
}

const ACTION_LABEL: Record<string, string> = {
  approved: 'Approved',
  rejected: 'Rejected',
  returned_to_buyer: 'Returned to Buyer',
  returned_to_vendor: 'Returned to Vendor',
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
      const { data: hist } = await supabase
        .from('vendor_approval_history' as any)
        .select('id, level_number, stage, action, from_stage, comments, acted_by, acted_at')
        .eq('vendor_id', vendorId)
        .order('acted_at', { ascending: true });

      const userIds = (hist ?? []).map((p: any) => p.acted_by).filter(Boolean) as string[];
      const { data: profiles } = userIds.length > 0
        ? await supabase.from('profiles').select('id, full_name, email').in('id', userIds)
        : { data: [] as any[] };
      const pMap = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name ?? p.email]));

      if (cancelled) return;
      setRows((hist ?? []).map((p: any) => ({
        id: p.id,
        level_number: p.level_number,
        stage: p.stage ?? 'SCM_MANAGER',
        action: p.action,
        from_stage: p.from_stage,
        comments: p.comments,
        acted_at: p.acted_at,
        acted_by_name: p.acted_by ? (pMap.get(p.acted_by) ?? null) : null,
      })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, vendorId]);

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
                      {r.from_stage && r.from_stage !== r.stage && r.action !== 'rejected' && (
                        <div className="text-xs text-muted-foreground">
                          from {formatStageLevelHistory(r.from_stage as ApprovalStage, 0)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{r.acted_by_name ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={actionVariant(r.action)}>
                        {ACTION_LABEL[r.action] ?? r.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-pre-wrap text-sm">{r.comments ?? '—'}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDateTime(r.acted_at, '—')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
