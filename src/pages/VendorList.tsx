import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
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
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { getSapName1, pickVendorDisplayName } from '@/lib/sapPayloadBuilder';
import { formatVendorName } from '@/lib/textCase';

import { ApprovalCommentsDialog } from '@/components/sap/ApprovalCommentsDialog';
import { VendorReviewDialog } from '@/components/vendor/VendorReviewDialog';

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
  Tags,
  Loader2,
} from 'lucide-react';
import { formatIndianFy, getLastThreeCompletedIndianFyStartYears } from '@/lib/indianFy';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { TenantCombobox } from '@/components/admin/TenantCombobox';
import { formatPanStatus, formatAadhaarLinked } from '@/lib/panComprehensive';

type VendorStatus =
  | 'draft'
  | 'submitted'
  | 'validation_pending'
  | 'validation_failed'
  | 'buyer_review'
  | 'scm_manager_review'
  | 'scm_manager_rejected'
  | 'scm_head_review'
  | 'scm_head_rejected'
  | 'finance_1_review'
  | 'finance_1_rejected'
  | 'finance_2_review'
  | 'finance_2_rejected'
  | 'ceo_office_review'
  | 'ceo_office_rejected'
  | 'pending_sap_sync'
  | 'sap_synced'
  | 'returned_to_buyer'
  | 'returned_to_vendor'
  | 'sap_team_rejected'
  | 'sap_team_closed'
  // legacy values still in DB
  | 'finance_review'
  | 'finance_approved'
  | 'finance_rejected'
  | 'purchase_review'
  | 'purchase_approved'
  | 'purchase_rejected';

const STATUS_FILTER_GROUPS: Record<string, string[]> = {
  draft: ['draft'],
  buyer_review: ['submitted', 'validation_pending', 'validation_failed', 'buyer_review', 'returned_to_buyer'],
  scm_co: ['scm_manager_review', 'scm_manager_rejected'],
  scm_head: ['scm_head_review', 'scm_head_rejected'],
  finance_1: ['finance_1_review', 'finance_1_rejected'],
  finance_2: ['finance_2_review', 'finance_2_rejected'],
  ceo_office: ['ceo_office_review', 'ceo_office_rejected'],
  sap_team: ['pending_sap_sync'],
  sap_sync_pending: ['pending_sap_sync'],
  dms_pending: ['dms_sync_pending', 'sap_synced'],
  sap_synced: ['sap_synced', 'dms_synced'],
  duplicate_closed: ['sap_team_rejected', 'sap_team_closed'],
  returned_to_vendor: ['returned_to_vendor'],
};




