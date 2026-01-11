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
import { useVendors } from '@/hooks/useVendors';
import { supabase } from '@/integrations/supabase/client';
import { Search, Download, Eye, Filter, Building2, RefreshCw } from 'lucide-react';
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

  // Fetch all vendors from database
  const { data: vendors, isLoading, refetch } = useVendors();

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
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No vendors found matching your criteria
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
                            <Button variant="ghost" size="sm">
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
    </div>
  );
}
