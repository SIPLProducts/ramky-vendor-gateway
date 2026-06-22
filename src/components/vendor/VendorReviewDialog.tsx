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
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ValidationStatus } from '@/components/vendor/ValidationStatus';
import { GstFilingStatusTable, normalizeFilingStatus, type FilingStatusRow } from '@/components/vendor/kyc/GstFilingStatusTable';
import { useConfiguredKycApi } from '@/hooks/useConfiguredKycApi';
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
  Shield,
  Download,
  Eye,
} from 'lucide-react';

interface GstFilingRow {
  financial_year: string;
  tax_period: string;
  date_of_filing: string;
  status: string;
}

interface GstComplianceReport {
  complianceScore: number;
  status: string;
  riskLevel: string;
  registrationDate: string;
  filingStatus: string;
  lastFiledReturn: string;
  filingRows: GstFilingRow[];
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const FULL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const fmtDmy = (d: Date) => {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
};
const formatDateDMY = (value?: string): string => {
  if (!value) return '-';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  return `${m[3]}/${m[2]}/${m[1]}`;
};

const dedupeAndTrim = (rows: FilingStatusRow[]): GstFilingRow[] => {
  const priority: Record<string, number> = { GSTR3B: 0, GSTR1: 1 };
  const byKey = new Map<string, FilingStatusRow>();
  for (const r of rows) {
    const key = `${r.financial_year || ''}|${r.tax_period || ''}`;
    const existing = byKey.get(key);
    if (!existing) { byKey.set(key, r); continue; }
    const pNew = priority[(r.return_type || '').toUpperCase()] ?? 99;
    const pOld = priority[(existing.return_type || '').toUpperCase()] ?? 99;
    if (pNew < pOld) byKey.set(key, r);
  }
  return Array.from(byKey.values())
    .sort((a, b) => (b.date_of_filing || '').localeCompare(a.date_of_filing || ''))
    .slice(0, 3)
    .map((r) => ({
      financial_year: r.financial_year || '-',
      tax_period: r.tax_period || '-',
      date_of_filing: formatDateDMY(r.date_of_filing),
      status: r.status || '-',
    }));
};

const buildGstComplianceReport = (
  vendor: any,
  validation: any | null,
  liveFilingRows?: FilingStatusRow[] | null,
): GstComplianceReport => {
  const details = validation?.details || {};
  const isPassed = validation?.status === 'passed';
  const score: number = typeof details.complianceScore === 'number'
    ? details.complianceScore
    : (isPassed ? 87 : vendor?.gstin ? 70 : 40);
  const status: string = details.gstStatus
    || details.gstin_status
    || vendor?.gst_status
    || (isPassed ? 'Active' : vendor?.gstin ? 'Active' : 'Inactive');
  const riskLevel: string = details.riskLevel || (score >= 80 ? 'Low' : score >= 50 ? 'Medium' : 'High');

  const persistedRows = normalizeFilingStatus(details.filing_status);
  const sourceRows = persistedRows.length > 0 ? persistedRows : (liveFilingRows || []);
  const filingRows = dedupeAndTrim(sourceRows);

  // Derive filing status + last filed return only from real data (saved
  // validation row, vendor record, or live response). No hardcoded defaults.
  const latestFiled = filingRows.find((r) => (r.status || '').toLowerCase() === 'filed');
  const filingStatusText: string = details.filingStatus
    || (filingRows.length > 0
        ? (latestFiled ? 'Regular' : 'Delayed')
        : '-');
  const registrationDate: string = details.registrationDate
    || details.date_of_registration
    || vendor?.gst_registration_date
    || '-';
  const lastFiledReturn: string = details.lastFiledReturn
    || (latestFiled ? `${latestFiled.tax_period || ''} ${latestFiled.financial_year || ''}`.trim() : '-');

  return { complianceScore: score, status, riskLevel, registrationDate, filingStatus: filingStatusText, lastFiledReturn, filingRows };
};

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
  const [gstValidation, setGstValidation] = useState<any | null>(null);
  const [complianceDocs, setComplianceDocs] = useState<any[]>([]);
  const [liveFilingRows, setLiveFilingRows] = useState<FilingStatusRow[] | null>(null);
  const [filingFetching, setFilingFetching] = useState(false);
  const [filingFetched, setFilingFetched] = useState(false);
  const [routing, setRouting] = useState<{
    vendorCompany: string | null;
    invitationCompany: string | null;
    companyMismatch: boolean;
    buyerName: string | null;
    buyerEmail: string | null;
    mappedScm: Array<{ name: string | null; email: string | null }>;
    invitedAt: string | null;
  } | null>(null);
  const { callProvider } = useConfiguredKycApi();

