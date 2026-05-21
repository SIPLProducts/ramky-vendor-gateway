import { useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, XCircle, LucideIcon, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ApprovalStage, StageApprovalItem, usePendingApprovalsByStage } from '@/hooks/usePendingApprovalsByStage';
import { VendorReviewDialog } from '@/components/vendor/VendorReviewDialog';
import { VendorSubmissionPreviewDialog } from '@/components/vendor/VendorSubmissionPreviewDialog';
import { FileText } from 'lucide-react';

interface Props {
  stage: ApprovalStage;
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  /** Optional extra panel rendered inside the action dialog, e.g. MSME/GST checks for Finance 2. */
  extraPanel?: (item: StageApprovalItem) => ReactNode;
}

export function StageApprovalView({ stage, title, subtitle, Icon, extraPanel }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { items, loading, refresh } = usePendingApprovalsByStage(stage);
  const [actionItem, setActionItem] = useState<{ item: StageApprovalItem; action: 'approve' | 'reject' } | null>(null);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [viewVendorId, setViewVendorId] = useState<string | null>(null);
  const [previewVendorId, setPreviewVendorId] = useState<string | null>(null);


  const submit = async () => {
    if (!actionItem) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('process-approval-action', {
        body: {
          progress_id: actionItem.item.progressId,
          action: actionItem.action,
          comments: comments.trim() || null,
        },
      });
      if (error) throw error;
      await supabase.from('audit_logs').insert({
        action: `vendor_${actionItem.action}d_at_${stage.toLowerCase()}`,
        user_id: user?.id,
        vendor_id: actionItem.item.vendorId,
        details: { stage, level_number: actionItem.item.levelNumber, comments },
      });
      toast({ title: actionItem.action === 'approve' ? 'Approved' : 'Rejected' });
      setActionItem(null);
      setComments('');
      await refresh();
    } catch (err: any) {
      toast({ title: 'Action failed', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Icon className="h-6 w-6" /> {title}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Pending ({items.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Buyer Company</TableHead>
                  <TableHead>Invited By</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>MSME</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                  ))
                ) : items.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    <div>No pending approvals</div>
                    <div className="text-xs mt-2">
                      Only vendors whose approval matrix lists you as an approver for this stage appear here.
                    </div>
                  </TableCell></TableRow>
                ) : (
                  items.map((it) => (
                    <TableRow key={it.progressId}>
                      <TableCell className="font-medium">
                        {it.vendorName}
                        {it.blockedByPrevious && (
                          <div className="text-xs text-amber-600 mt-1">
                            The previous approver has not approved yet.
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{it.vendorCompany ?? '—'}</div>
                        {it.companyMismatch && it.invitationCompany && (
                          <div className="text-xs text-amber-600 mt-1">
                            Invitation: {it.invitationCompany}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{it.buyerName ?? '—'}</div>
                        {it.buyerEmail && (
                          <div className="text-xs text-muted-foreground">{it.buyerEmail}</div>
                        )}
                      </TableCell>
                      <TableCell><Badge variant="outline">{it.levelName}</Badge></TableCell>
                      <TableCell>
                        {it.isMsme ? <Badge variant="secondary">Yes</Badge> : <Badge variant="outline">No</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {it.submittedAt ? new Date(it.submittedAt).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setViewVendorId(it.vendorId)}>
                            <Eye className="h-4 w-4 mr-1" /> View
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setPreviewVendorId(it.vendorId)}>
                            <FileText className="h-4 w-4 mr-1" /> Preview
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={it.blockedByPrevious}
                            title={it.blockedByPrevious ? 'The previous approver has not approved yet.' : undefined}
                            onClick={() => setActionItem({ item: it, action: 'approve' })}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive"
                            disabled={it.blockedByPrevious}
                            title={it.blockedByPrevious ? 'The previous approver has not approved yet.' : undefined}
                            onClick={() => setActionItem({ item: it, action: 'reject' })}
                          >
                            <XCircle className="h-4 w-4 mr-1" /> Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!actionItem} onOpenChange={(o) => { if (!o) { setActionItem(null); setComments(''); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {actionItem?.action === 'approve' ? 'Approve' : 'Reject'} — {actionItem?.item.vendorName}
            </DialogTitle>
          </DialogHeader>
          {actionItem && extraPanel && (
            <div className="border rounded-md p-3 bg-muted/30">
              {extraPanel(actionItem.item)}
            </div>
          )}
          <Textarea
            placeholder={actionItem?.action === 'reject' ? 'Reason for rejection (recommended)' : 'Optional comments'}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionItem(null)}>Cancel</Button>
            <Button onClick={submit} disabled={submitting}
              variant={actionItem?.action === 'reject' ? 'destructive' : 'default'}>
              {submitting ? 'Submitting...' : `Confirm ${actionItem?.action}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Vendor Details — same popup as SAP Sync (All Details / Documents / Validations) */}
      <VendorReviewDialog
        vendorId={viewVendorId}
        open={!!viewVendorId}
        onOpenChange={(o) => { if (!o) setViewVendorId(null); }}
      />

      <VendorSubmissionPreviewDialog
        vendorId={previewVendorId}
        open={!!previewVendorId}
        onOpenChange={(o) => { if (!o) setPreviewVendorId(null); }}
      />
    </div>
  );
}
