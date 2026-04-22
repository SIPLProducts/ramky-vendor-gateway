import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useVendors, VendorRow } from '@/hooks/useVendors';
import { useTenantContext } from '@/hooks/useTenantContext';
import { VendorDocuments } from '@/components/vendor/VendorDocuments';
import { ValidationStatus } from '@/components/vendor/ValidationStatus';
import { ValidationResult } from '@/types/vendor';
import { supabase } from '@/integrations/supabase/client';
import {
  Search,
  Download,
  Eye,
  Filter,
  Building2,
  RefreshCw,
  MapPin,
  Phone,
  Mail,
  FileText,
  Landmark,
  CreditCard,
  Calendar,
  User,
  FolderOpen,
  MessageSquare,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

type VendorStatus =
  | 'draft'
  | 'submitted'
  | 'validation_pending'
  | 'validation_failed'
  | 'finance_review'
  | 'finance_approved'
  | 'finance_rejected'
  | 'purchase_review'
  | 'purchase_approved'
  | 'purchase_rejected'
  | 'sap_synced';

export default function VendorList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [buyerCompanyFilter, setBuyerCompanyFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedVendor, setSelectedVendor] = useState<VendorRow | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Fetch all vendors from database
  const { data: vendors, isLoading, refetch } = useVendors();
  const { activeTenantId, myTenants, setActiveTenantId, isSuperAdmin } = useTenantContext();
  const activeTenantName = activeTenantId
    ? myTenants.find((t) => t.id === activeTenantId)?.name ?? 'selected tenant'
    : null;

  // Fetch buyer companies (tenants) for filter
  const { data: buyerCompanies } = useQuery({
    queryKey: ['buyer-companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data;
    },
  });

  const filteredVendors = vendors?.filter((vendor) => {
    const matchesSearch =
      (vendor.legal_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (vendor.gstin || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || vendor.status === statusFilter;
    const matchesBuyerCompany = buyerCompanyFilter === 'all' || vendor.tenant_id === buyerCompanyFilter;

    return matchesSearch && matchesStatus && matchesBuyerCompany;
  }) || [];

  // Pagination
  const totalItems = filteredVendors.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const paginatedVendors = filteredVendors.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleBuyerCompanyFilterChange = (value: string) => {
    setBuyerCompanyFilter(value);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const getBuyerCompanyName = (tenantId: string | null) => {
    if (!tenantId || !buyerCompanies) return '-';
    const company = buyerCompanies.find(c => c.id === tenantId);
    return company ? `${company.name} (${company.code})` : '-';
  };

  const getStatusBadge = (status: VendorStatus) => {
    const config: Record<VendorStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      draft: { label: 'Draft', variant: 'secondary' },
      submitted: { label: 'Submitted', variant: 'secondary' },
      validation_pending: { label: 'Validating', variant: 'outline' },
      validation_failed: { label: 'Validation Failed', variant: 'destructive' },
      finance_review: { label: 'Finance Review', variant: 'outline' },
      finance_approved: { label: 'Finance Approved', variant: 'default' },
      finance_rejected: { label: 'Finance Rejected', variant: 'destructive' },
      purchase_review: { label: 'Purchase Review', variant: 'outline' },
      purchase_approved: { label: 'Purchase Approved', variant: 'default' },
      purchase_rejected: { label: 'Purchase Rejected', variant: 'destructive' },
      sap_synced: { label: 'SAP Synced', variant: 'default' },
    };
    const { label, variant } = config[status] || { label: status, variant: 'secondary' };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const handleExport = () => {
    const csvData = filteredVendors.map((v) => ({
      ID: v.id,
      Name: v.legal_name,
      GSTIN: v.gstin,
      PAN: v.pan,
      City: v.registered_city,
      State: v.registered_state,
      Status: v.status,
      SAP_Code: v.sap_vendor_code || '-',
    }));

    console.log('Exporting:', csvData);
    alert('Export functionality - CSV data logged to console');
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">All Vendors</h1>
          <p className="text-muted-foreground">Complete list of registered vendors</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => refetch()} variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={handleExport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, GSTIN, or ID..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={handleFilterChange}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="validation_pending">Validation Pending</SelectItem>
                <SelectItem value="validation_failed">Validation Failed</SelectItem>
                <SelectItem value="finance_review">Finance Review</SelectItem>
                <SelectItem value="finance_approved">Finance Approved</SelectItem>
                <SelectItem value="finance_rejected">Finance Rejected</SelectItem>
                <SelectItem value="purchase_review">Purchase Review</SelectItem>
                <SelectItem value="purchase_approved">Purchase Approved</SelectItem>
                <SelectItem value="purchase_rejected">Purchase Rejected</SelectItem>
                <SelectItem value="sap_synced">SAP Synced</SelectItem>
              </SelectContent>
            </Select>
            <Select value={buyerCompanyFilter} onValueChange={handleBuyerCompanyFilterChange}>
              <SelectTrigger className="w-56">
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
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                  <Skeleton className="h-9 w-9 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Buyer Company</TableHead>
                      <TableHead>GSTIN</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>SAP Code</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedVendors.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          {activeTenantName ? (
                            <div className="space-y-2">
                              <p className="font-medium">No vendors found for {activeTenantName}</p>
                              <p className="text-sm">Try switching the tenant from the header above{isSuperAdmin ? ' or view All Tenants' : ''}.</p>
                              {isSuperAdmin && (
                                <Button variant="link" size="sm" onClick={() => setActiveTenantId(null)}>
                                  View All Tenants
                                </Button>
                              )}
                            </div>
                          ) : (
                            'No vendors found matching your criteria'
                          )}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedVendors.map((vendor) => (
                        <TableRow key={vendor.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded bg-muted flex items-center justify-center">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="font-medium">{vendor.legal_name || 'Unnamed Vendor'}</p>
                                <p className="text-xs text-muted-foreground">{vendor.id.slice(0, 8)}...</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{getBuyerCompanyName(vendor.tenant_id)}</span>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {vendor.gstin || '-'}
                          </TableCell>
                          <TableCell>
                            {vendor.registered_city && vendor.registered_state
                              ? `${vendor.registered_city}, ${vendor.registered_state}`
                              : '-'}
                          </TableCell>
                          <TableCell>{getStatusBadge(vendor.status as VendorStatus)}</TableCell>
                          <TableCell className="font-mono">
                            {vendor.sap_vendor_code || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedVendor(vendor);
                                setShowDetails(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <DataTablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={totalItems}
                onPageChange={setCurrentPage}
                onPageSizeChange={handlePageSizeChange}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Vendor Details Dialog - View Only */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {selectedVendor?.legal_name}
              <span className="ml-2">{selectedVendor && getStatusBadge(selectedVendor.status as VendorStatus)}</span>
            </DialogTitle>
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
                      </div>
                    </div>

                    <Separator />

                    {/* Review Comments */}
                    {(selectedVendor.finance_comments || selectedVendor.purchase_comments) && (
                      <>
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
                        <Separator />
                      </>
                    )}

                    {/* SAP Info */}
                    {selectedVendor.sap_vendor_code && (
                      <div className="space-y-3">
                        <h4 className="font-semibold flex items-center gap-2 text-primary">
                          <Calendar className="h-4 w-4" />
                          SAP Information
                        </h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="space-y-1">
                            <p className="text-muted-foreground">SAP Vendor Code</p>
                            <p className="font-mono font-medium text-green-600">{selectedVendor.sap_vendor_code}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-muted-foreground">Synced At</p>
                            <p className="font-medium">{selectedVendor.sap_synced_at ? new Date(selectedVendor.sap_synced_at).toLocaleString('en-IN') : '-'}</p>
                          </div>
                        </div>
                      </div>
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
