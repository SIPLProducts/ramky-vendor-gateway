import { useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, XCircle, LucideIcon, Eye, FileText, Send, Pencil, Undo2 } from 'lucide-react';

import { useToast } from '@/hooks/use-toast';
import { ApprovalStage, StageApprovalItem, usePendingApprovalsByStage } from '@/hooks/usePendingApprovalsByStage';
import { VendorReviewDialog } from '@/components/vendor/VendorReviewDialog';
import { VendorSubmissionPreviewDialog } from '@/components/vendor/VendorSubmissionPreviewDialog';
import { formatStageLevel, parseLevelOrdinal } from '@/lib/approvalLabels';

interface Props {
  stage: ApprovalStage;
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  /** Optional extra panel rendered inside the action dialog, e.g. MSME/GST checks for Finance 2. */
  extraPanel?: (item: StageApprovalItem) => ReactNode;
}

type RejectedAction = 'approve' | 'send_to_vendor';

export function StageApprovalView({ stage, title, subtitle, Icon, extraPanel }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const { items, loading, refresh } = usePendingApprovalsByStage(stage);
  const [actionItem, setActionItem] = useState<{ item: StageApprovalItem; action: 'approve' | 'reject' } | null>(null);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [viewVendorId, setViewVendorId] = useState<string | null>(null);
  const [previewVendorId, setPreviewVendorId] = useState<string | null>(null);
  const [rejectedAction, setRejectedAction] = useState<{ item: StageApprovalItem; action: RejectedAction } | null>(null);
  const [rejectedRemarks, setRejectedRemarks] = useState('');
  const [rejectedSubmitting, setRejectedSubmitting] = useState(false);
  const [forceRejectPrompt, setForceRejectPrompt] = useState<
    { item: StageApprovalItem; comments: string; error: string } | null
  >(null);
  const [forceRejectSubmitting, setForceRejectSubmitting] = useState(false);

  const isBuyer = stage === 'BUYER';
  const pendingItems = items.filter((i) => i.kind !== 'rejected' && !i.blockedByPrevious);
  const waitingItems = items.filter((i) => i.kind !== 'rejected' && i.blockedByPrevious);
  const rejectedItems = items.filter((i) => i.kind === 'rejected');

  const submit = async () => {
    if (!actionItem) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-approval-action', {
        body: {
          progress_id: actionItem.item.progressId,
          action: actionItem.action,
          comments: comments.trim() || null,
        },
      });
      if (error) throw error;

      // Non-buyer rejection: email may have failed → ask for confirmation.
      if (
        actionItem.action === 'reject' &&
        !isBuyer &&
        data &&
        (data as any).requires_confirmation === true
      ) {
        toast({
          title: 'Unable to send the rejection email due to a mail service issue.',
          variant: 'destructive',
        });
        setForceRejectPrompt({
          item: actionItem.item,
          comments: comments.trim() || '',
          error: (data as any).error ?? '',
        });
        return;
      }

      await supabase.from('audit_logs').insert({
        action: `vendor_${actionItem.action}d_at_${stage.toLowerCase()}`,
        user_id: user?.id,
        vendor_id: actionItem.item.vendorId,
        details: { stage, level_number: actionItem.item.levelNumber, comments },
      });

      if (actionItem.action === 'reject' && !isBuyer) {
        toast({
          title: 'Rejection email sent successfully to the Buyer.',
        });
      } else {
        toast({
          title:
            actionItem.action === 'approve'
              ? 'Approved'
              : isBuyer
                ? 'Sent back to vendor'
                : 'Rejected',
        });
      }
      setActionItem(null);
      setComments('');
      await refresh();
    } catch (err: any) {
      toast({ title: 'Action failed', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const confirmForceReject = async () => {
    if (!forceRejectPrompt || !actionItem) return;
    setForceRejectSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('process-approval-action', {
        body: {
          progress_id: actionItem.item.progressId,
          action: 'reject',
          comments: forceRejectPrompt.comments || null,
          force: true,
        },
      });
      if (error) throw error;
      toast({ title: 'Rejected (email could not be delivered).' });
      setForceRejectPrompt(null);
      setActionItem(null);
      setComments('');
      await refresh();
    } catch (err: any) {
      toast({ title: 'Action failed', description: err.message, variant: 'destructive' });
    } finally {
      setForceRejectSubmitting(false);
    }
  };

  const submitRejectedAction = async () => {
    if (!rejectedAction) return;
    setRejectedSubmitting(true);
    try {
      const fnName =
        rejectedAction.action === 'approve' ? 'buyer-reapprove-rejected' : 'buyer-return-to-vendor';
      const { error } = await supabase.functions.invoke(fnName, {
        body: {
          vendor_id: rejectedAction.item.vendorId,
          comments: rejectedRemarks.trim() || null,
        },
      });
      if (error) throw error;
      toast({
        title:
          rejectedAction.action === 'approve'
            ? 'Approved — re-routed to next approver'
            : 'Sent back to vendor',
      });
      setRejectedAction(null);
      setRejectedRemarks('');
      await refresh();
    } catch (err: any) {
      toast({ title: 'Action failed', description: err.message, variant: 'destructive' });
    } finally {
      setRejectedSubmitting(false);
    }
  };

  const renderTable = (rows: StageApprovalItem[], variant: 'pending' | 'waiting') => (
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
          ) : rows.length === 0 ? (
            <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
              {variant === 'pending' ? (
                <>
                  <div>No vendors are pending your approval right now.</div>
                  <div className="text-xs mt-2">
                    Only vendors whose approval matrix lists you as an approver for this stage appear here.
                  </div>
                </>
              ) : (
                <div>No vendors are waiting for a previous approver.</div>
              )}
            </TableCell></TableRow>
          ) : (
            rows.map((it) => {
              const blocked = variant === 'waiting';
              return (
                <TableRow key={it.progressId ?? it.vendorId}>
                  <TableCell className="font-medium">
                    <div>{it.vendorName}</div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">ID: {it.vendorId}</div>

                    {blocked && (
                      <div className="text-xs text-amber-600 mt-1">
                        The previous approver has not approved yet.
                      </div>
                    )}
                    {it.rejectionComments && (
                      <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                        <strong>Returned from {it.rejectionFromStage}:</strong>{' '}
                        {it.rejectionComments}
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
                  <TableCell><Badge variant="outline">{(() => { const n = parseLevelOrdinal(it.levelName); return n != null ? formatStageLevel(stage, n) : it.levelName; })()}</Badge></TableCell>
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
                        disabled={blocked}
                        title={blocked ? 'The previous approver has not approved yet.' : undefined}
                        onClick={() => setActionItem({ item: it, action: 'approve' })}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        disabled={blocked}
                        title={blocked ? 'The previous approver has not approved yet.' : isBuyer ? 'Return the application to the vendor for correction.' : undefined}
                        onClick={() => setActionItem({ item: it, action: 'reject' })}
                      >
                        {isBuyer ? (
                          <><Undo2 className="h-4 w-4 mr-1" /> Send Back to Vendor</>
                        ) : (
                          <><XCircle className="h-4 w-4 mr-1" /> Reject</>
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );

  const renderRejectedTable = (rows: StageApprovalItem[]) => (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vendor</TableHead>
            <TableHead>Rejected From</TableHead>
            <TableHead>Remarks</TableHead>
            <TableHead>Rejected At</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">
              No rejected vendors. Items returned by a downstream approver will appear here.
            </TableCell></TableRow>
          ) : (
            rows.map((it) => (
              <TableRow key={it.vendorId}>
                <TableCell className="font-medium">
                  <div>{it.vendorName}</div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">ID: {it.vendorId}</div>
                  {it.isOnBehalf && (
                    <Badge variant="secondary" className="mt-1">On-behalf</Badge>
                  )}
                </TableCell>

                <TableCell>
                  <Badge variant="destructive">
                    {it.rejectionFromStage
                      ? String(it.rejectionFromStage).replace(/_/g, ' ')
                      : '—'}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm max-w-md">
                  {it.rejectionComments ? (
                    <div className="whitespace-pre-wrap text-amber-900">{it.rejectionComments}</div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {it.rejectionAt ? new Date(it.rejectionAt).toLocaleString() : '—'}
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
                      onClick={() => { setRejectedAction({ item: it, action: 'approve' }); setRejectedRemarks(''); }}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                    </Button>
                    {it.isOnBehalf ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (!it.invitationId) {
                            toast({ title: 'Missing invitation', description: 'Cannot open edit form for this vendor.', variant: 'destructive' });
                            return;
                          }
                          navigate(`/vendor/registration?onBehalfOf=${it.invitationId}`);
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-1" /> Edit & Resubmit
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setRejectedAction({ item: it, action: 'send_to_vendor' }); setRejectedRemarks(''); }}
                      >
                        <Send className="h-4 w-4 mr-1" /> Send to Vendor
                      </Button>
                    )}

                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Icon className="h-6 w-6" /> {title}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Approvals ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending" className="w-full">
            <TabsList>
              <TabsTrigger value="pending">
                Pending Approval ({pendingItems.length})
              </TabsTrigger>
              <TabsTrigger value="waiting">
                Waiting for Previous Approval ({waitingItems.length})
              </TabsTrigger>
              {isBuyer && (
                <TabsTrigger value="rejected">
                  Rejected ({rejectedItems.length})
                </TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="pending" className="mt-4">
              {renderTable(pendingItems, 'pending')}
            </TabsContent>
            <TabsContent value="waiting" className="mt-4">
              {renderTable(waitingItems, 'waiting')}
            </TabsContent>
            {isBuyer && (
              <TabsContent value="rejected" className="mt-4">
                {renderRejectedTable(rejectedItems)}
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!actionItem} onOpenChange={(o) => { if (!o) { setActionItem(null); setComments(''); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {actionItem?.action === 'approve'
                ? `Approve — ${actionItem?.item.vendorName}`
                : isBuyer
                  ? `Send back to vendor — ${actionItem?.item.vendorName}`
                  : `Reject — ${actionItem?.item.vendorName}`}
            </DialogTitle>
            {actionItem?.action === 'reject' && isBuyer && (
              <DialogDescription>
                The vendor will receive an email and can edit the form and resubmit. Please add remarks describing what needs to be corrected.
              </DialogDescription>
            )}
          </DialogHeader>
          {actionItem && extraPanel && (
            <div className="border rounded-md p-3 bg-muted/30">
              {extraPanel(actionItem.item)}
            </div>
          )}
          <Textarea
            placeholder={
              actionItem?.action === 'reject'
                ? isBuyer
                  ? 'Describe what the vendor needs to correct (required)'
                  : 'Reason for rejection (recommended)'
                : 'Optional comments'
            }
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionItem(null)}>Cancel</Button>
            <Button
              onClick={submit}
              disabled={
                submitting ||
                (actionItem?.action === 'reject' && isBuyer && !comments.trim())
              }
              variant={actionItem?.action === 'reject' ? 'destructive' : 'default'}
            >
              {submitting
                ? 'Submitting...'
                : actionItem?.action === 'approve'
                  ? 'Confirm approve'
                  : isBuyer
                    ? 'Send Back to Vendor'
                    : 'Confirm reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog
        open={!!rejectedAction}
        onOpenChange={(o) => { if (!o) { setRejectedAction(null); setRejectedRemarks(''); } }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {rejectedAction?.action === 'approve'
                ? `Approve — ${rejectedAction?.item.vendorName}`
                : `Send back to vendor — ${rejectedAction?.item.vendorName}`}
            </DialogTitle>
            <DialogDescription>
              {rejectedAction?.action === 'approve'
                ? 'Re-routes the vendor forward through the same approval matrix, starting from the next approver after Buyer.'
                : 'Returns the application to the vendor for correction. They will be able to edit and resubmit.'}
            </DialogDescription>
          </DialogHeader>
          {rejectedAction?.item.rejectionComments && (
            <div className="rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
              <strong>
                {rejectedAction.item.rejectionFromStage
                  ? String(rejectedAction.item.rejectionFromStage).replace(/_/g, ' ')
                  : 'Approver'}
                {' remarks: '}
              </strong>
              {rejectedAction.item.rejectionComments}
            </div>
          )}
          <Textarea
            placeholder="Optional remarks"
            value={rejectedRemarks}
            onChange={(e) => setRejectedRemarks(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectedAction(null)}>Cancel</Button>
            <Button onClick={submitRejectedAction} disabled={rejectedSubmitting}>
              {rejectedSubmitting
                ? 'Submitting...'
                : rejectedAction?.action === 'approve' ? 'Confirm Approve' : 'Send to Vendor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
