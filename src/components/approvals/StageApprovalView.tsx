import { useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, XCircle, LucideIcon, Eye, FolderOpen, Landmark, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ApprovalStage, StageApprovalItem, usePendingApprovalsByStage } from '@/hooks/usePendingApprovalsByStage';
import { VendorDocuments } from '@/components/vendor/VendorDocuments';

interface Props {
  stage: ApprovalStage;
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  /** Optional extra panel rendered inside the action dialog, e.g. MSME/GST checks for Finance 2. */
  extraPanel?: (item: StageApprovalItem) => ReactNode;
}

interface VendorDetails {
  id: string;
  legal_name?: string;
  trade_name?: string;
  pan?: string;
  gstin?: string;
  status?: string;
  submitted_at?: string;
  bank_name?: string;
  bank_branch_name?: string;
  account_number?: string;
  ifsc_code?: string;
  account_type?: string;
  bank_address?: string;
  bank_name_2?: string;
  branch_name_2?: string;
  account_number_2?: string;
  ifsc_code_2?: string;
  account_holder_name_2?: string;
  account_type_2?: string;
  bank_address_2?: string;
}

export function StageApprovalView({ stage, title, subtitle, Icon, extraPanel }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { items, loading, refresh } = usePendingApprovalsByStage(stage);
  const [actionItem, setActionItem] = useState<{ item: StageApprovalItem; action: 'approve' | 'reject' } | null>(null);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [viewVendor, setViewVendor] = useState<VendorDetails | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const openView = async (vendorId: string) => {
    setViewLoading(true);
    setViewVendor({ id: vendorId });
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, legal_name, trade_name, pan, gstin, status, submitted_at, bank_name, bank_branch_name, account_number, ifsc_code, account_type, bank_address, bank_name_2, branch_name_2, account_number_2, ifsc_code_2, account_holder_name_2, account_type_2, bank_address_2')
        .eq('id', vendorId)
        .maybeSingle();
      if (error) throw error;
      setViewVendor(data as VendorDetails);
    } catch (err: any) {
      toast({ title: 'Failed to load vendor', description: err.message, variant: 'destructive' });
    } finally {
      setViewLoading(false);
    }
  };

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
                  <TableHead>Stage</TableHead>
                  <TableHead>MSME</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                  ))
                ) : items.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">
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
                      <TableCell><Badge variant="outline">{it.levelName}</Badge></TableCell>
                      <TableCell>
                        {it.isMsme ? <Badge variant="secondary">Yes</Badge> : <Badge variant="outline">No</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {it.submittedAt ? new Date(it.submittedAt).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openView(it.vendorId)}>
                            <Eye className="h-4 w-4 mr-1" /> View
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

      {/* View Vendor Details Dialog with Documents tab */}
      <Dialog open={!!viewVendor} onOpenChange={(o) => { if (!o) setViewVendor(null); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewVendor?.legal_name || 'Vendor Details'}</DialogTitle>
          </DialogHeader>
          {viewLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : viewVendor && (
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview"><Info className="h-4 w-4 mr-2" />Overview</TabsTrigger>
                <TabsTrigger value="bank"><Landmark className="h-4 w-4 mr-2" />Bank Details</TabsTrigger>
                <TabsTrigger value="documents"><FolderOpen className="h-4 w-4 mr-2" />Documents</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="mt-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Legal Name:</span> <span className="font-medium">{viewVendor.legal_name || '—'}</span></div>
                  <div><span className="text-muted-foreground">Trade Name:</span> <span className="font-medium">{viewVendor.trade_name || '—'}</span></div>
                  <div><span className="text-muted-foreground">PAN:</span> <span className="font-mono">{viewVendor.pan || '—'}</span></div>
                  <div><span className="text-muted-foreground">GSTIN:</span> <span className="font-mono">{viewVendor.gstin || '—'}</span></div>
                  <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline">{viewVendor.status}</Badge></div>
                  <div><span className="text-muted-foreground">Submitted:</span> <span>{viewVendor.submitted_at ? new Date(viewVendor.submitted_at).toLocaleString() : '—'}</span></div>
                </div>
              </TabsContent>
              <TabsContent value="bank" className="mt-4 space-y-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">Primary Bank Account</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Bank:</span> <span className="font-medium">{viewVendor.bank_name || '—'}</span></div>
                    <div><span className="text-muted-foreground">Branch:</span> <span className="font-medium">{viewVendor.bank_branch_name || '—'}</span></div>
                    <div><span className="text-muted-foreground">Account No:</span> <span className="font-mono">{viewVendor.account_number || '—'}</span></div>
                    <div><span className="text-muted-foreground">IFSC:</span> <span className="font-mono">{viewVendor.ifsc_code || '—'}</span></div>
                    <div><span className="text-muted-foreground">Type:</span> <span>{viewVendor.account_type || '—'}</span></div>
                    <div className="col-span-2"><span className="text-muted-foreground">Address:</span> <span>{viewVendor.bank_address || '—'}</span></div>
                  </CardContent>
                </Card>
                {viewVendor.account_number_2 && (
                  <Card>
                    <CardHeader><CardTitle className="text-base">Secondary Bank Account</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Bank:</span> <span className="font-medium">{viewVendor.bank_name_2 || '—'}</span></div>
                      <div><span className="text-muted-foreground">Branch:</span> <span className="font-medium">{viewVendor.branch_name_2 || '—'}</span></div>
                      <div><span className="text-muted-foreground">Account No:</span> <span className="font-mono">{viewVendor.account_number_2}</span></div>
                      <div><span className="text-muted-foreground">IFSC:</span> <span className="font-mono">{viewVendor.ifsc_code_2 || '—'}</span></div>
                      <div><span className="text-muted-foreground">Holder:</span> <span>{viewVendor.account_holder_name_2 || '—'}</span></div>
                      <div><span className="text-muted-foreground">Type:</span> <span>{viewVendor.account_type_2 || '—'}</span></div>
                      <div className="col-span-2"><span className="text-muted-foreground">Address:</span> <span>{viewVendor.bank_address_2 || '—'}</span></div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
              <TabsContent value="documents" className="mt-4">
                <VendorDocuments vendorId={viewVendor.id} />
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewVendor(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
