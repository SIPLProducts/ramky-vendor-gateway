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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ValidationStatus } from '@/components/vendor/ValidationStatus';
import { VendorDocuments } from '@/components/vendor/VendorDocuments';
import { useVendors, useVendorValidations, usePurchaseAction, VendorRow } from '@/hooks/useVendors';
import { useRunValidations } from '@/hooks/useVendorValidations';
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
  ArrowRight,
  Loader2,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function PurchaseApproval() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<VendorRow | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [comments, setComments] = useState('');

  const { data: pendingVendors, isLoading } = useVendors(['purchase_review']);
  const { data: validations, refetch: refetchValidations } = useVendorValidations(selectedVendor?.id);
  const purchaseAction = usePurchaseAction();
  const runValidations = useRunValidations();

  const filteredVendors = pendingVendors?.filter((vendor) =>
    (vendor.legal_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (vendor.gstin || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.id.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

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

  // Convert DB validations to component format
  const mappedValidations: ValidationResult[] = validations?.map(v => ({
    type: v.validation_type as ValidationResult['type'],
    status: v.status as ValidationResult['status'],
    message: v.message || '',
    timestamp: v.validated_at,
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Purchase Approval</h1>
          <p className="text-muted-foreground">Final approval before SAP synchronization</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search vendors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : filteredVendors.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
              <h3 className="text-lg font-semibold">All caught up!</h3>
              <p className="text-muted-foreground">No vendors pending purchase approval.</p>
            </CardContent>
          </Card>
        ) : (
          filteredVendors.map((vendor) => (
            <Card key={vendor.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-lg bg-accent/20 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-accent" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">
                          {vendor.legal_name || 'Unnamed Vendor'}
                        </h3>
                        <Badge className="bg-success/10 text-success hover:bg-success/20">Finance Approved</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {vendor.industry_type} • {vendor.product_categories?.slice(0, 2).join(', ') || 'No categories'}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span>ID: {vendor.id.slice(0, 8)}...</span>
                        <span>GSTIN: {vendor.gstin || 'N/A'}</span>
                      </div>
                      {vendor.finance_comments && (
                        <div className="mt-2 p-2 bg-muted/50 rounded text-sm">
                          <span className="font-medium">Finance Notes:</span> {vendor.finance_comments}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedVendor(vendor);
                        setShowDetails(true);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Details
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-accent hover:bg-accent/90"
                      onClick={() => handleAction(vendor, 'approve')}
                    >
                      <Truck className="h-4 w-4 mr-1" />
                      Approve & Sync SAP
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleAction(vendor, 'reject')}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Vendor Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vendor Details - {selectedVendor?.legal_name}</DialogTitle>
            <DialogDescription>
              Review complete vendor information, documents, and validations
            </DialogDescription>
          </DialogHeader>

          {selectedVendor && (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="documents" className="flex items-center gap-1">
                  <FolderOpen className="h-4 w-4" />
                  Documents
                </TabsTrigger>
                <TabsTrigger value="validations">Validations</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-6 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Organization
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Legal Name</span>
                        <span className="font-medium">{selectedVendor.legal_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Trade Name</span>
                        <span>{selectedVendor.trade_name || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Industry</span>
                        <span>{selectedVendor.industry_type || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Location</span>
                        <span>{selectedVendor.registered_city}, {selectedVendor.registered_state}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Contact
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Name</span>
                        <span className="font-medium">{selectedVendor.primary_contact_name || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Email</span>
                        <span>{selectedVendor.primary_email || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Phone</span>
                        <span>{selectedVendor.primary_phone || 'N/A'}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Statutory
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">GSTIN</span>
                        <span className="font-mono">{selectedVendor.gstin || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">PAN</span>
                        <span className="font-mono">{selectedVendor.pan || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Entity Type</span>
                        <span>{selectedVendor.entity_type || 'N/A'}</span>
                      </div>
                      {selectedVendor.msme_number && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">MSME</span>
                          <span>{selectedVendor.msme_number}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <IndianRupee className="h-4 w-4" />
                        Bank & Financial
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Bank</span>
                        <span>{selectedVendor.bank_name || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Account</span>
                        <span className="font-mono">
                          {selectedVendor.account_number ? `XXXX${selectedVendor.account_number.slice(-4)}` : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">IFSC</span>
                        <span className="font-mono">{selectedVendor.ifsc_code || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Credit Period</span>
                        <span>{selectedVendor.credit_period_expected ? `${selectedVendor.credit_period_expected} Days` : 'N/A'}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {selectedVendor.finance_comments && (
                  <Card className="bg-muted/30">
                    <CardContent className="pt-4">
                      <p className="text-sm font-medium mb-1">Finance Team Comments:</p>
                      <p className="text-sm text-muted-foreground">{selectedVendor.finance_comments}</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="documents" className="mt-4">
                <VendorDocuments vendorId={selectedVendor.id} />
              </TabsContent>

              <TabsContent value="validations" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Validation Results</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRerunValidations}
                    disabled={runValidations.isPending}
                  >
                    {runValidations.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Re-run Validations
                      </>
                    )}
                  </Button>
                </div>
                <ValidationStatus 
                  validations={mappedValidations} 
                  isProcessing={runValidations.isPending} 
                />
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              onClick={() => handleAction(selectedVendor!, 'reject')}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Reject
            </Button>
            <Button
              className="bg-accent hover:bg-accent/90"
              onClick={() => handleAction(selectedVendor!, 'approve')}
            >
              <Truck className="h-4 w-4 mr-1" />
              Approve & Sync SAP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'Approve & Sync to SAP' : 'Reject Vendor'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve' 
                ? 'This vendor will be approved and synchronized with SAP. A vendor code will be generated automatically.'
                : 'This vendor registration will be rejected. Please provide a reason.'
              }
            </DialogDescription>
          </DialogHeader>

          {actionType === 'approve' && (
            <div className="bg-accent/10 p-4 rounded-md">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center">
                  <Truck className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="font-medium text-foreground">SAP Integration</p>
                  <p className="text-sm text-muted-foreground">
                    Vendor master data will be created in SAP
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground ml-auto" />
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">
                Comments {actionType === 'reject' && '*'}
              </label>
              <Textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder={
                  actionType === 'approve'
                    ? 'Optional approval notes...'
                    : 'Enter rejection reason...'
                }
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActionDialog(false)}>
              Cancel
            </Button>
            <Button
              variant={actionType === 'reject' ? 'destructive' : 'default'}
              className={actionType === 'approve' ? 'bg-accent hover:bg-accent/90' : ''}
              onClick={submitAction}
              disabled={(actionType === 'reject' && !comments.trim()) || purchaseAction.isPending}
            >
              {purchaseAction.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                actionType === 'approve' ? 'Confirm & Sync SAP' : 'Confirm Rejection'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
