import { ReactNode, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ValidationStatus } from '@/components/vendor/ValidationStatus';
import { VendorDocuments } from '@/components/vendor/VendorDocuments';
import { ValidationResult } from '@/types/vendor';
import {
  Building2,
  MapPin,
  User,
  Phone,
  Mail,
  FileText,
  Landmark,
  CreditCard,
  Calendar,
  MessageSquare,
  FolderOpen,
} from 'lucide-react';

interface VendorReviewDialogProps {
  vendorId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional extra footer button(s), e.g. "Prepare & Sync" on SAP Sync page. */
  footerExtra?: ReactNode;
  /** Override the dialog subtitle. Defaults to "Review vendor details before syncing to SAP". */
  description?: string;
}

const getValidationsFromVendor = (v: any): ValidationResult[] => {
  if (!v) return [];
  const ts = v.submitted_at || v.created_at;
  return [
    {
      type: 'gst',
      status: (v.gst_verification_status || 'pending') as ValidationResult['status'],
      message: v.gst_verification_status === 'passed' ? 'GST verified' : 'GST verification pending',
      timestamp: ts,
    },
    {
      type: 'pan',
      status: (v.pan_verification_status || 'pending') as ValidationResult['status'],
      message: v.pan_verification_status === 'passed' ? 'PAN verified' : 'PAN verification pending',
      timestamp: ts,
    },
    {
      type: 'bank',
      status: (v.bank_verification_status || 'pending') as ValidationResult['status'],
      message: v.bank_verification_status === 'passed' ? 'Bank account verified' : 'Bank verification pending',
      timestamp: ts,
    },
    {
      type: 'msme',
      status: (v.msme_verification_status || 'skipped') as ValidationResult['status'],
      message:
        v.msme_verification_status === 'passed'
          ? 'MSME verified'
          : v.msme_verification_status === 'skipped'
          ? 'MSME not provided'
          : 'MSME verification pending',
      timestamp: ts,
    },
    {
      type: 'name_match',
      status: (v.name_match_verification_status || 'pending') as ValidationResult['status'],
      message: v.name_match_verification_status === 'passed' ? 'Name match verified' : 'Name match pending',
      timestamp: ts,
    },
  ];
};