  useEffect(() => {
    let cancelled = false;
    if (!open || !vendorId) {
      setVendor(null);
      setGstValidation(null);
      setComplianceDocs([]);
      setLiveFilingRows(null);
      setFilingFetched(false);
      setFilingFetching(false);
      setRouting(null);
      return;
    }
    setLoading(true);
    (async () => {
      const [{ data: v, error: vErr }, { data: gstRows }, { data: docs }] = await Promise.all([
        supabase.from('vendors').select('*').eq('id', vendorId).maybeSingle(),
        supabase
          .from('vendor_validations')
          .select('*')
          .eq('vendor_id', vendorId)
          .eq('validation_type', 'gst')
          .order('created_at', { ascending: false }),
        supabase
          .from('vendor_documents')
          .select('*')
          .eq('vendor_id', vendorId)
          .in('document_type', [
            'gst_certificate', 'gst_self_declaration',
            'pan_card',
            'msme_certificate', 'msme_self_declaration',
            'cancelled_cheque', 'cancelled_cheque_2',
            'registration_copy', 'swift_iban_details',
            'iec_certificate', 'financial_docs', 'dealership_certificate',
          ]),

      ]);
      if (cancelled) return;
      if (vErr) {
        console.error('Failed to load vendor', vErr);
        setVendor(null);
      } else {
        setVendor(v);
      }
      // Pick the most recent GST validation row that actually carries filing-status
      // data. The post-submission `runValidationsMutation` inserts a simulated row
      // without `filing_status`, so the newest row is often empty even though the
      // upload-step row (created earlier) has the real Surepass response.
      const extractFiling = (row: any) => {
        const d = row?.details || {};
        return d.filing_status
          ?? d?.data?.filing_status
          ?? d?.raw?.filing_status
          ?? d?.raw?.data?.filing_status
          ?? d?.response?.filing_status
          ?? d?.response?.data?.filing_status
          ?? null;
      };
      const rowsArr = (gstRows as any[]) || [];
      const withFiling = rowsArr.find((r) => normalizeFilingStatus(extractFiling(r)).length > 0);
      const chosen = withFiling || rowsArr[0] || null;
      // Normalise details so downstream code can read `details.filing_status` directly.
      if (chosen) {
        const filing = extractFiling(chosen);
        if (filing && !chosen.details?.filing_status) {
          chosen.details = { ...(chosen.details || {}), filing_status: filing };
        }
      }
      setGstValidation(chosen);
      setComplianceDocs(docs || []);

      // Load routing/invitation context
      try {
        const { data: inv } = await supabase
          .from('vendor_invitations')
          .select('created_by, tenant_id, created_at')
          .eq('vendor_id', vendorId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const tenantIds = Array.from(new Set([v?.tenant_id, inv?.tenant_id].filter(Boolean))) as string[];
        const { data: tens } = tenantIds.length
          ? await supabase.from('tenants').select('id, name, code').in('id', tenantIds)
          : { data: [] as any[] };
        const tMap = new Map((tens ?? []).map((t: any) => [t.id, t]));

        let buyer: any = null;
        let mappedScm: Array<{ name: string | null; email: string | null }> = [];
        if (inv?.created_by) {
          const { data: bp } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('id', inv.created_by)
            .maybeSingle();
          buyer = bp;
          const { data: maps } = await supabase
            .from('buyer_scm_mappings')
            .select('scm_manager_user_id')
            .eq('buyer_user_id', inv.created_by);
          const scmIds = (maps ?? []).map((m: any) => m.scm_manager_user_id).filter(Boolean);
          if (scmIds.length) {
            const { data: sp } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .in('id', scmIds);
            mappedScm = (sp ?? []).map((p: any) => ({ name: p.full_name, email: p.email }));
          }
        }

        const vt = v?.tenant_id ? tMap.get(v.tenant_id) : null;
        const it = inv?.tenant_id ? tMap.get(inv.tenant_id) : null;
        if (!cancelled) {
          setRouting({
            vendorCompany: vt ? `${vt.name}${vt.code ? ` (${vt.code})` : ''}` : null,
            invitationCompany: it ? `${it.name}${it.code ? ` (${it.code})` : ''}` : null,
            companyMismatch: !!(vt && it && v?.tenant_id !== inv?.tenant_id),
            buyerName: buyer?.full_name ?? null,
            buyerEmail: buyer?.email ?? null,
            mappedScm,
            invitedAt: inv?.created_at ?? null,
          });
        }
      } catch (e) {
        console.warn('Failed to load vendor routing context', e);
      }

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [vendorId, open]);

  // If nothing was persisted, fetch the filing status live from the configured
  // GST_FILING provider so the Compliance Report tab isn't blank.
  useEffect(() => {
    if (!open || !vendor?.gstin) return;
    const persisted = normalizeFilingStatus(gstValidation?.details?.filing_status);
    if (persisted.length > 0) {
      setFilingFetched(true);
      return;
    }
    if (filingFetching || filingFetched) return;
    let cancelled = false;
    setFilingFetching(true);
    (async () => {
      try {
        const gstin = String(vendor.gstin).toUpperCase().trim();
        const tryProvider = async (providerName: string) => {
          const r = await callProvider({
            providerName,
            input: { gstin, id_number: gstin },
          });
          if (!r.found || !r.ok) return [] as FilingStatusRow[];
          const candidates = [
            r.data?.filing_status,
            r.raw?.data?.filing_status,
            r.raw?.filing_status,
          ];
          for (const c of candidates) {
            const n = normalizeFilingStatus(c);
            if (n.length > 0) return n;
          }
          return [] as FilingStatusRow[];
        };
        // Try the dedicated filing provider first; fall back to GSTIN advanced
        // (which also returns filing_status when `filing_status_get: true`).
        let rows = await tryProvider('GST_FILING');
        if (rows.length === 0) {
          rows = await tryProvider('GST');
        }
        if (cancelled) return;
        setLiveFilingRows(rows);
        setFilingFetched(true);
        if (rows.length > 0 && vendor.id) {
          try {
            await supabase.from('vendor_validations').insert([{
              vendor_id: vendor.id,
              validation_type: 'gst',
              status: 'passed',
              message: 'GST filing status fetched on review',
              details: { filing_status: rows } as any,
            }]);
          } catch (e) {
            console.warn('[VendorReviewDialog] Failed to persist live filing status', e);
          }
        }
      } finally {
        if (!cancelled) setFilingFetching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, vendor?.id, vendor?.gstin, gstValidation, filingFetched, filingFetching, callProvider]);

  const validations = getValidationsFromVendor(vendor);
  const gstReport = vendor ? buildGstComplianceReport(vendor, gstValidation, liveFilingRows) : null;

  const openDocument = async (filePath: string) => {
    const { data } = await supabase.storage.from('vendor-documents').createSignedUrl(filePath, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

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
            <TabsList className="grid w-full grid-cols-4 rounded-xl bg-muted p-1">
              <TabsTrigger value="details" className="rounded-lg">All Details</TabsTrigger>
              <TabsTrigger value="documents" className="rounded-lg">
                <FolderOpen className="h-4 w-4 mr-2" />Documents
              </TabsTrigger>
              <TabsTrigger value="validations" className="rounded-lg">Validations</TabsTrigger>
              <TabsTrigger value="gst_compliance" className="rounded-lg">
                <Shield className="h-4 w-4 mr-2" />GST Compliance Report
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-4 flex-1 overflow-hidden">
              <ScrollArea className="h-[50vh] pr-4">
                <div className="space-y-6">
                  {/* Routing / Invitation */}
                  {routing && (
                    <>
                      <div className="space-y-3">
                        <h4 className="font-semibold flex items-center gap-2 text-primary">
                          <Shield className="h-4 w-4" />
                          Routing & Invitation
                        </h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="space-y-1">
                            <p className="text-muted-foreground">Buyer Company (on vendor)</p>
                            <p className="font-medium">{routing.vendorCompany || '-'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-muted-foreground">Invitation Company</p>
                            <p className="font-medium">{routing.invitationCompany || '-'}</p>
                            {routing.companyMismatch && (
                              <p className="text-xs text-amber-600">
                                Vendor selected a different company than the invitation.
                              </p>
                            )}
                          </div>
                          <div className="space-y-1">
                            <p className="text-muted-foreground">Invited By (Buyer)</p>
                            <p className="font-medium">{routing.buyerName || '-'}</p>
                            {routing.buyerEmail && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Mail className="h-3 w-3" /> {routing.buyerEmail}
                              </p>
                            )}
                          </div>
                          <div className="space-y-1">
                            <p className="text-muted-foreground">Mapped SCM Manager(s)</p>
                            {routing.mappedScm.length === 0 ? (
                              <p className="font-medium">-</p>
                            ) : (
                              routing.mappedScm.map((s, i) => (
                                <div key={i}>
                                  <p className="font-medium">{s.name || '-'}</p>
                                  {s.email && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Mail className="h-3 w-3" /> {s.email}
                                    </p>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                      <Separator />
                    </>
                  )}

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

            <TabsContent value="gst_compliance" className="mt-4 flex-1 overflow-hidden">
              <ScrollArea className="h-[55vh] pr-4">
                {gstReport && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                      <Card className={
                        gstReport.complianceScore >= 80
                          ? 'border-green-200 bg-green-50 dark:bg-green-950/20'
                          : gstReport.complianceScore >= 50
                          ? 'border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20'
                          : 'border-red-200 bg-red-50 dark:bg-red-950/20'
                      }>
                        <CardContent className="pt-4 text-center">
                          <p className="text-sm text-muted-foreground">Compliance Score</p>
                          <p className={`text-3xl font-bold ${
                            gstReport.complianceScore >= 80
                              ? 'text-green-600'
                              : gstReport.complianceScore >= 50
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          }`}>
                            {gstReport.complianceScore}%
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4 text-center">
                          <p className="text-sm text-muted-foreground">GST Status</p>
                          <p className="text-lg font-semibold">{gstReport.status}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4 text-center">
                          <p className="text-sm text-muted-foreground">Risk Level</p>
                          <p className="text-lg font-semibold">{gstReport.riskLevel}</p>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">GSTIN</p>
                        <p className="font-mono font-medium">{vendor.gstin || '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Registration Date</p>
                        <p className="font-medium">{gstReport.registrationDate}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Filing Status</p>
                        <p className="font-medium">{gstReport.filingStatus}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Last Filed Return</p>
                        <p className="font-medium">{gstReport.lastFiledReturn}</p>
                      </div>
                    </div>

                    {(() => {
                      const rawRows: FilingStatusRow[] = (() => {
                        const persisted = normalizeFilingStatus(gstValidation?.details?.filing_status);
                        if (persisted.length > 0) return persisted;
                        return liveFilingRows || [];
                      })();
                      if (!vendor?.gstin && rawRows.length === 0) return null;
                      return (
                        <div className="rounded-lg border bg-card p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-primary" />
                            <h4 className="font-semibold text-sm">GST Filing Status (Last 3 Months)</h4>
                          </div>
                          {rawRows.length > 0 ? (
                            <GstFilingStatusTable rows={rawRows} limit={3} />
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              {filingFetching
                                ? 'Fetching latest filing status from GSTN…'
                                : filingFetched
                                  ? 'No filing data returned by GSTN for this GSTIN.'
                                  : 'No filing data captured for this vendor.'}
                            </p>
                          )}
                        </div>
                      );
                    })()}


                    <Separator />

                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2 text-primary">
                        <FileText className="h-4 w-4" />
                        Compliance Document
                      </h4>
                      {complianceDocs.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No compliance document uploaded.</p>
                      ) : (
                        <div className="space-y-2">
                          {complianceDocs.map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between border rounded-md p-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <FileText className="h-5 w-5 text-primary shrink-0" />
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{doc.file_name}</p>
                                  <p className="text-xs text-muted-foreground capitalize">
                                    {String(doc.document_type).replace(/_/g, ' ')}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => openDocument(doc.file_path)}>
                                  <Eye className="h-4 w-4 mr-1" /> View
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => openDocument(doc.file_path)}>
                                  <Download className="h-4 w-4 mr-1" /> Download
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </ScrollArea>
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
