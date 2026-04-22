import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ValidationStatus } from '@/components/vendor/ValidationStatus';
import { VendorDocuments } from '@/components/vendor/VendorDocuments';
import {
  useVendors,
  useFinanceAction,
  useBuyerCompanies,
  useVendorApprovalTrail,
  VendorRow,
} from '@/hooks/useVendors';
import { useRunValidations } from '@/hooks/useVendorValidations';
import { addSampleDocumentsForVendor } from '@/utils/sampleDocuments';
import { ValidationResult } from '@/types/vendor';
import {
  Search,
  Eye,
  CheckCircle,
  XCircle,
  MessageSquare,
  Building2,
  FileText,
  IndianRupee,
  User,
  Loader2,
  FolderOpen,
  Plus,
  CheckCircle2,
  Clock,
  Circle,
  Workflow,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

export default function FinanceReview() {
  const [searchTerm, setSearchTerm] = useState('');
  const [buyerCompanyFilter, setBuyerCompanyFilter] = useState<string>('all');
  const [selectedVendor, setSelectedVendor] = useState<VendorRow | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'clarify'>('approve');
  const [comments, setComments] = useState('');
  const [addingSampleDocs, setAddingSampleDocs] = useState(false);

  const { data: pendingVendors, isLoading } = useVendors(['finance_review', 'validation_failed']);
  const { data: buyerCompanies } = useBuyerCompanies();
  const financeAction = useFinanceAction();
  const runValidations = useRunValidations();
  const { data: approvalTrail = [], isLoading: isTrailLoading } = useVendorApprovalTrail(selectedVendor?.id);

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

  const handleAction = (vendor: VendorRow, action: 'approve' | 'reject' | 'clarify') => {
    setSelectedVendor(vendor);
    setActionType(action);
    setComments('');
    setShowActionDialog(true);
  };

  const handleAddSampleDocs = async () => {
    if (!selectedVendor) return;
    setAddingSampleDocs(true);
    const result = await addSampleDocumentsForVendor(selectedVendor.id);
    if (result.success) toast.success('Sample documents added successfully');
    else toast.error('Failed to add sample documents');
    setAddingSampleDocs(false);
  };

  const submitAction = async () => {
    if (!selectedVendor) return;
    await financeAction.mutateAsync({
      vendorId: selectedVendor.id,
      action: actionType,
      comments,
    });
    setShowActionDialog(false);
    setShowDetails(false);
    setSelectedVendor(null);
  };

  const getStatusBadge = (status: string) => {
    if (status === 'validation_failed') {
      return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">Validation Failed</Badge>;
    }
    return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">Pending Review</Badge>;
  };

  const getValidationsFromVendor = (vendor: VendorRow | null): ValidationResult[] => {
    if (!vendor) return [];
    const v = vendor as VendorRow & {
      gst_verification_status?: string;
      pan_verification_status?: string;
      bank_verification_status?: string;
      msme_verification_status?: string;
      name_match_verification_status?: string;
    };
    return [
      { type: 'gst', status: (v.gst_verification_status || 'pending') as ValidationResult['status'], message: v.gst_verification_status === 'passed' ? 'GST verified' : 'GST verification pending', timestamp: vendor.submitted_at || vendor.created_at },
      { type: 'pan', status: (v.pan_verification_status || 'pending') as ValidationResult['status'], message: v.pan_verification_status === 'passed' ? 'PAN verified' : 'PAN verification pending', timestamp: vendor.submitted_at || vendor.created_at },
      { type: 'bank', status: (v.bank_verification_status || 'pending') as ValidationResult['status'], message: v.bank_verification_status === 'passed' ? 'Bank account verified' : 'Bank verification pending', timestamp: vendor.submitted_at || vendor.created_at },
      { type: 'msme', status: (v.msme_verification_status || 'skipped') as ValidationResult['status'], message: v.msme_verification_status === 'passed' ? 'MSME verified' : v.msme_verification_status === 'skipped' ? 'MSME not provided' : 'MSME verification pending', timestamp: vendor.submitted_at || vendor.created_at },
      { type: 'name_match', status: (v.name_match_verification_status || 'pending') as ValidationResult['status'], message: v.name_match_verification_status === 'passed' ? 'Name match verified' : 'Name match pending', timestamp: vendor.submitted_at || vendor.created_at },
    ];
  };

  const mappedValidations: ValidationResult[] = getValidationsFromVendor(selectedVendor);

  const trailStatusBadge = (status: string) => {
    if (status === 'approved') return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Approved</Badge>;
    if (status === 'rejected') return <Badge variant="destructive">Rejected</Badge>;
    return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Pending</Badge>;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <CheckCircle className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Finance Review</h1>
          </div>
          <p className="text-muted-foreground">Review and approve vendor registrations after Purchase/SCM approval</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, GSTIN, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 h-11 rounded-xl"
            />
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

      {/* Vendor Cards */}
      <div className="grid gap-4">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <Card key={i} className="border-0 shadow-md">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-14 w-14 rounded-xl" />
                  <div className="flex-1 space-y-3">
                    <Skeleton className="h-5 w-56" />
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-72" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : filteredVendors.length === 0 ? (
          <Card className="border-0 shadow-md">
            <CardContent className="py-16 text-center">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/20">
                <CheckCircle className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold">All caught up!</h3>
              <p className="text-muted-foreground mt-2">No vendors pending finance review.</p>
            </CardContent>
          </Card>
        ) : (
          filteredVendors.map((vendor) => (
            <Card key={vendor.id} className="border-0 shadow-md card-interactive">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <Building2 className="h-7 w-7 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-bold text-lg text-foreground">
                          {vendor.legal_name || 'Unnamed Vendor'}
                        </h3>
                        {getStatusBadge(vendor.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {getBuyerCompanyName(vendor.tenant_id)} • {vendor.registered_city}, {vendor.registered_state}
                      </p>
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="font-mono bg-muted px-2 py-0.5 rounded">ID: {vendor.id.slice(0, 8)}...</span>
                        <span>GSTIN: {vendor.gstin || 'N/A'}</span>
                        <span>Submitted: {vendor.submitted_at ? new Date(vendor.submitted_at).toLocaleDateString('en-IN') : '-'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => {
                        setSelectedVendor(vendor);
                        setShowDetails(true);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                    <Button
                      className="rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-lg shadow-green-500/20"
                      onClick={() => handleAction(vendor, 'approve')}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      className="rounded-xl"
                      onClick={() => handleAction(vendor, 'reject')}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </div>

                {vendor.status === 'validation_failed' && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20 rounded-xl border border-red-200 dark:border-red-800">
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400">⚠️ Validation Issues Detected</p>
                    <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">
                      Please review vendor details and validations before proceeding.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Vendor Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Vendor Details - {selectedVendor?.legal_name}</DialogTitle>
            <DialogDescription>
              Review complete vendor information, Purchase/SCM approval trail, documents, and validations
            </DialogDescription>
          </DialogHeader>

          {selectedVendor && (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-4 rounded-xl bg-muted p-1">
                <TabsTrigger value="details" className="rounded-lg">Details</TabsTrigger>
                <TabsTrigger value="approval-trail" className="flex items-center gap-2 rounded-lg">
                  <Workflow className="h-4 w-4" />
                  Approval Trail
                </TabsTrigger>
                <TabsTrigger value="documents" className="flex items-center gap-2 rounded-lg">
                  <FolderOpen className="h-4 w-4" />
                  Documents
                </TabsTrigger>
                <TabsTrigger value="validations" className="rounded-lg">Validations</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-6 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        Organization
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-3">
                      <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Legal Name</span><span className="font-semibold">{selectedVendor.legal_name}</span></div>
                      <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Trade Name</span><span>{selectedVendor.trade_name || 'N/A'}</span></div>
                      <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Industry</span><span>{selectedVendor.industry_type || 'N/A'}</span></div>
                      <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Location</span><span>{selectedVendor.registered_city}, {selectedVendor.registered_state}</span></div>
                      <div className="flex justify-between py-2"><span className="text-muted-foreground">Address</span><span className="text-right max-w-[200px]">{selectedVendor.registered_address}</span></div>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/5 flex items-center justify-center">
                          <User className="h-4 w-4 text-blue-600" />
                        </div>
                        Contact
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-3">
                      <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Name</span><span className="font-semibold">{selectedVendor.primary_contact_name || 'N/A'}</span></div>
                      <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Designation</span><span>{selectedVendor.primary_designation || 'N/A'}</span></div>
                      <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Email</span><span>{selectedVendor.primary_email || 'N/A'}</span></div>
                      <div className="flex justify-between py-2"><span className="text-muted-foreground">Phone</span><span>{selectedVendor.primary_phone || 'N/A'}</span></div>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-500/5 flex items-center justify-center">
                          <FileText className="h-4 w-4 text-purple-600" />
                        </div>
                        Statutory
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-3">
                      <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">GSTIN</span><span className="font-mono bg-muted px-2 py-0.5 rounded">{selectedVendor.gstin || 'N/A'}</span></div>
                      <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">PAN</span><span className="font-mono bg-muted px-2 py-0.5 rounded">{selectedVendor.pan || 'N/A'}</span></div>
                      <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Entity Type</span><span>{selectedVendor.entity_type || 'N/A'}</span></div>
                      {selectedVendor.msme_number && (
                        <>
                          <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">MSME No.</span><span className="font-mono">{selectedVendor.msme_number}</span></div>
                          <div className="flex justify-between py-2"><span className="text-muted-foreground">MSME Category</span><span>{selectedVendor.msme_category || 'N/A'}</span></div>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-green-500/20 to-green-500/5 flex items-center justify-center">
                          <IndianRupee className="h-4 w-4 text-green-600" />
                        </div>
                        Bank & Financial
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-3">
                      <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Bank</span><span>{selectedVendor.bank_name || 'N/A'}</span></div>
                      <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Account</span><span className="font-mono">{selectedVendor.account_number ? `XXXX${selectedVendor.account_number.slice(-4)}` : 'N/A'}</span></div>
                      <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">IFSC</span><span className="font-mono bg-muted px-2 py-0.5 rounded">{selectedVendor.ifsc_code || 'N/A'}</span></div>
                      <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Branch</span><span>{selectedVendor.branch_name || 'N/A'}</span></div>
                      <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Account Type</span><span className="capitalize">{selectedVendor.account_type || 'N/A'}</span></div>
                      <div className="flex justify-between py-2"><span className="text-muted-foreground">Credit Period</span><span>{selectedVendor.credit_period_expected ? `${selectedVendor.credit_period_expected} Days` : 'N/A'}</span></div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Purchase / SCM Approval Trail */}
              <TabsContent value="approval-trail" className="space-y-4 mt-6">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Workflow className="h-4 w-4 text-primary" />
                      Purchase / SCM Approval Trail
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isTrailLoading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                      </div>
                    ) : approvalTrail.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">
                        No Purchase/SCM approval trail available for this vendor.
                      </p>
                    ) : (
                      <ol className="space-y-4">
                        {approvalTrail.map((row) => {
                          const Icon = row.status === 'approved' ? CheckCircle2
                            : row.status === 'rejected' ? XCircle
                            : row.status === 'pending' ? Clock : Circle;
                          const iconColor = row.status === 'approved' ? 'text-green-600'
                            : row.status === 'rejected' ? 'text-destructive'
                            : 'text-amber-500';
                          return (
                            <li key={row.id} className="flex items-start gap-3 p-3 rounded-xl border bg-card">
                              <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${iconColor}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <Badge variant="outline">L{row.level_number}</Badge>
                                  <span className="font-semibold text-sm">{row.level_name}</span>
                                  {trailStatusBadge(row.status)}
                                </div>
                                {row.approver_name || row.approver_email ? (
                                  <p className="text-xs text-muted-foreground">
                                    by {row.approver_name || row.approver_email}
                                    {row.acted_at ? ` · ${new Date(row.acted_at).toLocaleString('en-IN')}` : ''}
                                  </p>
                                ) : (
                                  <p className="text-xs text-muted-foreground">Awaiting action</p>
                                )}
                                <div className="mt-2 p-2 rounded-lg bg-muted/50">
                                  <p className="text-xs text-muted-foreground mb-0.5">SCM comments</p>
                                  {row.comments ? (
                                    <p className="text-sm italic">"{row.comments}"</p>
                                  ) : (
                                    <p className="text-sm text-muted-foreground">No comments provided</p>
                                  )}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="documents" className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Vendor Documents</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddSampleDocs}
                    disabled={addingSampleDocs}
                    className="rounded-xl"
                  >
                    {addingSampleDocs ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adding...</>
                    ) : (
                      <><Plus className="h-4 w-4 mr-2" />Add Sample Docs</>
                    )}
                  </Button>
                </div>
                <VendorDocuments vendorId={selectedVendor.id} />
              </TabsContent>

              <TabsContent value="validations" className="space-y-4 mt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Validation Results</h3>
                </div>
                <ValidationStatus
                  validations={mappedValidations}
                  isProcessing={runValidations.isPending}
                />
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter className="gap-2 mt-6">
            <Button variant="outline" onClick={() => handleAction(selectedVendor!, 'clarify')} className="rounded-xl">
              <MessageSquare className="h-4 w-4 mr-2" />
              Request Clarification
            </Button>
            <Button variant="destructive" onClick={() => handleAction(selectedVendor!, 'reject')} className="rounded-xl">
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button
              onClick={() => handleAction(selectedVendor!, 'approve')}
              className="rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {actionType === 'approve' && '✅ Approve Vendor'}
              {actionType === 'reject' && '❌ Reject Vendor'}
              {actionType === 'clarify' && '💬 Request Clarification'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve' && 'Vendor will be marked Finance Approved and queued for SAP sync.'}
              {actionType === 'reject' && 'This vendor registration will be rejected. Please provide a reason.'}
              {actionType === 'clarify' && 'A clarification request will be sent to the vendor.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Comments {actionType !== 'approve' && <span className="text-red-500">*</span>}</label>
              <Textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder={
                  actionType === 'approve'
                    ? 'Optional comments...'
                    : 'Enter reason or clarification request...'
                }
                className="mt-2 rounded-xl"
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActionDialog(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              variant={actionType === 'reject' ? 'destructive' : 'default'}
              onClick={submitAction}
              disabled={(actionType !== 'approve' && !comments.trim()) || financeAction.isPending}
              className={`rounded-xl ${actionType === 'approve' ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600' : ''}`}
            >
              {financeAction.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
              ) : (
                <>
                  {actionType === 'approve' && 'Confirm Approval'}
                  {actionType === 'reject' && 'Confirm Rejection'}
                  {actionType === 'clarify' && 'Send Request'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
