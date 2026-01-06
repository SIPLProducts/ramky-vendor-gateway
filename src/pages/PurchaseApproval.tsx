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
import { getVendorsByStatus } from '@/data/mockVendors';
import { Vendor } from '@/types/vendor';
import { 
  Search, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Building2,
  Filter,
  Truck,
  ArrowRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function PurchaseApproval() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [comments, setComments] = useState('');
  const { toast } = useToast();

  const pendingVendors = getVendorsByStatus(['purchase_review']);

  const filteredVendors = pendingVendors.filter((vendor) =>
    vendor.formData.organization.legalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.formData.statutory.gstin.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAction = (vendor: Vendor, action: 'approve' | 'reject') => {
    setSelectedVendor(vendor);
    setActionType(action);
    setComments('');
    setShowActionDialog(true);
  };

  const submitAction = () => {
    toast({
      title: actionType === 'approve' ? 'Approved & Synced to SAP' : 'Rejected',
      description: actionType === 'approve' 
        ? 'Vendor has been approved and synced to SAP. Vendor code will be generated.' 
        : 'Vendor registration has been rejected.',
    });
    
    setShowActionDialog(false);
    setShowDetails(false);
  };

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
        {filteredVendors.length === 0 ? (
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
                          {vendor.formData.organization.legalName}
                        </h3>
                        <Badge className="bg-success/10 text-success hover:bg-success/20">Finance Approved</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {vendor.formData.organization.industryType} • {vendor.formData.organization.productCategories.slice(0, 2).join(', ')}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span>ID: {vendor.id}</span>
                        <span>GSTIN: {vendor.formData.statutory.gstin}</span>
                      </div>
                      {vendor.financeComments && (
                        <div className="mt-2 p-2 bg-muted/50 rounded text-sm">
                          <span className="font-medium">Finance Notes:</span> {vendor.financeComments}
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
              disabled={actionType === 'reject' && !comments.trim()}
            >
              {actionType === 'approve' ? 'Confirm & Sync SAP' : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
