import { useState, useEffect, ReactNode } from 'react';
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
import { CheckCircle2, XCircle, LucideIcon, Eye, FileText, Send, Pencil, Undo2, MessageSquare, Award } from 'lucide-react';
import { ApprovalCommentsDialog } from '@/components/sap/ApprovalCommentsDialog';
import { formatDateTime } from '@/lib/dateFormat';
import { ClassificationField } from '@/components/vendor/ClassificationField';
import { formatStageLevelHistory } from '@/lib/approvalLabels';

import { useToast } from '@/hooks/use-toast';
import { ApprovalStage, StageApprovalItem, usePendingApprovalsByStage } from '@/hooks/usePendingApprovalsByStage';
import { VendorReviewDialog } from '@/components/vendor/VendorReviewDialog';
import { VendorSubmissionPreviewDialog } from '@/components/vendor/VendorSubmissionPreviewDialog';
import { useTenantContext } from '@/hooks/useTenantContext';

interface Props {
  stage: ApprovalStage;
  title: string;
  subtitle?: string;
  Icon: LucideIcon;
  /** Optional extra panel rendered inside the action dialog, e.g. MSME/GST checks for Finance 2. */
  extraPanel?: (item: StageApprovalItem) => ReactNode;
}

type RejectedAction = 'approve' | 'send_to_vendor';

