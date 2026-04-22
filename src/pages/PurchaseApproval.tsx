import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ValidationStatus } from '@/components/vendor/ValidationStatus';
import { VendorDocuments } from '@/components/vendor/VendorDocuments';
import { ApprovalTimeline } from '@/components/vendor/ApprovalTimeline';
import { useVendors, useScmMatrixAction, useBuyerCompanies, useReRouteApproval, VendorRow } from '@/hooks/useVendors';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { ValidationResult } from '@/types/vendor';
import {
  Search,
  Eye,
  CheckCircle,
  XCircle,
  Building2,
  Truck,
  Loader2,
  FolderOpen,
  MessageSquare,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function PurchaseApproval() {
  const [searchTerm, setSearchTerm] = useState('');
  const [buyerCompanyFilter, setBuyerCompanyFilter] = useState<string>('all');
  const [selectedVendor, setSelectedVendor] = useState<VendorRow | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [comments, setComments] = useState('');
  const [showFinanceCommentDialog, setShowFinanceCommentDialog] = useState(false);
  const [selectedFinanceComment, setSelectedFinanceComment] = useState<{ vendorName: string; comment: string | null }>({ vendorName: '', comment: null });

  const { data: pendingVendors, isLoading } = useVendors(['purchase_review']);
  const { data: buyerCompanies } = useBuyerCompanies();
  const purchaseAction = useScmMatrixAction();
  const reRoute = useReRouteApproval();
  const { userRole, user } = useAuth();
  const canReRoute = userRole === 'admin' || userRole === 'sharvi_admin' || userRole === 'customer_admin';

  const userEmail = (user?.email ?? '').toLowerCase();

  // Fetch approval progress rows for all visible vendors (for stuck detection + status badge)
  const vendorIds = (pendingVendors ?? []).map(v => v.id);
  const { data: progressByVendor } = useQuery({
    queryKey: ['purchase-progress', vendorIds.sort().join(',')],
    queryFn: async (): Promise<Record<string, Array<{ id: string; level_id: string; level_number: number; status: string }>>> => {
      if (vendorIds.length === 0) return {};
      const { data, error } = await supabase
        .from('vendor_approval_progress')
        .select('id, vendor_id, level_id, level_number, status')
        .in('vendor_id', vendorIds);
      if (error) throw error;
      const map: Record<string, Array<{ id: string; level_id: string; level_number: number; status: string }>> = {};
      (data ?? []).forEach(row => {
        if (!map[row.vendor_id]) map[row.vendor_id] = [];
        map[row.vendor_id].push({ id: row.id, level_id: row.level_id, level_number: row.level_number, status: row.status });
      });
      return map;
    },
    enabled: vendorIds.length > 0,
    staleTime: 30 * 1000,
  });

  // Resolve approvers for all active (lowest pending) levels currently on screen
  const activeLevelIds = Array.from(new Set(
    Object.values(progressByVendor ?? {}).map(rows => {
      const pending = rows.filter(r => r.status === 'pending').sort((a, b) => a.level_number - b.level_number);
      return pending[0]?.level_id;
    }).filter(Boolean) as string[]
  ));

  const { data: approversByLevel } = useQuery({
    queryKey: ['scm-approvers-by-level', activeLevelIds.sort().join(',')],
    queryFn: async (): Promise<Record<string, Array<{ user_id: string | null; approver_email: string | null; approver_name: string | null }>>> => {
      if (activeLevelIds.length === 0) return {};
      const { data, error } = await supabase
        .from('approval_matrix_approvers')
        .select('level_id, user_id, approver_email, approver_name')
        .in('level_id', activeLevelIds);
      if (error) throw error;
      const map: Record<string, Array<{ user_id: string | null; approver_email: string | null; approver_name: string | null }>> = {};
      (data ?? []).forEach(row => {
        if (!map[row.level_id]) map[row.level_id] = [];
        map[row.level_id].push({ user_id: row.user_id, approver_email: row.approver_email, approver_name: row.approver_name });
      });
      return map;
    },
    enabled: activeLevelIds.length > 0,
    staleTime: 60 * 1000,
  });

  const stuckIds = new Set(vendorIds.filter(id => !progressByVendor?.[id]?.length));

  // Returns info about the active level for a vendor: the pending row, its approvers, and whether the current user is one
  const getActiveLevelInfo = (vendorId: string) => {
    const rows = progressByVendor?.[vendorId] ?? [];
    const pending = rows.filter(r => r.status === 'pending').sort((a, b) => a.level_number - b.level_number);
    const active = pending[0];
    if (!active) return { active: null, approvers: [], isActiveApprover: false, approverNames: '' };
    const approvers = approversByLevel?.[active.level_id] ?? [];
    const isActiveApprover = approvers.some(
      a => a.user_id === user?.id || (a.approver_email && a.approver_email.toLowerCase() === userEmail)
    );
    const approverNames = approvers
      .map(a => a.approver_name || a.approver_email)
      .filter(Boolean)
      .join(', ');
    return { active, approvers, isActiveApprover, approverNames };
  };

  const getScmStatusBadge = (vendorId: string) => {
    const rows = progressByVendor?.[vendorId] ?? [];
    if (rows.length === 0) {
      return { label: 'Awaiting SCM Approval', className: 'bg-amber-100 text-amber-700 border-amber-200' };
    }
    const approved = rows.filter(r => r.status === 'approved').sort((a, b) => b.level_number - a.level_number);
    const pending = rows.filter(r => r.status === 'pending').sort((a, b) => a.level_number - b.level_number);
    const { approverNames } = getActiveLevelInfo(vendorId);
    if (pending.length > 0) {
      const activeLabel = `Pending L${pending[0].level_number}${approverNames ? ` — ${approverNames}` : ''}`;
      if (approved.length > 0) {
        return {
          label: `L${approved[0].level_number} Approved · ${activeLabel}`,
          className: 'bg-blue-100 text-blue-700 border-blue-200',
        };
      }
      return { label: activeLabel, className: 'bg-amber-100 text-amber-700 border-amber-200' };
    }
    return { label: 'Awaiting SCM Approval', className: 'bg-amber-100 text-amber-700 border-amber-200' };
  };

  const filteredVendors = pendingVendors?.filter((vendor) => {
    const matchesSearch =
      (vendor.legal_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (vendor.gstin || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBuyerCompany = buyerCompanyFilter === 'all' || vendor.tenant_id === buyerCompanyFilter;
    return matchesSearch && matchesBuyerCompany;
  }) || [];

  const getBuyerCompanyName = (tenantId: string | null) => {
    if (!tenantId || !buyerCompanies) return 'Unassigned';
    const company = buyerCompanies.find(c => c.id === tenantId);
    return company ? `${company.name} (${company.code})` : 'Unassigned';
  };

  const handleAction = (vendor: VendorRow, action: 'approve' | 'reject') => {
    setSelectedVendor(vendor);
    setActionType(action);
    setComments('');
    setShowActionDialog(true);
  };

  const submitAction = async () => {
    if (!selectedVendor) return;
    try {
      await purchaseAction.mutateAsync({
        vendorId: selectedVendor.id,
        action: actionType,
        comments,
      });

      setShowActionDialog(false);
      setShowDetails(false);
      setSelectedVendor(null);
    } catch (error) {
      console.error('Action failed:', error);
    }
  };

  // Helper function to map vendor verification status columns to ValidationResult format
  const getValidationsFromVendor = (vendor: VendorRow | null): ValidationResult[] => {
    if (!vendor) return [];

    const vendorData = vendor as VendorRow & {
      gst_verification_status?: string;
      pan_verification_status?: string;
      bank_verification_status?: string;
      msme_verification_status?: string;
      name_match_verification_status?: string;
    };

    return [
      {
        type: 'gst' as const,
        status: (vendorData.gst_verification_status || 'pending') as ValidationResult['status'],
        message: vendorData.gst_verification_status === 'passed' ? 'GST verified' : 'GST verification pending',
        timestamp: vendor.submitted_at || vendor.created_at,
      },
      {
        type: 'pan' as const,
        status: (vendorData.pan_verification_status || 'pending') as ValidationResult['status'],
        message: vendorData.pan_verification_status === 'passed' ? 'PAN verified' : 'PAN verification pending',
        timestamp: vendor.submitted_at || vendor.created_at,
      },
      {
        type: 'bank' as const,
        status: (vendorData.bank_verification_status || 'pending') as ValidationResult['status'],
        message: vendorData.bank_verification_status === 'passed' ? 'Bank account verified' : 'Bank verification pending',
        timestamp: vendor.submitted_at || vendor.created_at,
      },
      {
        type: 'msme' as const,
        status: (vendorData.msme_verification_status || 'skipped') as ValidationResult['status'],
        message: vendorData.msme_verification_status === 'passed' ? 'MSME verified' :
          vendorData.msme_verification_status === 'skipped' ? 'MSME not provided' : 'MSME verification pending',
        timestamp: vendor.submitted_at || vendor.created_at,
      },
      {
        type: 'name_match' as const,
        status: (vendorData.name_match_verification_status || 'pending') as ValidationResult['status'],
        message: vendorData.name_match_verification_status === 'passed' ? 'Name match verified' : 'Name match pending',
        timestamp: vendor.submitted_at || vendor.created_at,
      },
    ];
  };

  // Get validations from vendor's verification status columns
  const mappedValidations: ValidationResult[] = getValidationsFromVendor(selectedVendor);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <Truck className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">SCM Approval</h1>
          </div>
          <p className="text-muted-foreground">Review and approve vendors for SAP synchronization</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search vendors..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-11 h-11 rounded-xl" />
          </div>
          <Select value={buyerCompanyFilter} onValueChange={setBuyerCompanyFilter}>
            <SelectTrigger className="w-56 h-11 rounded-xl">
              <Building2 className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by buyer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Buyer Companies</SelectItem>
              {buyerCompanies?.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name} ({company.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <Card key={i} className="border-0 shadow-md"><CardContent className="p-6"><div className="flex items-start gap-4"><Skeleton className="h-14 w-14 rounded-xl" /><div className="flex-1 space-y-3"><Skeleton className="h-5 w-56" /><Skeleton className="h-4 w-40" /></div></div></CardContent></Card>
          ))
        ) : filteredVendors.length === 0 ? (
          <Card className="border-0 shadow-md"><CardContent className="py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center mx-auto mb-4 shadow-lg"><CheckCircle className="h-8 w-8 text-white" /></div>
            <h3 className="text-xl font-semibold">All caught up!</h3>
            <p className="text-muted-foreground mt-2">No vendors pending purchase approval.</p>
          </CardContent></Card>
        ) : (
          filteredVendors.map((vendor) => {
            const isStuck = stuckIds.has(vendor.id);
            const scmBadge = getScmStatusBadge(vendor.id);
            const { isActiveApprover, active } = getActiveLevelInfo(vendor.id);
            const canAct = !isStuck && !!active && isActiveApprover;
            const disabledReason = isStuck
              ? 'No SCM matrix configured for this vendor.'
              : !active
                ? 'No pending SCM level for this vendor.'
                : 'Only the active SCM approver can act. Use the My Approvals page.';
            return (
            <Card key={vendor.id} className="border-0 shadow-md card-interactive">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-500/5 flex items-center justify-center"><Building2 className="h-7 w-7 text-teal-600" /></div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-bold text-lg">{vendor.legal_name || 'Unnamed Vendor'}</h3>
                        <Badge className={scmBadge.className}>{scmBadge.label}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{getBuyerCompanyName(vendor.tenant_id)} • {vendor.industry_type}</p>
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="font-mono bg-muted px-2 py-0.5 rounded">ID: {vendor.id.slice(0, 8)}...</span>
                        <span>GSTIN: {vendor.gstin || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {vendor.finance_comments && (
                      <Button
                        variant="outline"
                        className="rounded-xl border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700"
                        onClick={() => {
                          setSelectedFinanceComment({ vendorName: vendor.legal_name || 'Vendor', comment: vendor.finance_comments });
                          setShowFinanceCommentDialog(true);
                        }}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />Comment
                      </Button>
                    )}
                    <Button variant="outline" className="rounded-xl" onClick={() => { setSelectedVendor(vendor); setShowDetails(true); }}><Eye className="h-4 w-4 mr-2" />Details</Button>
                    {canReRoute && isStuck && (
                      <Button
                        variant="outline"
                        className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10"
                        onClick={() => reRoute.mutate(vendor.id)}
                        disabled={reRoute.isPending}
                      >
                        {reRoute.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                        Re-route
                      </Button>
                    )}
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button
                              className="rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 shadow-lg shadow-teal-500/20 disabled:opacity-50"
                              onClick={() => handleAction(vendor, 'approve')}
                              disabled={!canAct}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />Approve
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {!canAct && <TooltipContent>{disabledReason}</TooltipContent>}
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button
                              variant="destructive"
                              className="rounded-xl disabled:opacity-50"
                              onClick={() => handleAction(vendor, 'reject')}
                              disabled={!canAct}
                            >
                              <XCircle className="h-4 w-4 mr-2" />Reject
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {!canAct && <TooltipContent>{disabledReason}</TooltipContent>}
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                {isStuck && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>No SCM approval matrix configured</AlertTitle>
                    <AlertDescription className="flex items-center justify-between gap-3 flex-wrap">
                      <span>
                        This vendor has no approval levels seeded. An admin must configure the matrix for{' '}
                        <strong>{getBuyerCompanyName(vendor.tenant_id)}</strong>, then click <em>Re-route</em>.
                      </span>
                      {canReRoute && (
                        <Link to="/admin/configuration" className="underline font-medium whitespace-nowrap">
                          Open Approval Matrix →
                        </Link>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
            );
          })
        )}
      </div>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-xl">Vendor Details - {selectedVendor?.legal_name}</DialogTitle></DialogHeader>
          {selectedVendor && (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-4 rounded-xl bg-muted p-1">
                <TabsTrigger value="details" className="rounded-lg">Details</TabsTrigger>
                <TabsTrigger value="documents" className="rounded-lg"><FolderOpen className="h-4 w-4 mr-2" />Documents</TabsTrigger>
                <TabsTrigger value="validations" className="rounded-lg">Validations</TabsTrigger>
                <TabsTrigger value="workflow" className="rounded-lg">Workflow</TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="mt-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Legal Name:</span> <span className="font-medium">{selectedVendor.legal_name}</span></div>
                  <div><span className="text-muted-foreground">Trade Name:</span> <span className="font-medium">{selectedVendor.trade_name || '-'}</span></div>
                  <div><span className="text-muted-foreground">GSTIN:</span> <span className="font-mono font-medium">{selectedVendor.gstin || '-'}</span></div>
                  <div><span className="text-muted-foreground">PAN:</span> <span className="font-mono font-medium">{selectedVendor.pan || '-'}</span></div>
                  <div><span className="text-muted-foreground">Industry:</span> <span className="font-medium">{selectedVendor.industry_type || '-'}</span></div>
                  <div><span className="text-muted-foreground">Entity Type:</span> <span className="font-medium">{selectedVendor.entity_type || '-'}</span></div>
                  <div><span className="text-muted-foreground">Location:</span> <span className="font-medium">{selectedVendor.registered_city}, {selectedVendor.registered_state}</span></div>
                  <div><span className="text-muted-foreground">Bank:</span> <span className="font-medium">{selectedVendor.bank_name || '-'}</span></div>
                  <div><span className="text-muted-foreground">Account:</span> <span className="font-mono font-medium">{selectedVendor.account_number || '-'}</span></div>
                  <div><span className="text-muted-foreground">IFSC:</span> <span className="font-mono font-medium">{selectedVendor.ifsc_code || '-'}</span></div>
                </div>
              </TabsContent>
              <TabsContent value="documents" className="mt-6">
                <VendorDocuments vendorId={selectedVendor.id} />
              </TabsContent>
              <TabsContent value="validations" className="mt-6">
                <ValidationStatus validations={mappedValidations} />
              </TabsContent>
              <TabsContent value="workflow" className="mt-6">
                <ApprovalTimeline vendorId={selectedVendor.id} />
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter className="gap-2 mt-6">
            <Button variant="destructive" className="rounded-xl" onClick={() => handleAction(selectedVendor!, 'reject')}><XCircle className="h-4 w-4 mr-2" />Reject</Button>
            <Button className="rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500" onClick={() => handleAction(selectedVendor!, 'approve')}><CheckCircle className="h-4 w-4 mr-2" />Approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>{actionType === 'approve' ? '✅ Approve Vendor' : '❌ Reject Vendor'}</DialogTitle>
            <DialogDescription>
              {actionType === 'approve'
                ? 'Approved vendors will be available for SAP sync in the SAP Sync page.'
                : 'Please provide a reason for rejection.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4"><Textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder={actionType === 'approve' ? 'Optional comments...' : 'Reason for rejection...'} className="rounded-xl" rows={4} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActionDialog(false)} className="rounded-xl">Cancel</Button>
            <Button variant={actionType === 'reject' ? 'destructive' : 'default'} onClick={submitAction} disabled={(actionType === 'reject' && !comments.trim()) || purchaseAction.isPending} className={`rounded-xl ${actionType === 'approve' ? 'bg-gradient-to-r from-teal-500 to-emerald-500' : ''}`}>
              {purchaseAction.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</> : actionType === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Finance Comment Popup Dialog */}
      <Dialog open={showFinanceCommentDialog} onOpenChange={setShowFinanceCommentDialog}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-amber-600" />
              Finance Team Comment
            </DialogTitle>
            <DialogDescription>
              Comment for {selectedFinanceComment.vendorName}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <p className="text-sm text-amber-900 dark:text-amber-100">
                {selectedFinanceComment.comment || 'No comment provided'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowFinanceCommentDialog(false)} className="rounded-xl">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
