import { ReactNode, useEffect, useState } from 'react';
import { formatDate } from '@/lib/dateFormat';
import { cn } from '@/lib/utils';
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

import { GstFilingStatusTable, normalizeFilingStatus, type FilingStatusRow } from '@/components/vendor/kyc/GstFilingStatusTable';
import { useConfiguredKycApi } from '@/hooks/useConfiguredKycApi';
import { VendorDocuments } from '@/components/vendor/VendorDocuments';
import { ValidationResult } from '@/types/vendor';
import { getSapName1 } from '@/lib/sapPayloadBuilder';
import { toProperCase, formatVendorName } from '@/lib/textCase';
import { formatPanStatus, formatAadhaarLinked, PAN_STATUS_LABEL, AADHAAR_LINKED_LABEL } from '@/lib/panComprehensive';
import { formatIndianFy, getLastThreeCompletedIndianFyStartYears } from '@/lib/indianFy';
import { useSapMasterData } from '@/hooks/useSapMasterData';
import {
  Building2,
  MapPin,
  Mail,
  FileText,
  Landmark,
  CreditCard,
  MessageSquare,
  FolderOpen,
  Shield,
  Tags,
  CheckCircle2,
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
  /** Override the dialog subtitle. Defaults to "Review vendor details". */
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
  description = 'Review vendor details',
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
    originalBuyerName: string | null;
    originalBuyerEmail: string | null;
    mappedScm: Array<{ name: string | null; email: string | null }>;
    invitedAt: string | null;
  } | null>(null);
  const { callProvider } = useConfiguredKycApi();

  // Classification master data — for Proper Case display of codes
  const { data: mgvRows } = useSapMasterData('material_group_vendor');
  const { data: vcRows } = useSapMasterData('vendor_category');
  const { data: cfRows } = useSapMasterData('vendor_cashflow');
  const { data: tcRows } = useSapMasterData('tier_category');
  const toProperCase = (s: string) => {
    if (!s) return s;
    if (!/[a-z]/.test(s) && /[A-Z]/.test(s)) {
      return s.toLowerCase().replace(/\b([a-z])/g, (_, c) => c.toUpperCase());
    }
    return s;
  };
  const buildDescMap = (rows: any[] | undefined) => {
    const m = new Map<string, string>();
    (rows || []).forEach((r) => {
      if (r?.code) m.set(String(r.code), toProperCase(r.description || r.code));
    });
    return m;
  };
  const mgvMap = buildDescMap(mgvRows as any);
  const vcMap = buildDescMap(vcRows as any);
  const cfMap = buildDescMap(cfRows as any);
  const tcMap = buildDescMap(tcRows as any);
  const fmtCodes = (arr: any, map: Map<string, string>) =>
    Array.isArray(arr) && arr.length
      ? arr.map((c) => map.get(String(c)) || toProperCase(String(c))).join(', ')
      : '-';

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
          .select('created_by, original_created_by, tenant_id, created_at')
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
        let originalBuyer: any = null;
        let mappedScm: Array<{ name: string | null; email: string | null }> = [];
        const profileIds = Array.from(
          new Set([inv?.created_by, inv?.original_created_by].filter(Boolean) as string[]),
        );
        if (profileIds.length) {
          const { data: bps } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', profileIds);
          const pMap = new Map((bps ?? []).map((p: any) => [p.id, p]));
          buyer = inv?.created_by ? pMap.get(inv.created_by) ?? null : null;
          if (inv?.original_created_by && inv.original_created_by !== inv.created_by) {
            originalBuyer = pMap.get(inv.original_created_by) ?? null;
          }
        }
        if (inv?.created_by) {
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
            originalBuyerName: originalBuyer?.full_name ?? null,
            originalBuyerEmail: originalBuyer?.email ?? null,
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
            {(vendor && formatVendorName(vendor)) || toProperCase(vendor?.legal_name) || 'Vendor Details'}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : vendor ? (
          <Tabs defaultValue="details" className="w-full flex-1 min-h-0 overflow-hidden flex flex-col">
            <TabsList className="flex w-full gap-1 border-b border-border bg-transparent p-0 h-auto rounded-none justify-start">
              <TabsTrigger value="details" className="flex-1 justify-center gap-2 rounded-t-md rounded-b-none border border-transparent border-b-0 px-3 py-2 text-sm text-muted-foreground hover:text-foreground data-[state=active]:bg-white data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-700 data-[state=active]:shadow-none -mb-px">All Details</TabsTrigger>
              <TabsTrigger value="documents" className="flex-1 justify-center gap-2 rounded-t-md rounded-b-none border border-transparent border-b-0 px-3 py-2 text-sm text-muted-foreground hover:text-foreground data-[state=active]:bg-white data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-700 data-[state=active]:shadow-none -mb-px">
                <FolderOpen className="h-4 w-4 mr-1" />Documents
              </TabsTrigger>
              <TabsTrigger value="gst_compliance" className="flex-1 justify-center gap-2 rounded-t-md rounded-b-none border border-transparent border-b-0 px-3 py-2 text-sm text-muted-foreground hover:text-foreground data-[state=active]:bg-white data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-700 data-[state=active]:shadow-none -mb-px">
                <Shield className="h-4 w-4 mr-1" />GST Compliance Report
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-3 flex-1 min-h-0 overflow-hidden">
              <ScrollArea className="h-full pr-4">

                <div className="space-y-6">
                  {/* Routing / Invitation */}
                  {routing && (
                    <SectionCard icon={Shield} title="Buyer Details">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Buyer Company</p>
                          <p className="font-medium">{routing.vendorCompany || '-'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Invited By</p>
                          <p className="font-medium">{routing.buyerName || '-'}</p>
                        </div>
                      </div>
                    </SectionCard>
                  )}

                  {/* Organization */}
                  <SectionCard icon={Building2} title="Vendor Details">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="space-y-1"><p className="text-muted-foreground">Legal Name</p><p className="font-medium">{toProperCase(vendor.legal_name) || '-'}</p></div>
                      <div className="space-y-1"><p className="text-muted-foreground">Trade Name</p><p className="font-medium">{toProperCase(vendor.trade_name) || '-'}</p></div>
                      <div className="space-y-1"><p className="text-muted-foreground">Industry Type</p><p className="font-medium">{vendor.industry_type || '-'}</p></div>
                      <div className="space-y-1"><p className="text-muted-foreground">Organization Type</p><p className="font-medium">{vendor.organization_type || '-'}</p></div>
                      <div className="space-y-1"><p className="text-muted-foreground">Ownership Type</p><p className="font-medium">{vendor.ownership_type || '-'}</p></div>
                      <div className="space-y-1"><p className="text-muted-foreground">Entity Type</p><p className="font-medium">{vendor.entity_type || '-'}</p></div>
                    </div>
                  </SectionCard>

                  {/* Statutory */}
                  {(() => {
                    const v: any = vendor;
                    const gstOk = v.gst_verification_status === 'passed';
                    const panOk = v.pan_verification_status === 'passed';
                    const msmeOk = v.msme_verification_status === 'passed';
                    const Tick = () => (
                      <span
                        className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-emerald-500 text-white border-[3px] border-emerald-700 ml-1.5 align-text-bottom"
                        title="Verified"
                        aria-label="Verified"
                      >
                        <CheckCircle2 className="h-4 w-4" strokeWidth={3} />
                      </span>
                    );
                    const Label = ({ text, ok }: { text: string; ok?: boolean }) => (
                      <p className="text-muted-foreground flex items-center">
                        <span>{text}</span>
                        {ok && <Tick />}
                      </p>
                    );
                    return (
                      <SectionCard icon={FileText} title="Statutory Details">
                        <div className="space-y-4 text-sm">
                          <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1"><Label text="GSTIN" ok={gstOk} /><p className="font-mono font-medium">{v.gstin || '-'}</p></div>
                            <div className="space-y-1"><Label text="PAN" ok={panOk} /><p className="font-mono font-medium">{v.pan || '-'}</p></div>
                            <div className="space-y-1"><Label text="PAN Holder Name" ok={panOk} /><p className="font-medium">{toProperCase(v.pan_holder_name || v.msme_enterprise_name || v.account_holder_name || v.trade_name || v.legal_name) || '-'}</p></div>
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1"><Label text={PAN_STATUS_LABEL} ok={panOk} /><p className="font-medium">{v.pan_status ? formatPanStatus(v.pan_status) : (v.pan && panOk ? 'Valid' : '-')}</p></div>
                            <div className="space-y-1"><Label text={AADHAAR_LINKED_LABEL} ok={panOk} /><p className="font-medium">{formatAadhaarLinked(v.pan_aadhaar_linked)}</p></div>
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1"><Label text="MSME Number" ok={msmeOk} /><p className="font-mono font-medium">{v.msme_number || '-'}</p></div>
                            <div className="space-y-1"><Label text="MSME Category" ok={msmeOk} /><p className="font-medium capitalize">{v.msme_category || '-'}</p></div>
                            <div className="space-y-1"><Label text="MSME Major Activity" ok={msmeOk} /><p className="font-medium capitalize">{v.msme_major_activity || '-'}</p></div>
                          </div>
                        </div>
                      </SectionCard>
                    );
                  })()}

                  {/* Bank */}
                  <SectionCard icon={Landmark} title="Bank Details">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="space-y-1"><p className="text-muted-foreground">Bank Name</p><p className="font-medium">{vendor.bank_name || '-'}</p></div>
                      <div className="space-y-1"><p className="text-muted-foreground">Branch</p><p className="font-medium">{vendor.bank_branch_name || vendor.branch_name || '-'}</p></div>
                      <div className="space-y-1"><p className="text-muted-foreground">Account Type</p><p className="font-medium capitalize">{vendor.account_type || '-'}</p></div>
                      <div className="space-y-1"><p className="text-muted-foreground">Account Number</p><p className="font-mono font-medium">{vendor.account_number || '-'}</p></div>
                      <div className="space-y-1"><p className="text-muted-foreground">IFSC Code</p><p className="font-mono font-medium">{vendor.ifsc_code || '-'}</p></div>
                      <div className="space-y-1"><p className="text-muted-foreground">MICR Code</p><p className="font-mono font-medium">{vendor.micr_code || '-'}</p></div>
                    </div>
                  </SectionCard>

                  {/* Address — visiting-card style */}
                  {(() => {
                    const v: any = vendor;
                    const joinAddr = (parts: (string | null | undefined)[]) =>
                      parts.map((p) => (p || '').trim()).filter(Boolean);
                    const regLines = joinAddr([
                      v.registered_address,
                      v.registered_address_line2,
                      v.registered_address_line3,
                      v.registered_address_line4,
                    ]);
                    const regCityLine = joinAddr([v.registered_city, v.registered_state]).join(', ');
                    const regPin = v.registered_pincode ? `PIN ${v.registered_pincode}` : '';

                    const commSame =
                      !v.communication_address ||
                      v.communication_address === v.registered_address;
                    const commLines = commSame ? [] : joinAddr([v.communication_address]);
                    const commCityLine = commSame
                      ? ''
                      : joinAddr([v.communication_city, v.communication_state]).join(', ');
                    const commPin = commSame
                      ? ''
                      : v.communication_pincode
                      ? `PIN ${v.communication_pincode}`
                      : '';

                    const email1 = v.registered_email || v.primary_email;
                    const email2 = v.registered_email_2;
                    const contact1 = v.registered_contact_1 || v.primary_phone;
                    const contact2 = v.registered_contact_2;

                    return (
                      <SectionCard icon={MapPin} title="Address Details">
                        <div className="grid gap-4 md:grid-cols-2">
                          <VisitingCard
                            title="Registered / Corporate Office Address"
                            lines={regLines}
                            cityLine={regCityLine}
                            pin={regPin}
                            showContacts
                            email1={email1}
                            email2={email2}
                            contact1={contact1}
                            contact2={contact2}
                          />
                          <VisitingCard
                            title="Communication Address"
                            lines={commLines}
                            cityLine={commCityLine}
                            pin={commPin}
                            sameAsRegistered={commSame}
                            showContacts={!commSame}
                            email1={email1}
                            email2={email2}
                            contact1={contact1}
                            contact2={contact2}
                          />
                        </div>
                      </SectionCard>
                    );
                  })()}

                  {/* Classification Details */}
                  {(() => {
                    const v = vendor as any;
                    return (
                      <SectionCard icon={Tags} title="Classification Details">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="border border-border rounded-lg p-3 space-y-2">
                            <p className="text-xs font-semibold text-primary">Vendor_Details</p>
                            <div className="grid grid-cols-1 gap-2 text-sm">
                              <div><p className="text-muted-foreground">Material Group for Vendors</p><p className="font-medium">{fmtCodes(v.material_group_vendors, mgvMap)}</p></div>
                              <div><p className="text-muted-foreground">Vendor Category</p><p className="font-medium">{fmtCodes(v.vendor_categories, vcMap)}</p></div>
                            </div>
                          </div>
                          <div className="border border-border rounded-lg p-3 space-y-2">
                            <p className="text-xs font-semibold text-primary">Vendor_CFSTMT</p>
                            <div className="grid grid-cols-1 gap-2 text-sm">
                              <div><p className="text-muted-foreground">Vendor Cash Flow</p><p className="font-medium">{fmtCodes(v.vendor_cashflow, cfMap)}</p></div>
                              <div><p className="text-muted-foreground">Tier Category</p><p className="font-medium">{fmtCodes(v.tier_category, tcMap)}</p></div>
                            </div>
                          </div>
                        </div>
                      </SectionCard>
                    );
                  })()}

                  {/* Financial */}
                  {(() => {
                    const [fy1, fy2, fy3] = getLastThreeCompletedIndianFyStartYears();
                    const fmt = (v: any) => {
                      const n = Number(v);
                      return (v === 0 || v) && Number.isFinite(n) && n >= 0
                        ? `₹ ${n.toLocaleString('en-IN')} Lakhs`
                        : '-';
                    };
                    const creditPeriod = Number(vendor.credit_period_expected);
                    return (
                      <SectionCard icon={CreditCard} title="Financial Information">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div className="space-y-1"><p className="text-muted-foreground">Turnover {formatIndianFy(fy1)}</p><p className="font-medium">{fmt(vendor.turnover_year1)}</p></div>
                          <div className="space-y-1"><p className="text-muted-foreground">Turnover {formatIndianFy(fy2)}</p><p className="font-medium">{fmt(vendor.turnover_year2)}</p></div>
                          <div className="space-y-1"><p className="text-muted-foreground">Turnover {formatIndianFy(fy3)}</p><p className="font-medium">{fmt(vendor.turnover_year3)}</p></div>
                          <div className="space-y-1"><p className="text-muted-foreground">Credit Period Expected</p><p className="font-medium">{(vendor.credit_period_expected === 0 || vendor.credit_period_expected) && Number.isFinite(creditPeriod) && creditPeriod >= 0 ? `${vendor.credit_period_expected} days` : '-'}</p></div>
                        </div>
                      </SectionCard>
                    );
                  })()}


                  {(vendor.finance_comments || vendor.purchase_comments) && (
                    <SectionCard icon={MessageSquare} title="Review Comments">
                      <div className="grid grid-cols-1 gap-4 text-sm">
                        {vendor.finance_comments && (
                          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">💰 Finance Team</span>
                              {vendor.finance_reviewed_at && (
                                <span className="text-xs text-muted-foreground">{formatDate(vendor.finance_reviewed_at)}</span>
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
                                <span className="text-xs text-muted-foreground">{formatDate(vendor.purchase_reviewed_at)}</span>
                              )}
                            </div>
                            <p className="text-teal-900 dark:text-teal-100">{vendor.purchase_comments}</p>
                          </div>
                        )}
                      </div>
                    </SectionCard>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="documents" className="mt-3 flex-1 min-h-0 overflow-auto">
              <VendorDocuments vendorId={vendor.id} hideDownload />
            </TabsContent>


            <TabsContent value="gst_compliance" className="mt-3 flex-1 min-h-0 flex flex-col gap-3">
              {gstReport && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm shrink-0 px-1">
                    <div>
                      <p className="text-muted-foreground">GSTIN</p>
                      <p className="font-mono font-medium">{vendor.gstin || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Registration Date</p>
                      <p className="font-medium">{formatDate(gstReport.registrationDate, gstReport.registrationDate)}</p>
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

                  <div className="flex-1 min-h-0 overflow-auto pr-1">
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
                  </div>
                </>
              )}
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

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-0.5">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-medium break-words">{value || "-"}</p>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-background to-muted/40 p-5 shadow-sm", className)}>
      <div className="absolute left-0 top-0 h-full w-1.5 bg-primary/80" />
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h4 className="font-semibold text-primary">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function VisitingCard({
  title,
  lines,
  cityLine,
  pin,
  showContacts = false,
  sameAsRegistered = false,
  email1,
  email2,
  contact1,
  contact2,
}: {
  title: string;
  lines: string[];
  cityLine: string;
  pin: string;
  showContacts?: boolean;
  sameAsRegistered?: boolean;
  email1?: string | null;
  email2?: string | null;
  contact1?: string | null;
  contact2?: string | null;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-background to-muted/40 p-5 shadow-sm">
      <div className="absolute left-0 top-0 h-full w-1.5 bg-emerald-500" />
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <MapPin className="h-4 w-4 text-primary" />
      </div>
      {sameAsRegistered ? (
        <p className="text-sm text-muted-foreground italic">Same as Registered Address</p>
      ) : (
        <address className="not-italic text-sm leading-relaxed text-foreground space-y-0.5">
          {lines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
          {cityLine && <div>{cityLine}</div>}
          {pin && <div className="font-medium">{pin}</div>}
          {lines.length === 0 && !cityLine && !pin && (
            <div className="text-muted-foreground">-</div>
          )}
        </address>
      )}
      {showContacts && (
        <>
          <div className="my-4 h-px bg-border/60" />
          <div className="grid grid-cols-[1fr_140px] gap-x-4 gap-y-3 text-sm">
            <div className="flex flex-col">
              <span className="text-muted-foreground text-xs">Email 1</span>
              <span className="font-medium break-all">{email1 || '-'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground text-xs">Contact 1</span>
              <span className="font-medium">{contact1 || '-'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground text-xs">Email 2</span>
              <span className="font-medium break-all">{email2 || '-'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground text-xs">Contact 2</span>
              <span className="font-medium">{contact2 || '-'}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