export function StageApprovalView({ stage, title, subtitle, Icon, extraPanel }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { myTenantIds, activeTenantIds } = useTenantContext();

  const { items: rawItems, loading, refresh } = usePendingApprovalsByStage(stage);

  const isBuyer = stage === 'BUYER';

  // For Buyer stage: honour the header multi-select tenant filter.
  const items = isBuyer && activeTenantIds && activeTenantIds.length > 0
    ? rawItems.filter((i) => !i.tenantId || activeTenantIds.includes(i.tenantId))
    : rawItems;

  // Effective tenant count drives visibility of the "Buyer Company" column.
  const effectiveTenantCount = isBuyer
    ? ((activeTenantIds && activeTenantIds.length > 0) ? activeTenantIds.length : myTenantIds.length)
    : 0;
  const showBuyerCompanyColumn = !isBuyer || effectiveTenantCount > 1;

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
  const [commentsItem, setCommentsItem] = useState<StageApprovalItem | null>(null);
  const [buyerClassification, setBuyerClassification] = useState<{ materialGroupVendor: string[]; vendorCategory: string[] }>({ materialGroupVendor: [], vendorCategory: [] });
  const [rejectedClassification, setRejectedClassification] = useState<{ materialGroupVendor: string[]; vendorCategory: string[] }>({ materialGroupVendor: [], vendorCategory: [] });

  // Prefill Buyer classification from vendor row when approve dialog opens
  useEffect(() => {
    if (!isBuyer || !actionItem || actionItem.action !== 'approve') {
      setBuyerClassification({ materialGroupVendor: [], vendorCategory: [] });
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('vendors')
        .select('material_group_vendor, material_group_vendors, vendor_category, vendor_categories')
        .eq('id', actionItem.item.vendorId)
        .maybeSingle();
      if (cancelled || !data) return;
      const mg: string[] = Array.isArray((data as any).material_group_vendors) && (data as any).material_group_vendors.length
        ? (data as any).material_group_vendors
        : ((data as any).material_group_vendor ? [(data as any).material_group_vendor] : []);
      const vc: string[] = Array.isArray((data as any).vendor_categories) && (data as any).vendor_categories.length
        ? (data as any).vendor_categories
        : ((data as any).vendor_category ? [(data as any).vendor_category] : []);
      setBuyerClassification({ materialGroupVendor: mg, vendorCategory: vc });
    })();
    return () => { cancelled = true; };
  }, [actionItem, isBuyer]);

  const pendingItems = items.filter((i) => i.kind !== 'rejected' && !i.blockedByPrevious);
  const waitingItems = items.filter((i) => i.kind !== 'rejected' && i.blockedByPrevious);
  const rejectedItems = items.filter((i) => i.kind === 'rejected');

  const submit = async () => {
    if (!actionItem) return;
    setSubmitting(true);
    try {
      // Buyer approve: persist Classification onto vendor before routing forward
      if (isBuyer && actionItem.action === 'approve') {
        const { error: clsErr } = await supabase.from('vendors').update({
          material_group_vendor: buyerClassification.materialGroupVendor[0] ?? null,
          material_group_vendors: buyerClassification.materialGroupVendor,
          vendor_category: buyerClassification.vendorCategory[0] ?? null,
          vendor_categories: buyerClassification.vendorCategory,
        }).eq('id', actionItem.item.vendorId);
        if (clsErr) throw clsErr;
      }

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
            {showBuyerCompanyColumn && <TableHead>Buyer Company</TableHead>}
            {!isBuyer && <TableHead>Buyer Invited Email</TableHead>}
            <TableHead>Vendor Name</TableHead>
            <TableHead>Vendor Email</TableHead>
            <TableHead>MSME</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(() => {
            const baseCols = 5; // Vendor Name + Vendor Email + MSME + Submitted + Actions
            const colSpan = baseCols + (showBuyerCompanyColumn ? 1 : 0) + (!isBuyer ? 1 : 0);
            if (loading) {
              return Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={colSpan}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
              ));
            }
            if (rows.length === 0) {
              return (
                <TableRow><TableCell colSpan={colSpan} className="text-center text-muted-foreground py-8">
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
              );
            }
            return rows.map((it) => {
              const blocked = variant === 'waiting';
              return (
                <TableRow key={it.progressId ?? it.vendorId}>
                  {showBuyerCompanyColumn && (
                    <TableCell className="text-sm">
                      <div>{it.vendorCompany ?? '—'}</div>
                      {it.companyMismatch && it.invitationCompany && (
                        <div className="text-xs text-amber-600 mt-1">
                          Invitation: {it.invitationCompany}
                        </div>
                      )}
                    </TableCell>
                  )}
                  {!isBuyer && (
                    <TableCell className="text-sm">
                      <div>{it.buyerEmail ?? '—'}</div>
                      {it.buyerName && (
                        <div className="text-xs text-muted-foreground">{it.buyerName}</div>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="font-medium">
                    <div>{it.vendorName}</div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">Ref No: {it.referenceNumber || it.vendorId.slice(0, 8).toUpperCase()}</div>

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
                  <TableCell className="text-sm">{it.vendorEmail || '—'}</TableCell>
                  <TableCell>
                    {it.isMsme ? <Badge variant="secondary">Yes</Badge> : <Badge variant="outline">No</Badge>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(it.submittedAt, '—')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setViewVendorId(it.vendorId)}>
                        <Eye className="h-4 w-4 mr-1" /> View Details
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setCommentsItem(it)}>
                        <MessageSquare className="h-4 w-4 mr-1" /> Comments
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive"
                        disabled={blocked}
                        title={blocked ? 'The previous approver has not approved yet.' : undefined}
                        onClick={() => setActionItem({ item: it, action: 'reject' })}
                      >
                        <XCircle className="h-4 w-4 mr-1" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-success border-success"
                        disabled={blocked}
                        title={blocked ? 'The previous approver has not approved yet.' : undefined}
                        onClick={() => setActionItem({ item: it, action: 'approve' })}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            });
          })()}
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
            <TableHead className="text-center">Actions</TableHead>
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
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">Ref No: {it.referenceNumber || it.vendorId.slice(0, 8).toUpperCase()}</div>
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
                  {formatDateTime(it.rejectionAt, '—')}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setViewVendorId(it.vendorId)}>
                      <Eye className="h-4 w-4 mr-1" /> View Details
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setCommentsItem(it)}>
                      <MessageSquare className="h-4 w-4 mr-1" /> Comments
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-success border-success"
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
        {subtitle ? <p className="text-sm text-muted-foreground mt-1">{subtitle}</p> : null}
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
              {!isBuyer && (
                <TabsTrigger value="waiting">
                  Waiting for Previous Approval ({waitingItems.length})
                </TabsTrigger>
              )}
              {isBuyer && (
                <TabsTrigger value="rejected">
                  Rejected ({rejectedItems.length})
                </TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="pending" className="mt-4">
              {renderTable(pendingItems, 'pending')}
            </TabsContent>
            {!isBuyer && (
              <TabsContent value="waiting" className="mt-4">
                {renderTable(waitingItems, 'waiting')}
              </TabsContent>
            )}
            {isBuyer && (
              <TabsContent value="rejected" className="mt-4">
                {renderRejectedTable(rejectedItems)}
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!actionItem} onOpenChange={(o) => { if (!o) { setActionItem(null); setComments(''); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {actionItem?.action === 'approve'
                ? `Approve — ${actionItem?.item.vendorName}`
                : `Reject — ${actionItem?.item.vendorName}`}
            </DialogTitle>
            {actionItem?.action === 'reject' && isBuyer ? (
              <DialogDescription>
                The vendor will receive an email and can edit the form and resubmit. Please add remarks describing what needs to be corrected (required).
              </DialogDescription>
            ) : (
              <DialogDescription>
                Comments are required and will be recorded in the approval history.
              </DialogDescription>
            )}
          </DialogHeader>
          {actionItem && extraPanel && (
            <div className="border rounded-md p-3 bg-muted/30">
              {extraPanel(actionItem.item)}
            </div>
          )}
          {isBuyer && actionItem?.action === 'approve' && (
            <div className="border rounded-md p-3 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Award className="h-4 w-4 text-primary" />
                Classification
                <span className="text-destructive">*</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Required before approval. These values will be sent to SAP Sync.
              </p>
              <ClassificationField
                label="Material Group for Vendors"
                required
                masterType="material_group_vendor"
                value={buyerClassification.materialGroupVendor}
                onChange={(v) => setBuyerClassification((p) => ({ ...p, materialGroupVendor: v }))}
                selectPlaceholder="Select material groups"
              />
              <ClassificationField
                label="Vendor Category"
                required
                masterType="vendor_category"
                value={buyerClassification.vendorCategory}
                onChange={(v) => setBuyerClassification((p) => ({ ...p, vendorCategory: v }))}
                selectPlaceholder="Select vendor categories"
              />
            </div>
          )}
          <Textarea
            placeholder={
              actionItem?.action === 'reject'
                ? isBuyer
                  ? 'Describe what the vendor needs to correct (required)'
                  : 'Reason for rejection (required)'
                : 'Comments (required)'
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
                !comments.trim() ||
                (isBuyer && actionItem?.action === 'approve' && (
                  buyerClassification.materialGroupVendor.length === 0 ||
                  buyerClassification.vendorCategory.length === 0
                ))
              }
              variant="outline"
              className={
                actionItem?.action === 'reject'
                  ? 'text-destructive border-destructive'
                  : 'text-success border-success'
              }
            >
              {submitting
                ? 'Submitting...'
                : actionItem?.action === 'approve'
                  ? 'Confirm approve'
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

      <ApprovalCommentsDialog
        open={!!commentsItem}
        onOpenChange={(o) => { if (!o) setCommentsItem(null); }}
        vendorId={commentsItem?.vendorId ?? null}
        vendorName={commentsItem?.vendorName}
        referenceNumber={commentsItem?.referenceNumber}
      />

      <Dialog
        open={!!forceRejectPrompt}
        onOpenChange={(o) => { if (!o && !forceRejectSubmitting) setForceRejectPrompt(null); }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rejection email could not be sent</DialogTitle>
            <DialogDescription>
              Rejection email could not be sent. Do you still want to continue with the rejection?
            </DialogDescription>
          </DialogHeader>
          {forceRejectPrompt?.error && (
            <div className="text-xs text-muted-foreground border rounded p-2 bg-muted/30 break-words">
              {forceRejectPrompt.error}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setForceRejectPrompt(null)}
              disabled={forceRejectSubmitting}
            >
              No
            </Button>
            <Button
              variant="outline"
              className="text-destructive border-destructive"
              onClick={confirmForceReject}
              disabled={forceRejectSubmitting}
            >
              {forceRejectSubmitting ? 'Rejecting...' : 'Yes, reject anyway'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
