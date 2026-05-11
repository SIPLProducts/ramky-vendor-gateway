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
import { VendorReviewDialog } from '@/components/vendor/VendorReviewDialog';
import { VendorSubmissionPreviewDialog } from '@/components/vendor/VendorSubmissionPreviewDialog';
import { useVendors, useSAPSync, useBuyerCompanies, VendorRow } from '@/hooks/useVendors';
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

import { SapFieldsDialog, SapFieldOverrides } from '@/components/sap/SapFieldsDialog';

export default function SAPSync() {
  const [searchTerm, setSearchTerm] = useState('');
  const [buyerCompanyFilter, setBuyerCompanyFilter] = useState<string>('all');
  const [selectedVendor, setSelectedVendor] = useState<VendorRow | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [previewVendorId, setPreviewVendorId] = useState<string | null>(null);
  const [showSapFieldsDialog, setShowSapFieldsDialog] = useState(false);
  const [pendingSyncVendor, setPendingSyncVendor] = useState<VendorRow | null>(null);
  const [sapSyncResult, setSapSyncResult] = useState<any>(null);
  const [showSapResultDialog, setShowSapResultDialog] = useState(false);
  const [syncingVendorId, setSyncingVendorId] = useState<string | null>(null);

  const { data: approvedVendors, isLoading, refetch } = useVendors(['pending_sap_sync', 'purchase_approved']);
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

  const isVendorMsme = (v: VendorRow | null) => {
    const x = v as any;
    return !!(x?.msme_number) || x?.msme_verification_status === 'passed';
  };

  const getApprovalLabel = (v: VendorRow) => isVendorMsme(v) ? 'CEO Office Approved' : 'Finance 2 Approved';

  const openSapFieldsDialog = (vendor: VendorRow) => {
    setPendingSyncVendor(vendor);
    setShowSapFieldsDialog(true);
  };

  const handleConfirmSync = async (overrides: SapFieldOverrides) => {
    const vendor = pendingSyncVendor;
    if (!vendor) return;
    setSyncingVendorId(vendor.id);
    try {
      const result = await sapSync.mutateAsync({ vendorId: vendor.id, overrides });
      setSapSyncResult(result.sapResponse);
      setSelectedVendor(vendor);
      setShowSapFieldsDialog(false);
      setShowSapResultDialog(true);
    } catch (error: any) {
      console.error('SAP sync failed:', error);
      const fallbackResponse = error?.sapResponse ?? [
        { MSGTYP: 'E', MSG: error?.message || 'SAP sync failed', BP_LIFNR: '', BPNAME: vendor.legal_name || '' },
      ];
      setSapSyncResult({
        success: false,
        message: error?.message || 'SAP sync failed',
        sapResponse: fallbackResponse,
      });
      setSelectedVendor(vendor);
      setShowSapFieldsDialog(false);
      setShowSapResultDialog(true);
    } finally {
      setSyncingVendorId(null);
    }
  };



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
                        <Badge className="bg-green-100 text-green-700 border-green-200">{getApprovalLabel(vendor)}</Badge>
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
                    <Button variant="outline" className="rounded-xl" onClick={() => setPreviewVendorId(vendor.id)}>
                      <FileText className="h-4 w-4 mr-2" />Preview
                    </Button>
                    <Button
                      className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-lg shadow-blue-500/20"
                      onClick={() => openSapFieldsDialog(vendor)}
                      disabled={syncingVendorId === vendor.id}
                    >
                      {syncingVendorId === vendor.id ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Syncing...</>
                      ) : (
                        <><Server className="h-4 w-4 mr-2" />Prepare &amp; Sync</>
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
      <VendorReviewDialog
        vendorId={selectedVendor?.id ?? null}
        open={showDetails}
        onOpenChange={setShowDetails}
        footerExtra={
          <Button
            className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-lg shadow-blue-500/20"
            onClick={() => { if (selectedVendor) { setShowDetails(false); openSapFieldsDialog(selectedVendor); } }}
            disabled={sapSync.isPending}
          >
            {sapSync.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Syncing...</>
            ) : (
              <><Server className="h-4 w-4 mr-2" />Prepare &amp; Sync</>
            )}
          </Button>
        }
      />

      <VendorSubmissionPreviewDialog
        vendorId={previewVendorId}
        open={!!previewVendorId}
        onOpenChange={(o) => { if (!o) setPreviewVendorId(null); }}
      />

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

      <SapFieldsDialog
        open={showSapFieldsDialog}
        onOpenChange={(o) => { setShowSapFieldsDialog(o); if (!o) setPendingSyncVendor(null); }}
        vendor={pendingSyncVendor}
        onConfirm={handleConfirmSync}
        isSubmitting={!!syncingVendorId}
      />
    </div>
  );
}
