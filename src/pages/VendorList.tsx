import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { mockVendors } from '@/data/mockVendors';
import { VendorStatus } from '@/types/vendor';
import { Search, Download, Eye, Filter, Building2 } from 'lucide-react';

export default function VendorList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredVendors = mockVendors.filter((vendor) => {
    const matchesSearch =
      vendor.formData.organization.legalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.formData.statutory.gstin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || vendor.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

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
    const { label, variant } = config[status];
    return <Badge variant={variant}>{label}</Badge>;
  };

  const handleExport = () => {
    // Mock export functionality
    const csvData = filteredVendors.map((v) => ({
      ID: v.id,
      Name: v.formData.organization.legalName,
      GSTIN: v.formData.statutory.gstin,
      PAN: v.formData.statutory.pan,
      City: v.formData.organization.registeredCity,
      State: v.formData.organization.registeredState,
      Status: v.status,
      SAP_Code: v.sapVendorCode || '-',
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
        <Button onClick={handleExport} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, GSTIN, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="finance_review">Finance Review</SelectItem>
                <SelectItem value="purchase_review">Purchase Review</SelectItem>
                <SelectItem value="validation_failed">Validation Failed</SelectItem>
                <SelectItem value="sap_synced">SAP Synced</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>SAP Code</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVendors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No vendors found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVendors.map((vendor) => (
                    <TableRow key={vendor.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded bg-muted flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{vendor.formData.organization.legalName}</p>
                            <p className="text-xs text-muted-foreground">{vendor.id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {vendor.formData.statutory.gstin}
                      </TableCell>
                      <TableCell>
                        {vendor.formData.organization.registeredCity}, {vendor.formData.organization.registeredState}
                      </TableCell>
                      <TableCell className="text-sm">
                        {vendor.formData.organization.industryType}
                      </TableCell>
                      <TableCell>{getStatusBadge(vendor.status)}</TableCell>
                      <TableCell className="font-mono">
                        {vendor.sapVendorCode || '-'}
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
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {filteredVendors.length} of {mockVendors.length} vendors
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
