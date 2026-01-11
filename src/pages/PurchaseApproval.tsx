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
import { useVendors, useVendorValidations, usePurchaseAction, useBuyerCompanies, VendorRow } from '@/hooks/useVendors';
import { useRunValidations } from '@/hooks/useVendorValidations';
import { addSampleDocumentsForVendor } from '@/utils/sampleDocuments';
import { ValidationResult } from '@/types/vendor';
import { 
  Search, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Building2,
  FileText,
  IndianRupee,
  User,
  Filter,
  Truck,
  Loader2,
  RefreshCw,
  FolderOpen,
  Plus
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

export default function PurchaseApproval() {
  const [searchTerm, setSearchTerm] = useState('');
  const [buyerCompanyFilter, setBuyerCompanyFilter] = useState<string>('all');
  const [selectedVendor, setSelectedVendor] = useState<VendorRow | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [comments, setComments] = useState('');
  const [addingSampleDocs, setAddingSampleDocs] = useState(false);

  const { data: pendingVendors, isLoading } = useVendors(['purchase_review']);
  const { data: buyerCompanies } = useBuyerCompanies();
  const { data: validations, refetch: refetchValidations } = useVendorValidations(selectedVendor?.id);
  const purchaseAction = usePurchaseAction();
  const runValidations = useRunValidations();

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

  const handleRerunValidations = async () => {
    if (!selectedVendor) return;
    await runValidations.mutateAsync({
      vendorId: selectedVendor.id,
      gstin: selectedVendor.gstin,
      pan: selectedVendor.pan,
      legalName: selectedVendor.legal_name,
      accountNumber: selectedVendor.account_number,
      ifscCode: selectedVendor.ifsc_code,
      msmeNumber: selectedVendor.msme_number,
    });
    refetchValidations();
  };

  const handleAddSampleDocs = async () => {
    if (!selectedVendor) return;
    setAddingSampleDocs(true);
    const result = await addSampleDocumentsForVendor(selectedVendor.id);
    if (result.success) {
      toast.success('Sample documents added successfully');
    } else {
      toast.error('Failed to add sample documents');
    }
    setAddingSampleDocs(false);
  };

  const submitAction = async () => {
    if (!selectedVendor) return;
    await purchaseAction.mutateAsync({
      vendorId: selectedVendor.id,
      action: actionType,
      comments,
    });
    setShowActionDialog(false);
    setShowDetails(false);
    setSelectedVendor(null);
  };

  const mappedValidations: ValidationResult[] = validations?.map(v => ({
    type: v.validation_type as ValidationResult['type'],
    status: v.status as ValidationResult['status'],
    message: v.message || '',
    timestamp: v.validated_at,
  })) || [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <Truck className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Purchase Approval</h1>
          </div>
          <p className="text-muted-foreground">Final approval before SAP synchronization</p>
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
          filteredVendors.map((vendor) => (
            <Card key={vendor.id} className="border-0 shadow-md card-interactive">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-500/5 flex items-center justify-center"><Building2 className="h-7 w-7 text-teal-600" /></div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-bold text-lg">{vendor.legal_name || 'Unnamed Vendor'}</h3>
                        <Badge className="bg-green-100 text-green-700 border-green-200">Finance Approved</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{getBuyerCompanyName(vendor.tenant_id)} • {vendor.industry_type}</p>
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="font-mono bg-muted px-2 py-0.5 rounded">ID: {vendor.id.slice(0, 8)}...</span>
                        <span>GSTIN: {vendor.gstin || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" className="rounded-xl" onClick={() => { setSelectedVendor(vendor); setShowDetails(true); }}><Eye className="h-4 w-4 mr-2" />Details</Button>
                    <Button className="rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 shadow-lg shadow-teal-500/20" onClick={() => handleAction(vendor, 'approve')}><Truck className="h-4 w-4 mr-2" />Approve & Sync</Button>
                    <Button variant="destructive" className="rounded-xl" onClick={() => handleAction(vendor, 'reject')}><XCircle className="h-4 w-4 mr-2" />Reject</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-xl">Vendor Details - {selectedVendor?.legal_name}</DialogTitle></DialogHeader>
          {selectedVendor && (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-3 rounded-xl bg-muted p-1">
                <TabsTrigger value="details" className="rounded-lg">Details</TabsTrigger>
                <TabsTrigger value="documents" className="rounded-lg"><FolderOpen className="h-4 w-4 mr-2" />Documents</TabsTrigger>
                <TabsTrigger value="validations" className="rounded-lg">Validations</TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="mt-6"><p className="text-muted-foreground">Organization: {selectedVendor.legal_name} | GSTIN: {selectedVendor.gstin} | PAN: {selectedVendor.pan}</p></TabsContent>
              <TabsContent value="documents" className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Vendor Documents</h3>
                  <Button variant="outline" size="sm" onClick={handleAddSampleDocs} disabled={addingSampleDocs} className="rounded-xl">
                    {addingSampleDocs ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adding...</> : <><Plus className="h-4 w-4 mr-2" />Add Sample Docs</>}
                  </Button>
                </div>
                <VendorDocuments vendorId={selectedVendor.id} />
              </TabsContent>
              <TabsContent value="validations" className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Validation Results</h3>
                  <Button variant="outline" size="sm" onClick={handleRerunValidations} disabled={runValidations.isPending} className="rounded-xl">
                    {runValidations.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running...</> : <><RefreshCw className="h-4 w-4 mr-2" />Re-run</>}
                  </Button>
                </div>
                <ValidationStatus validations={mappedValidations} isProcessing={runValidations.isPending} />
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter className="gap-2 mt-6">
            <Button variant="destructive" className="rounded-xl" onClick={() => handleAction(selectedVendor!, 'reject')}><XCircle className="h-4 w-4 mr-2" />Reject</Button>
            <Button className="rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500" onClick={() => handleAction(selectedVendor!, 'approve')}><Truck className="h-4 w-4 mr-2" />Approve & Sync</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>{actionType === 'approve' ? '🚀 Approve & Sync to SAP' : '❌ Reject Vendor'}</DialogTitle></DialogHeader>
          <div className="py-4"><Textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder={actionType === 'approve' ? 'Optional comments...' : 'Reason for rejection...'} className="rounded-xl" rows={4} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActionDialog(false)} className="rounded-xl">Cancel</Button>
            <Button variant={actionType === 'reject' ? 'destructive' : 'default'} onClick={submitAction} disabled={(actionType === 'reject' && !comments.trim()) || purchaseAction.isPending} className={`rounded-xl ${actionType === 'approve' ? 'bg-gradient-to-r from-teal-500 to-emerald-500' : ''}`}>
              {purchaseAction.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</> : actionType === 'approve' ? 'Confirm & Sync' : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