export default function VendorList() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [trackRef, setTrackRef] = useState('');
  const [isTracking, setIsTracking] = useState(false);

  const handleTrackByReference = async () => {
    const ref = trackRef.trim();
    if (!ref) {
      toast({ title: 'Reference Number required', description: 'Please enter a Reference Number.', variant: 'destructive' });
      return;
    }
    setIsTracking(true);
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('id')
        .eq('reference_number', ref)
        .maybeSingle();
      if (error) throw error;
      const vendorId = data?.id ?? null;
      if (!vendorId) {
        toast({ title: 'Not found', description: 'No vendor found with this Reference Number, or you do not have access.', variant: 'destructive' });
        return;
      }
      navigate(`/vendor-status/${vendorId}`);
    } catch (e: any) {
      toast({ title: 'Search failed', description: e?.message ?? 'Unable to search at this time.', variant: 'destructive' });
    } finally {
      setIsTracking(false);
    }
  };


  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [buyerCompanyFilter, setBuyerCompanyFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedVendor, setSelectedVendor] = useState<VendorRow | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [returnTarget, setReturnTarget] = useState<VendorRow | null>(null);
  const [returnRemarks, setReturnRemarks] = useState('');
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  
  const [commentsVendor, setCommentsVendor] = useState<{ id: string; name: string; ref: string } | null>(null);


  // Fetch all vendors from database
  const { data: vendors, isLoading, refetch } = useVendors();
  const { activeTenantId, myTenants, setActiveTenantId, isSuperAdmin, isCrossTenantReviewer } = useTenantContext();
  const activeTenantName = activeTenantId
    ? myTenants.find((t) => t.id === activeTenantId)?.name ?? 'selected tenant'
    : null;

  // Fetch buyer companies (tenants) for filter — restrict to tenants the user
  // actually has access to. Super-admins and SAP Team can see all active tenants;
  // everyone else only sees their assigned tenants.
  const canSeeAllTenants = isSuperAdmin || isCrossTenantReviewer;
  const { data: buyerCompanies } = useQuery({
    queryKey: ['buyer-companies', canSeeAllTenants ? 'all' : 'scoped', myTenants.map((t) => t.id).join(',')],
    queryFn: async () => {
      if (!canSeeAllTenants) {
        return myTenants.map((t) => ({ id: t.id, name: t.name, code: t.code }));
      }
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
    const q = searchTerm.toLowerCase().trim();
    const bc = vendor.tenant_id && buyerCompanies ? buyerCompanies.find(c => c.id === vendor.tenant_id) : null;
    const buyerName = bc ? `${bc.name} ${bc.code}` : '';
    const location = [vendor.registered_city, vendor.registered_state].filter(Boolean).join(', ');
    const haystack = [
      pickVendorDisplayName(vendor) || '',
      vendor.legal_name || '',
      vendor.gstin || '',
      buyerName,
      vendor.invited_by?.name || '',
      location,
      vendor.sap_vendor_code || '',
    ].join(' ').toLowerCase();
    const matchesSearch = !q || haystack.includes(q);

    const group = STATUS_FILTER_GROUPS[statusFilter];
    const matchesStatus = statusFilter === 'all' || (group ? group.includes(vendor.status) : vendor.status === statusFilter);
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
      buyer_review: { label: 'Buyer Review', variant: 'outline' },
      scm_manager_review: { label: 'SCM CO', variant: 'outline' },
      scm_manager_rejected: { label: 'SCM CO', variant: 'destructive' },
      scm_head_review: { label: 'SCM Head Review', variant: 'outline' },
      scm_head_rejected: { label: 'SCM Head Rejected', variant: 'destructive' },
      finance_1_review: { label: 'Finance 1 Review', variant: 'outline' },
      finance_1_rejected: { label: 'Finance 1 Rejected', variant: 'destructive' },
      finance_2_review: { label: 'Finance 2 Review', variant: 'outline' },
      finance_2_rejected: { label: 'Finance 2 Rejected', variant: 'destructive' },
      ceo_office_review: { label: 'CEO Office Review', variant: 'outline' },
      ceo_office_rejected: { label: 'CEO Office Rejected', variant: 'destructive' },
      pending_sap_sync: { label: 'Pending SAP Sync', variant: 'default' },
      sap_synced: { label: 'SAP Synced', variant: 'default' },
      returned_to_buyer: { label: 'Returned to Buyer', variant: 'destructive' },
      returned_to_vendor: { label: 'Returned to Vendor', variant: 'destructive' },
      sap_team_rejected: { label: 'Duplicate & Closed', variant: 'destructive' },
      sap_team_closed: { label: 'Duplicate & Closed', variant: 'destructive' },

      // legacy
      finance_review: { label: 'Finance Review', variant: 'outline' },
      finance_approved: { label: 'Finance Approved', variant: 'default' },
      finance_rejected: { label: 'Finance Rejected', variant: 'destructive' },
      purchase_review: { label: 'Purchase Review', variant: 'outline' },
      purchase_approved: { label: 'Purchase Approved', variant: 'default' },
      purchase_rejected: { label: 'Purchase Rejected', variant: 'destructive' },
    };
    const { label, variant } = config[status] || { label: status, variant: 'secondary' };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const handleExport = () => {
    const rows = filteredVendors.map((v) => ({
      'Buyer Company': getBuyerCompanyName(v.tenant_id),
      'Invited By': v.invited_by?.name || '-',
      'Vendor': pickVendorDisplayName(v) || v.legal_name || '-',
      'Reference Number': (v as any).reference_number || '-',
      'GSTIN': v.gstin || '-',
      'PAN': v.pan || '-',
      'PAN Holder Name': (v as any).pan_holder_name || '-',
      'PAN Status': formatPanStatus((v as any).pan_status),
      'Is Aadhaar Linked': formatAadhaarLinked((v as any).pan_aadhaar_linked),
      'Location': [v.registered_city, v.registered_state].filter(Boolean).join(', ') || '-',
      'SAP Code': v.sap_vendor_code || '-',
      'Status': v.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vendors');
    XLSX.writeFile(wb, `vendors_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
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
        <div className="flex flex-wrap items-center gap-2">
          <form
            onSubmit={(e) => { e.preventDefault(); handleTrackByReference(); }}
            className="flex items-center gap-2"
          >
            <Input
              placeholder="Enter Reference Number"
              value={trackRef}
              onChange={(e) => setTrackRef(e.target.value)}
              className="h-9 w-56"
            />
            <Button type="submit" variant="outline" disabled={isTracking} className="gap-1">
              {isTracking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
          </form>
          <Button onClick={() => refetch()} variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={handleExport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search"
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={handleFilterChange}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="buyer_review">Buyer Review</SelectItem>
                <SelectItem value="scm_co">SCM CO</SelectItem>
                <SelectItem value="scm_head">SCM Head</SelectItem>
                <SelectItem value="finance_1">Finance 1</SelectItem>
                <SelectItem value="finance_2">Finance 2</SelectItem>
                <SelectItem value="ceo_office">CEO Office</SelectItem>
                <SelectItem value="sap_team">SAP Team</SelectItem>
                <SelectItem value="sap_sync_pending">SAP Sync Pending</SelectItem>
                <SelectItem value="dms_pending">DMS Pending</SelectItem>
                <SelectItem value="sap_synced">SAP Synced</SelectItem>
                <SelectItem value="duplicate_closed">Duplicate & Closed</SelectItem>
                <SelectItem value="returned_to_vendor">Returned to Vendor</SelectItem>
              </SelectContent>
            </Select>
            <TenantCombobox
              tenants={buyerCompanies ?? []}
              value={buyerCompanyFilter === 'all' ? null : buyerCompanyFilter}
              onChange={(id) => handleBuyerCompanyFilterChange(id ?? 'all')}
              allowAll
              allLabel="All Buyer Companies"
              placeholder="Filter by buyer"
              className="w-56"
            />
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
                      <TableHead>Buyer Company</TableHead>
                      <TableHead>Invited By</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>GSTIN</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>SAP Code</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>

                  </TableHeader>
                  <TableBody>
                    {paginatedVendors.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
                            <span className="text-sm">{getBuyerCompanyName(vendor.tenant_id)}</span>
                          </TableCell>
                          <TableCell>
                            {vendor.invited_by ? (
                              <div className="text-sm">
                                <div className="font-medium">{vendor.invited_by.name ?? '—'}</div>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded bg-muted flex items-center justify-center">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="font-medium">{formatVendorName(vendor) || 'Unnamed Vendor'}</p>
                                <p className="text-xs text-muted-foreground font-mono">Ref No: {(vendor as any).reference_number || `${vendor.id.slice(0, 8)}...`}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {vendor.gstin || '-'}
                          </TableCell>
                          <TableCell>
                            {vendor.registered_city && vendor.registered_state
                              ? `${vendor.registered_city}, ${vendor.registered_state}`
                              : '-'}
                          </TableCell>
                          <TableCell className="font-mono">
                            {vendor.sap_vendor_code || '-'}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(vendor.status as VendorStatus)}
                            {vendor.status === 'returned_to_buyer' && (vendor as any).last_rejection_comments && (
                              <div className="mt-1 text-xs text-amber-700 max-w-xs truncate" title={(vendor as any).last_rejection_comments}>
                                <strong>{(vendor as any).last_rejection_stage ?? 'Approver'}:</strong>{' '}
                                {(vendor as any).last_rejection_comments}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                title="View"
                                onClick={() => {
                                  setSelectedVendor(vendor);
                                  setShowDetails(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Comments"
                                onClick={() => setCommentsVendor({
                                  id: vendor.id,
                                  name: pickVendorDisplayName(vendor as any) || vendor.legal_name || '',
                                  ref: vendor.reference_number || '',
                                })}
                              >
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                            </div>
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

      {/* Vendor Details Dialog - reuses the approval screen's review dialog */}
      <VendorReviewDialog
        vendorId={showDetails ? selectedVendor?.id ?? null : null}
        open={showDetails}
        onOpenChange={(o) => {
          setShowDetails(o);
          if (!o) setSelectedVendor(null);
        }}
      />


      <Dialog open={!!returnTarget} onOpenChange={(o) => { if (!o) setReturnTarget(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Return application to vendor</DialogTitle>
          </DialogHeader>
          {returnTarget && (
            <div className="space-y-3 text-sm">
              <div>
                <div className="font-medium">{formatVendorName(returnTarget) || returnTarget.id}</div>
                <div className="text-xs text-muted-foreground">
                  Last rejected at: {(returnTarget as any).last_rejection_stage ?? '—'}
                </div>
              </div>
              {(returnTarget as any).last_rejection_comments && (
                <div className="rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                  <strong>Approver remarks:</strong>{'\n'}{(returnTarget as any).last_rejection_comments}
                </div>
              )}
              <div>
                <label className="text-xs text-muted-foreground">Additional buyer remarks (optional)</label>
                <Textarea
                  rows={4}
                  value={returnRemarks}
                  onChange={(e) => setReturnRemarks(e.target.value)}
                  placeholder="Tell the vendor what they need to fix"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnTarget(null)}>Cancel</Button>
            <Button
              disabled={returnSubmitting}
              onClick={async () => {
                if (!returnTarget) return;
                setReturnSubmitting(true);
                try {
                  const { error } = await supabase.functions.invoke('buyer-return-to-vendor', {
                    body: { vendor_id: returnTarget.id, comments: returnRemarks.trim() || null },
                  });
                  if (error) throw error;
                  toast({ title: 'Returned to vendor', description: 'The vendor has been notified.' });
                  setReturnTarget(null);
                  setReturnRemarks('');
                  await refetch();
                } catch (err: any) {
                  toast({ title: 'Failed to return', description: err.message, variant: 'destructive' });
                } finally {
                  setReturnSubmitting(false);
                }
              }}
            >
              {returnSubmitting ? 'Sending…' : 'Send to vendor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ApprovalCommentsDialog
        open={!!commentsVendor}
        onOpenChange={(o) => { if (!o) setCommentsVendor(null); }}
        vendorId={commentsVendor?.id ?? null}
        vendorName={commentsVendor?.name}
        referenceNumber={commentsVendor?.ref}
      />

    </div>
  );
}
