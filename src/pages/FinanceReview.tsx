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
import { ValidationStatus } from '@/components/vendor/ValidationStatus';
import { useVendors, useVendorValidations, useFinanceAction, VendorRow } from '@/hooks/useVendors';
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
  Filter,
  Loader2
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function FinanceReview() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<VendorRow | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'clarify'>('approve');
  const [comments, setComments] = useState('');

  const { data: pendingVendors, isLoading } = useVendors(['finance_review', 'validation_failed']);
  const { data: validations } = useVendorValidations(selectedVendor?.id);
  const financeAction = useFinanceAction();

  const filteredVendors = pendingVendors?.filter((vendor) =>
    (vendor.legal_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (vendor.gstin || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.id.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleAction = (vendor: VendorRow, action: 'approve' | 'reject' | 'clarify') => {
    setSelectedVendor(vendor);
    setActionType(action);
    setComments('');
    setShowActionDialog(true);
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
      return <Badge variant="destructive">Validation Failed</Badge>;
    }
    return <Badge variant="secondary">Pending Review</Badge>;
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
          <h1 className="text-2xl font-bold text-foreground">Finance Review</h1>
          <p className="text-muted-foreground">Review and approve vendor registrations</p>
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
              <p className="text-muted-foreground">No vendors pending finance review.</p>
            </CardContent>
          </Card>
        ) : (
          filteredVendors.map((vendor) => (
            <Card key={vendor.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">
                          {vendor.legal_name || 'Unnamed Vendor'}
                        </h3>
                        {getStatusBadge(vendor.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {vendor.registered_city}, {vendor.registered_state}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span>ID: {vendor.id.slice(0, 8)}...</span>
                        <span>GSTIN: {vendor.gstin || 'N/A'}</span>
                        <span>Submitted: {vendor.submitted_at ? new Date(vendor.submitted_at).toLocaleDateString('en-IN') : '-'}</span>
                      </div>
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
                      View Details
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleAction(vendor, 'approve')}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve
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

                {vendor.status === 'validation_failed' && (
                  <div className="mt-4 p-3 bg-destructive/10 rounded-md">
                    <p className="text-sm font-medium text-destructive">Validation Issues Detected</p>
                    <p className="text-sm text-destructive/80 mt-1">
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vendor Details - {selectedVendor?.legal_name}</DialogTitle>
            <DialogDescription>
              Review complete vendor information before approval
            </DialogDescription>
          </DialogHeader>

          {selectedVendor && (
            <div className="space-y-6">
              <ValidationStatus validations={mappedValidations} />

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
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => handleAction(selectedVendor!, 'clarify')}>
              <MessageSquare className="h-4 w-4 mr-1" />
              Request Clarification
            </Button>
            <Button variant="destructive" onClick={() => handleAction(selectedVendor!, 'reject')}>
              <XCircle className="h-4 w-4 mr-1" />
              Reject
            </Button>
            <Button onClick={() => handleAction(selectedVendor!, 'approve')}>
              <CheckCircle className="h-4 w-4 mr-1" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' && 'Approve Vendor'}
              {actionType === 'reject' && 'Reject Vendor'}
              {actionType === 'clarify' && 'Request Clarification'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve' && 'This vendor will be forwarded to the Purchase team for final approval.'}
              {actionType === 'reject' && 'This vendor registration will be rejected. Please provide a reason.'}
              {actionType === 'clarify' && 'A clarification request will be sent to the vendor.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Comments {actionType !== 'approve' && '*'}</label>
              <Textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder={
                  actionType === 'approve'
                    ? 'Optional comments for Purchase team...'
                    : 'Enter reason or clarification request...'
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
              onClick={submitAction}
              disabled={(actionType !== 'approve' && !comments.trim()) || financeAction.isPending}
            >
              {financeAction.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
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
