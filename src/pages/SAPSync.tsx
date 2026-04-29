import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { useVendors, useSAPSync, useBuyerCompanies, VendorRow } from '@/hooks/useVendors';
import { ValidationResult } from '@/types/vendor';
import {
  Search,
  Eye,
  CheckCircle,
  Building2,
  User,
  Loader2,
  RefreshCw,
  FolderOpen,
  Upload,
  Server,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  FileText,
  Landmark,
  Globe,
  Calendar,
  Hash,
  MessageSquare,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

export default function SAPSync() {
  const [searchTerm, setSearchTerm] = useState('');
  const [buyerCompanyFilter, setBuyerCompanyFilter] = useState<string>('all');
  const [selectedVendor, setSelectedVendor] = useState<VendorRow | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [sapSyncResult, setSapSyncResult] = useState<any>(null);
  const [showSapResultDialog, setShowSapResultDialog] = useState(false);
  const [syncingVendorId, setSyncingVendorId] = useState<string | null>(null);

  const { data: approvedVendors, isLoading, refetch } = useVendors(['purchase_approved']);
  const { data: buyerCompanies } = useBuyerCompanies();
  const sapSync = useSAPSync();

  const filteredVendors = approvedVendors?.filter((vendor) => {
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

  const handleSyncToSAP = async (vendorToSync?: VendorRow) => {
    const vendor = vendorToSync || selectedVendor;
    if (!vendor) return;

    setSyncingVendorId(vendor.id);
    try {
      const result = await sapSync.mutateAsync({ vendorId: vendor.id });
      setSapSyncResult(result.sapResponse);
      setSelectedVendor(vendor);
      setShowSapResultDialog(true);
    } catch (error: any) {
      console.error('SAP sync failed:', error);
      // Still surface SAP's response (error messages from S/4HANA) in the dialog
      const fallbackResponse = error?.sapResponse ?? [
        { MSGTYP: 'E', MSG: error?.message || 'SAP sync failed', BP_LIFNR: '', BPNAME: vendor.legal_name || '' },
      ];
      setSapSyncResult({
        success: false,
        message: error?.message || 'SAP sync failed',
        sapResponse: fallbackResponse,
      });
      setSelectedVendor(vendor);
      setShowSapResultDialog(true);
    } finally {
      setSyncingVendorId(null);
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
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Server className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">SAP Sync</h1>
          </div>
          <p className="text-muted-foreground">Sync approved vendors to SAP system</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => refetch()} variant="outline" size="icon" className="rounded-xl">
            <RefreshCw className="h-4 w-4" />
          </Button>
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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ready for Sync</p>
                <p className="text-3xl font-bold text-blue-600">{filteredVendors.length}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-blue-500 flex items-center justify-center">
                <Upload className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <Card key={i} className="border-0 shadow-md"><CardContent className="p-6"><div className="flex items-start gap-4"><Skeleton className="h-14 w-14 rounded-xl" /><div className="flex-1 space-y-3"><Skeleton className="h-5 w-56" /><Skeleton className="h-4 w-40" /></div></div></CardContent></Card>
          ))
        ) : filteredVendors.length === 0 ? (
          <Card className="border-0 shadow-md"><CardContent className="py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center mx-auto mb-4 shadow-lg"><CheckCircle className="h-8 w-8 text-white" /></div>
            <h3 className="text-xl font-semibold">No vendors pending SAP sync</h3>
            <p className="text-muted-foreground mt-2">All approved vendors have been synced to SAP.</p>
          </CardContent></Card>
        ) : (
          filteredVendors.map((vendor) => (
            <Card key={vendor.id} className="border-0 shadow-md card-interactive">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/5 flex items-center justify-center"><Building2 className="h-7 w-7 text-blue-600" /></div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-bold text-lg">{vendor.legal_name || 'Unnamed Vendor'}</h3>
                        <Badge className="bg-green-100 text-green-700 border-green-200">Purchase Approved</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{getBuyerCompanyName(vendor.tenant_id)} • {vendor.industry_type}</p>
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="font-mono bg-muted px-2 py-0.5 rounded">ID: {vendor.id.slice(0, 8)}...</span>
                        <span>GSTIN: {vendor.gstin || 'N/A'}</span>
                        <span>Approved: {vendor.purchase_reviewed_at ? new Date(vendor.purchase_reviewed_at).toLocaleDateString('en-IN') : '-'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" className="rounded-xl" onClick={() => { setSelectedVendor(vendor); setShowDetails(true); }}>
                      <Eye className="h-4 w-4 mr-2" />View
                    </Button>
                    <Button
                      className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-lg shadow-blue-500/20"
                      onClick={() => handleSyncToSAP(vendor)}
                      disabled={syncingVendorId === vendor.id}
                    >
                      {syncingVendorId === vendor.id ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Syncing...</>
                      ) : (
                        <><Server className="h-4 w-4 mr-2" />Sync</>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Vendor Details Dialog with Sync Button */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {selectedVendor?.legal_name}
            </DialogTitle>
            <DialogDescription>
              Review vendor details before syncing to SAP
            </DialogDescription>
          </DialogHeader>

          {selectedVendor && (
            <Tabs defaultValue="details" className="w-full flex-1 overflow-hidden flex flex-col">
              <TabsList className="grid w-full grid-cols-3 rounded-xl bg-muted p-1">
                <TabsTrigger value="details" className="rounded-lg">All Details</TabsTrigger>
                <TabsTrigger value="documents" className="rounded-lg"><FolderOpen className="h-4 w-4 mr-2" />Documents</TabsTrigger>
                <TabsTrigger value="validations" className="rounded-lg">Validations</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="mt-4 flex-1 overflow-hidden">
                <ScrollArea className="h-[50vh] pr-4">
                  <div className="space-y-6">
                    {/* Organization Details */}
                    <div className="space-y-3">
                      <h4 className="font-semibold flex items-center gap-2 text-primary">
                        <Building2 className="h-4 w-4" />
                        Organization Details
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Legal Name</p>
                          <p className="font-medium">{selectedVendor.legal_name || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Trade Name</p>
                          <p className="font-medium">{selectedVendor.trade_name || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Industry Type</p>
                          <p className="font-medium">{selectedVendor.industry_type || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Organization Type</p>
                          <p className="font-medium">{(selectedVendor as any).organization_type || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Ownership Type</p>
                          <p className="font-medium">{(selectedVendor as any).ownership_type || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Entity Type</p>
                          <p className="font-medium">{selectedVendor.entity_type || '-'}</p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Address Details */}
                    <div className="space-y-3">
                      <h4 className="font-semibold flex items-center gap-2 text-primary">
                        <MapPin className="h-4 w-4" />
                        Address Details
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Registered Address</p>
                          <p className="font-medium">{selectedVendor.registered_address || '-'}</p>
                          <p className="text-muted-foreground text-xs">{selectedVendor.registered_city}, {selectedVendor.registered_state} - {selectedVendor.registered_pincode}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Communication Address</p>
                          <p className="font-medium">{selectedVendor.communication_address || selectedVendor.registered_address || '-'}</p>
                          <p className="text-muted-foreground text-xs">{selectedVendor.communication_city || selectedVendor.registered_city}, {selectedVendor.communication_state || selectedVendor.registered_state}</p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Contact Details */}
                    <div className="space-y-3">
                      <h4 className="font-semibold flex items-center gap-2 text-primary">
                        <User className="h-4 w-4" />
                        Contact Details
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Primary Contact</p>
                          <p className="font-medium">{selectedVendor.primary_contact_name || '-'}</p>
                          <p className="text-xs text-muted-foreground">{selectedVendor.primary_designation}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Contact Info</p>
                          <p className="font-medium flex items-center gap-1"><Phone className="h-3 w-3" /> {selectedVendor.primary_phone || '-'}</p>
                          <p className="font-medium flex items-center gap-1"><Mail className="h-3 w-3" /> {selectedVendor.primary_email || '-'}</p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Statutory Details */}
                    <div className="space-y-3">
                      <h4 className="font-semibold flex items-center gap-2 text-primary">
                        <FileText className="h-4 w-4" />
                        Statutory Details
                      </h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="space-y-1">
                          <p className="text-muted-foreground">GSTIN</p>
                          <p className="font-mono font-medium">{selectedVendor.gstin || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">PAN</p>
                          <p className="font-mono font-medium">{selectedVendor.pan || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">MSME Number</p>
                          <p className="font-mono font-medium">{selectedVendor.msme_number || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">MSME Category</p>
                          <p className="font-medium capitalize">{selectedVendor.msme_category || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Firm Registration No</p>
                          <p className="font-medium">{(selectedVendor as any).firm_registration_no || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">IEC No</p>
                          <p className="font-medium">{(selectedVendor as any).iec_no || '-'}</p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Bank Details */}
                    <div className="space-y-3">
                      <h4 className="font-semibold flex items-center gap-2 text-primary">
                        <Landmark className="h-4 w-4" />
                        Bank Details
                      </h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Bank Name</p>
                          <p className="font-medium">{selectedVendor.bank_name || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Branch</p>
                          <p className="font-medium">{(selectedVendor as any).bank_branch_name || selectedVendor.branch_name || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Account Type</p>
                          <p className="font-medium capitalize">{selectedVendor.account_type || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Account Number</p>
                          <p className="font-mono font-medium">{selectedVendor.account_number || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">IFSC Code</p>
                          <p className="font-mono font-medium">{selectedVendor.ifsc_code || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">MICR Code</p>
                          <p className="font-mono font-medium">{(selectedVendor as any).micr_code || '-'}</p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Financial Details */}
                    <div className="space-y-3">
                      <h4 className="font-semibold flex items-center gap-2 text-primary">
                        <CreditCard className="h-4 w-4" />
                        Financial Details
                      </h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Turnover Year 1</p>
                          <p className="font-medium">₹ {selectedVendor.turnover_year1?.toLocaleString('en-IN') || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Turnover Year 2</p>
                          <p className="font-medium">₹ {selectedVendor.turnover_year2?.toLocaleString('en-IN') || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Turnover Year 3</p>
                          <p className="font-medium">₹ {selectedVendor.turnover_year3?.toLocaleString('en-IN') || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Credit Period Expected</p>
                          <p className="font-medium">{selectedVendor.credit_period_expected ? `${selectedVendor.credit_period_expected} days` : '-'}</p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Approval Info */}
                    <div className="space-y-3">
                      <h4 className="font-semibold flex items-center gap-2 text-primary">
                        <Calendar className="h-4 w-4" />
                        Approval Timeline
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Finance Reviewed At</p>
                          <p className="font-medium">{selectedVendor.finance_reviewed_at ? new Date(selectedVendor.finance_reviewed_at).toLocaleString('en-IN') : '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Purchase Reviewed At</p>
                          <p className="font-medium">{selectedVendor.purchase_reviewed_at ? new Date(selectedVendor.purchase_reviewed_at).toLocaleString('en-IN') : '-'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Review Comments */}
                    {(selectedVendor.finance_comments || selectedVendor.purchase_comments) && (
                      <>
                        <Separator />
                        <div className="space-y-3">
                          <h4 className="font-semibold flex items-center gap-2 text-primary">
                            <MessageSquare className="h-4 w-4" />
                            Review Comments
                          </h4>
                          <div className="grid grid-cols-1 gap-4 text-sm">
                            {selectedVendor.finance_comments && (
                              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">💰 Finance Team</span>
                                  {selectedVendor.finance_reviewed_at && (
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(selectedVendor.finance_reviewed_at).toLocaleDateString('en-IN')}
                                    </span>
                                  )}
                                </div>
                                <p className="text-amber-900 dark:text-amber-100">{selectedVendor.finance_comments}</p>
                              </div>
                            )}
                            {selectedVendor.purchase_comments && (
                              <div className="bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xs font-semibold text-teal-700 dark:text-teal-400">🛒 Purchase Team</span>
                                  {selectedVendor.purchase_reviewed_at && (
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(selectedVendor.purchase_reviewed_at).toLocaleDateString('en-IN')}
                                    </span>
                                  )}
                                </div>
                                <p className="text-teal-900 dark:text-teal-100">{selectedVendor.purchase_comments}</p>
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
                <VendorDocuments vendorId={selectedVendor.id} />
              </TabsContent>

              <TabsContent value="validations" className="mt-4 flex-1 overflow-auto">
                <ValidationStatus validations={mappedValidations} />
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter className="gap-2 mt-4 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowDetails(false)} className="rounded-xl">
              Close
            </Button>
            <Button
              className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-lg shadow-blue-500/20"
              onClick={() => handleSyncToSAP()}
              disabled={sapSync.isPending}
            >
              {sapSync.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Syncing...</>
              ) : (
                <><Server className="h-4 w-4 mr-2" />Sync to SAP</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SAP Sync Result Dialog */}
      <Dialog open={showSapResultDialog} onOpenChange={(open) => {
        setShowSapResultDialog(open);
        if (!open) {
          setShowDetails(false);
          setSelectedVendor(null);
          setSapSyncResult(null);
        }
      }}>
        <DialogContent className="rounded-2xl max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {sapSyncResult?.success === false ? (
                <>
                  <Server className="h-6 w-6 text-red-600" />
                  SAP Sync Failed
                </>
              ) : (
                <>
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  SAP Sync Successful
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {sapSyncResult?.success === false
                ? 'SAP rejected the request. Review the response details below.'
                : 'Vendor has been successfully synced to SAP'}
            </DialogDescription>
          </DialogHeader>
          {sapSyncResult && (
            <div className="space-y-4 py-4">
              <div className={`border rounded-xl p-4 ${
                sapSyncResult.success === false
                  ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                  : 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {sapSyncResult.success === false ? (
                    <Server className="h-5 w-5 text-red-600" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                  <span className={`font-semibold ${
                    sapSyncResult.success === false
                      ? 'text-red-900 dark:text-red-100'
                      : 'text-green-900 dark:text-green-100'
                  }`}>
                    {sapSyncResult.message}
                  </span>
                </div>
                {sapSyncResult.sapVendorCode && (
                  <div className="text-sm text-green-800 dark:text-green-200">
                    <p className="font-mono bg-white dark:bg-green-950/40 px-3 py-2 rounded-lg mt-2">
                      SAP Vendor Code: <span className="font-bold">{sapSyncResult.sapVendorCode}</span>
                    </p>
                  </div>
                )}
              </div>

              {sapSyncResult.sapResponse && sapSyncResult.sapResponse.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">SAP Response Details:</h4>
                  {sapSyncResult.sapResponse.map((response: any, index: number) => (
                    <div key={index} className="bg-muted rounded-lg p-3 text-sm space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{response.MSG}</span>
                        <Badge variant={response.MSGTYP === 'S' ? 'default' : 'destructive'}>
                          {response.MSGTYP === 'S' ? 'Success' : 'Error'}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {response.BP_LIFNR && <p>BP / Vendor No: <span className="font-mono">{response.BP_LIFNR}</span></p>}
                        {response.BPNAME && <p>Business Partner: {response.BPNAME}</p>}
                        {(response.ERDAT || response.UZEIT) && <p>Date: {response.ERDAT} at {response.UZEIT}</p>}
                        {response.UNAME && <p>Created by: {response.UNAME}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() => {
                setShowSapResultDialog(false);
                setShowDetails(false);
                setSelectedVendor(null);
                setSapSyncResult(null);
              }}
              className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