export function VendorReviewDialog({
  vendorId,
  open,
  onOpenChange,
  footerExtra,
  description = 'Review vendor details before syncing to SAP',
}: VendorReviewDialogProps) {
  const [vendor, setVendor] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!open || !vendorId) {
      setVendor(null);
      return;
    }
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', vendorId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error('Failed to load vendor', error);
        setVendor(null);
      } else {
        setVendor(data);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [vendorId, open]);

  const validations = getValidationsFromVendor(vendor);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {vendor?.legal_name || 'Vendor Details'}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : vendor ? (
          <Tabs defaultValue="details" className="w-full flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-3 rounded-xl bg-muted p-1">
              <TabsTrigger value="details" className="rounded-lg">All Details</TabsTrigger>
              <TabsTrigger value="documents" className="rounded-lg">
                <FolderOpen className="h-4 w-4 mr-2" />Documents
              </TabsTrigger>
              <TabsTrigger value="validations" className="rounded-lg">Validations</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-4 flex-1 overflow-hidden">
              <ScrollArea className="h-[50vh] pr-4">
                <div className="space-y-6">
                  {/* Organization */}
                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2 text-primary">
                      <Building2 className="h-4 w-4" />
                      Organization Details
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-1"><p className="text-muted-foreground">Legal Name</p><p className="font-medium">{vendor.legal_name || '-'}</p></div>
                      <div className="space-y-1"><p className="text-muted-foreground">Trade Name</p><p className="font-medium">{vendor.trade_name || '-'}</p></div>
                      <div className="space-y-1"><p className="text-muted-foreground">Industry Type</p><p className="font-medium">{vendor.industry_type || '-'}</p></div>
                      <div className="space-y-1"><p className="text-muted-foreground">Organization Type</p><p className="font-medium">{vendor.organization_type || '-'}</p></div>
                      <div className="space-y-1"><p className="text-muted-foreground">Ownership Type</p><p className="font-medium">{vendor.ownership_type || '-'}</p></div>
                      <div className="space-y-1"><p className="text-muted-foreground">Entity Type</p><p className="font-medium">{vendor.entity_type || '-'}</p></div>
                    </div>
                  </div>

                  <Separator />

                  {/* Address */}
                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2 text-primary">
                      <MapPin className="h-4 w-4" />
                      Address Details
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-1">
                        <p className="text-muted-foreground">Registered Address</p>
                        <p className="font-medium">{vendor.registered_address || '-'}</p>
                        <p className="text-muted-foreground text-xs">{vendor.registered_city}, {vendor.registered_state} - {vendor.registered_pincode}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-muted-foreground">Communication Address</p>
                        <p className="font-medium">{vendor.communication_address || vendor.registered_address || '-'}</p>
                        <p className="text-muted-foreground text-xs">{vendor.communication_city || vendor.registered_city}, {vendor.communication_state || vendor.registered_state}</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Contact */}
                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2 text-primary">
                      <User className="h-4 w-4" />
                      Contact Details
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-1">
                        <p className="text-muted-foreground">Primary Contact</p>
                        <p className="font-medium">{vendor.primary_contact_name || '-'}</p>
                        <p className="text-xs text-muted-foreground">{vendor.primary_designation}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-muted-foreground">Contact Info</p>
                        <p className="font-medium flex items-center gap-1"><Phone className="h-3 w-3" /> {vendor.primary_phone || '-'}</p>
                        <p className="font-medium flex items-center gap-1"><Mail className="h-3 w-3" /> {vendor.primary_email || '-'}</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Statutory */}
                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2 text-primary">
                      <FileText className="h-4 w-4" />
                      Statutory Details
                    </h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="space-y-1"><p className="text-muted-foreground">GSTIN</p><p className="font-mono font-medium">{vendor.gstin || '-'}</p></div>
                      <div className="space-y-1"><p className="text-muted-foreground">PAN</p><p className="font-mono font-medium">{vendor.pan || '-'}</p></div>
                      <div className="space-y-1"><p className="text-muted-foreground">MSME Number</p><p className="font-mono font-medium">{vendor.msme_number || '-'}</p></div>
                      <div className="space-y-1"><p className="text-muted-foreground">MSME Category</p><p className="font-medium capitalize">{vendor.msme_category || '-'}</p></div>
                      <div className="space-y-1"><p className="text-muted-foreground">Firm Registration No</p><p className="font-medium">{vendor.firm_registration_no || '-'}</p></div>
                      <div className="space-y-1"><p className="text-muted-foreground">IEC No</p><p className="font-medium">{vendor.iec_no || '-'}</p></div>
                    </div>
                  </div>

                  <Separator />

                  {/* Bank */}
                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2 text-primary">
                      <Landmark className="h-4 w-4" />
                      Bank Details
                    </h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="space-y-1"><p className="text-muted-foreground">Bank Name</p><p className="font-medium">{vendor.bank_name || '-'}</p></div>
                      <div className="space-y-1"><p className="text-muted-foreground">Branch</p><p className="font-medium">{vendor.bank_branch_name || vendor.branch_name || '-'}</p></div>
                      <div className="space-y-1"><p className="text-muted-foreground">Account Type</p><p className="font-medium capitalize">{vendor.account_type || '-'}</p></div>
                      <div className="space-y-1"><p className="text-muted-foreground">Account Number</p><p className="font-mono font-medium">{vendor.account_number || '-'}</p></div>
                      <div className="space-y-1"><p className="text-muted-foreground">IFSC Code</p><p className="font-mono font-medium">{vendor.ifsc_code || '-'}</p></div>
                      <div className="space-y-1"><p className="text-muted-foreground">MICR Code</p><p className="font-mono font-medium">{vendor.micr_code || '-'}</p></div>
                    </div>
                  </div>

                  <Separator />

                  {/* Financial */}
                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2 text-primary">
                      <CreditCard className="h-4 w-4" />
                      Financial Details
                    </h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="space-y-1"><p className="text-muted-foreground">Turnover Year 1</p><p className="font-medium">₹ {vendor.turnover_year1?.toLocaleString('en-IN') || '-'}</p></div>
                      <div className="space-y-1"><p className="text-muted-foreground">Turnover Year 2</p><p className="font-medium">₹ {vendor.turnover_year2?.toLocaleString('en-IN') || '-'}</p></div>
                      <div className="space-y-1"><p className="text-muted-foreground">Turnover Year 3</p><p className="font-medium">₹ {vendor.turnover_year3?.toLocaleString('en-IN') || '-'}</p></div>
                      <div className="space-y-1"><p className="text-muted-foreground">Credit Period Expected</p><p className="font-medium">{vendor.credit_period_expected ? `${vendor.credit_period_expected} days` : '-'}</p></div>
                    </div>
                  </div>

                  <Separator />

                  {/* Approval Timeline */}
                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2 text-primary">
                      <Calendar className="h-4 w-4" />
                      Approval Timeline
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-1"><p className="text-muted-foreground">Finance Reviewed At</p><p className="font-medium">{vendor.finance_reviewed_at ? new Date(vendor.finance_reviewed_at).toLocaleString('en-IN') : '-'}</p></div>
                      <div className="space-y-1"><p className="text-muted-foreground">Purchase Reviewed At</p><p className="font-medium">{vendor.purchase_reviewed_at ? new Date(vendor.purchase_reviewed_at).toLocaleString('en-IN') : '-'}</p></div>
                    </div>
                  </div>

                  {(vendor.finance_comments || vendor.purchase_comments) && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <h4 className="font-semibold flex items-center gap-2 text-primary">
                          <MessageSquare className="h-4 w-4" />
                          Review Comments
                        </h4>
                        <div className="grid grid-cols-1 gap-4 text-sm">
                          {vendor.finance_comments && (
                            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">💰 Finance Team</span>
                                {vendor.finance_reviewed_at && (
                                  <span className="text-xs text-muted-foreground">{new Date(vendor.finance_reviewed_at).toLocaleDateString('en-IN')}</span>
                                )}
                              </div>
                              <p className="text-amber-900 dark:text-amber-100">{vendor.finance_comments}</p>
                            </div>
                          )}
                          {vendor.purchase_comments && (
                            <div className="bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800 rounded-xl p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-semibold text-teal-700 dark:text-teal-400">🛒 Purchase Team</span>
                                {vendor.purchase_reviewed_at && (
                                  <span className="text-xs text-muted-foreground">{new Date(vendor.purchase_reviewed_at).toLocaleDateString('en-IN')}</span>
                                )}
                              </div>
                              <p className="text-teal-900 dark:text-teal-100">{vendor.purchase_comments}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="documents" className="mt-4 flex-1 overflow-auto">
              <VendorDocuments vendorId={vendor.id} />
            </TabsContent>

            <TabsContent value="validations" className="mt-4 flex-1 overflow-auto">
              <ValidationStatus validations={validations} />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-sm text-muted-foreground py-8 text-center">Vendor not found.</div>
        )}

        <DialogFooter className="gap-2 mt-4 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Close
          </Button>
          {footerExtra}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
